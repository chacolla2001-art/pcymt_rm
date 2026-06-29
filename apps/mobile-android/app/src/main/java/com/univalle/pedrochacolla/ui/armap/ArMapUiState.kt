package com.univalle.pedrochacolla.ui.armap

import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.VirtualAsset

/**
 * Combina un punto de anclaje con su VirtualAsset asociado y la
 * distancia calculada desde la posición actual del usuario.
 */
data class LocationWithAsset(
    val location: Location,
    val asset: VirtualAsset?,
    /** Distancia en metros desde la posición del usuario. null = GPS no disponible. */
    val distanceMeters: Double? = null,
    /** true si el animal ya fue guardado (interactuado) por el usuario. */
    val alreadyFound: Boolean = false
)

/** Radius within which an animal is considered "catchable" (save button enabled) */
const val ENCOUNTER_RADIUS_METERS = 15.0

/**
 * Radius within which animals become VISIBLE on the explorer map.
 * Equals ENCOUNTER_RADIUS_METERS: animals only appear on the map when the user
 * is close enough to capture them. Found animals (alreadyFound=true) are always
 * shown regardless of distance so the user can track their collection.
 */
const val VISIBILITY_RADIUS_METERS = ENCOUNTER_RADIUS_METERS

/** ─────────────────────────────────────────────────────────────── */
sealed class ArMapUiState {

    /** Cargando datos iniciales */
    object Loading : ArMapUiState()

    /** Datos cargados — mapa listo para mostrar */
    data class Ready(
        val locations: List<LocationWithAsset>,
        /** Número de animales ya encontrados */
        val foundCount: Int = 0,
        /** Total de animales activos */
        val totalCount: Int = 0
    ) : ArMapUiState()

    /** Error al cargar datos */
    data class Error(val message: String) : ArMapUiState()
}

/** Estados del proceso de guardar un encuentro */
sealed class EncounterSaveState {
    object Idle : EncounterSaveState()
    object Saving : EncounterSaveState()
    data class Success(val animalName: String) : EncounterSaveState()
    data class Error(val message: String) : EncounterSaveState()
}
