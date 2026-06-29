package com.univalle.pedrochacolla.ui.armap

import android.location.Location as AndroidLocation
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.Interaction
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.session.UserSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ArMapViewModel — Lógica de negocio para el Modo Explorador (Pokémon Go style).
 *
 * Responsabilidades:
 * - Cargar ubicaciones activas + virtual assets asociados
 * - Calcular distancias desde la posición GPS del usuario
 * - Determinar qué animales ya fueron encontrados
 * - Registrar encuentros en el backend (misma lógica que Realidad Mixta)
 */
@HiltViewModel
class ArMapViewModel @Inject constructor(
    private val locationRepo: LocationRepository,
    private val assetRepo: VirtualAssetRepository,
    private val interactionRepo: InteractionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArMapUiState>(ArMapUiState.Loading)
    val uiState: StateFlow<ArMapUiState> = _uiState

    private val _encounterSaveState = MutableStateFlow<EncounterSaveState>(EncounterSaveState.Idle)
    val encounterSaveState: StateFlow<EncounterSaveState> = _encounterSaveState

    /** Última posición GPS conocida del usuario */
    private var userLat: Double? = null
    private var userLng: Double? = null

    /** Cache de LocationsWithAsset para recalcular distancias sin re-cargar la API */
    private var rawLocations: List<LocationWithAsset> = emptyList()

    /** IDs de locations ya interactuadas por el usuario esta sesión (sincronizado con el backend) */
    private var foundLocationIds: MutableSet<String> = mutableSetOf()

    /** IDs de locations cuyo guardado está en curso — previene envíos duplicados por taps rápidos */
    private val savingInProgress: MutableSet<String> = mutableSetOf()

    private val currentUserId: String?
        get() = UserSession.currentUser?.id

    // ─────────────────────────────────────────────────────────
    //  CARGA DE DATOS
    // ─────────────────────────────────────────────────────────

    /**
     * Carga las ubicaciones activas con sus virtual assets asociados.
     * También obtiene las interacciones del usuario para marcar los animales ya encontrados.
     */
    fun loadMapData() {
        val userId = currentUserId ?: run {
            Timber.w("ArMapViewModel: usuario no autenticado")
            _uiState.value = ArMapUiState.Error("Usuario no autenticado")
            return
        }

        viewModelScope.launch {
            _uiState.value = ArMapUiState.Loading
            Timber.d("ArMapViewModel: loadMapData iniciado")

            try {
                // 1. Obtener todas las ubicaciones activas
                val locationsResult = locationRepo.getActiveLocations()
                val allLocations = locationsResult.getOrNull() ?: emptyList()

                // 2. Obtener IDs de locations ya interactuadas por el usuario
                val interactedResult = interactionRepo.getInteractedLocationIds(userId)
                foundLocationIds = interactedResult.getOrNull()?.toMutableSet() ?: mutableSetOf()

                // 3. Obtener todos los virtual assets asociados (batch - sin N+1)
                val assetIds = allLocations.mapNotNull { it.virtualAssetId }.distinct()
                val assetMapResult = assetRepo.getByIds(assetIds)
                val assetMap = assetMapResult.getOrNull() ?: emptyMap()

                // 4. Construir lista combinada
                rawLocations = allLocations.map { loc ->
                    LocationWithAsset(
                        location = loc,
                        asset = loc.virtualAssetId?.let { assetMap[it] },
                        distanceMeters = calculateDistance(loc),
                        alreadyFound = foundLocationIds.contains(loc.id)
                    )
                }

                emitReadyState()
                Timber.i("ArMapViewModel: ${rawLocations.size} ubicaciones cargadas")

            } catch (e: Exception) {
                Timber.e(e, "ArMapViewModel: error al cargar datos del mapa")
                _uiState.value = ArMapUiState.Error(
                    e.message ?: "Error al cargar datos del mapa"
                )
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    //  GPS - ACTUALIZACIÓN DE POSICIÓN
    // ─────────────────────────────────────────────────────────

    /**
     * Llamar cada vez que se recibe una nueva actualización GPS del FusedLocationProvider.
     * Recalcula las distancias a todos los animales y actualiza el estado.
     */
    fun onLocationUpdate(lat: Double, lng: Double) {
        userLat = lat
        userLng = lng
        Timber.d("ArMapViewModel: GPS actualizado lat=$lat, lng=$lng")

        // Recalcular distancias sin volver a llamar la API
        if (rawLocations.isNotEmpty()) {
            rawLocations = rawLocations.map { lwa ->
                lwa.copy(distanceMeters = calculateDistance(lwa.location))
            }
            emitReadyState()
        }
    }

    // ─────────────────────────────────────────────────────────
    //  ENCUENTRO — GUARDAR
    // ─────────────────────────────────────────────────────────

    /**
     * Registra el encuentro de un animal en el backend.
     * La deduplicación usa [foundLocationIds] (sincronizado con el backend) como fuente
     * de verdad, evitando el problema de SharedPreferences obsoletas tras un reset de BD.
     *
     * @param locationId ID de la ubicación del animal
     * @param virtualAssetId ID del virtual asset (animal)
     * @param animalName Nombre del animal (para feedback)
     */
    fun saveEncounter(locationId: String?, virtualAssetId: String?, animalName: String) {
        val userId = currentUserId ?: run {
            _encounterSaveState.value = EncounterSaveState.Error("Usuario no autenticado")
            return
        }

        // Fuente de verdad: estado sincronizado con el backend.
        // Si el backend ya registró este animal para el usuario, no volver a guardarlo.
        if (locationId != null && foundLocationIds.contains(locationId)) {
            Timber.d("ArMapViewModel: animal ya en la colección (backend) - $locationId")
            _encounterSaveState.value = EncounterSaveState.Success(animalName)
            return
        }

        // Previene envíos duplicados por taps rápidos o llamadas concurrentes
        val dedupKey = locationId ?: virtualAssetId ?: return
        if (savingInProgress.contains(dedupKey)) {
            Timber.d("ArMapViewModel: guardado ya en progreso para $dedupKey")
            return
        }
        savingInProgress.add(dedupKey)

        viewModelScope.launch {
            try {
                _encounterSaveState.value = EncounterSaveState.Saving
                Timber.d("ArMapViewModel: guardando encuentro - loc=$locationId, asset=$virtualAssetId")

                val interaction = Interaction(
                    id = null,
                    userId = userId,
                    locationId = locationId,
                    virtualAssetId = virtualAssetId,
                    interactionType = "scan",
                    createdAt = null,
                    metadata = mapOf<String, Any>("mode" to "map_explorer")
                )

                interactionRepo.createInteraction(interaction)
                    .onSuccess {
                        Timber.i("ArMapViewModel: encuentro guardado exitosamente")

                        // Marcar como encontrado localmente (refleja el estado del backend)
                        locationId?.let { foundLocationIds.add(it) }

                        // Actualizar lista in-memory para que el mapa refleje el cambio
                        rawLocations = rawLocations.map { lwa ->
                            if (lwa.location.id == locationId) lwa.copy(alreadyFound = true)
                            else lwa
                        }
                        emitReadyState()

                        _encounterSaveState.value = EncounterSaveState.Success(animalName)
                    }
                    .onFailure { error ->
                        Timber.e(error, "ArMapViewModel: error al guardar encuentro")
                        _encounterSaveState.value = EncounterSaveState.Error(
                            error.message ?: "Error al guardar el encuentro"
                        )
                    }
            } finally {
                savingInProgress.remove(dedupKey)
            }
        }
    }

    /**
     * Resetea el estado del guardado para poder intentar de nuevo.
     */
    fun resetEncounterState() {
        _encounterSaveState.value = EncounterSaveState.Idle
    }

    // ─────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────

    private fun emitReadyState() {
        val found = rawLocations.count { it.alreadyFound }
        _uiState.value = ArMapUiState.Ready(
            locations = rawLocations,
            foundCount = found,
            totalCount = rawLocations.size
        )
    }

    /**
     * Calcula la distancia en metros entre la posición del usuario y una ubicación.
     * Retorna null si el GPS del usuario no está disponible.
     */
    private fun calculateDistance(location: Location): Double? {
        val lat = userLat ?: return null
        val lng = userLng ?: return null

        val results = FloatArray(1)
        AndroidLocation.distanceBetween(
            lat, lng,
            location.latitude, location.longitude,
            results
        )
        return results[0].toDouble()
    }
}
