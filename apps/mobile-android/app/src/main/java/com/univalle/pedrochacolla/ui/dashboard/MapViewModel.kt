package com.univalle.pedrochacolla.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.VirtualAsset
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class MapUiState(
    val isLoading: Boolean = false,
    val locations: List<Location> = emptyList(),
    /** All active locations (including already-found) — used for map markers */
    val allLocations: List<Location> = emptyList(),
    val interactedIds: Set<String> = emptySet(),
    val assetMap: Map<String, VirtualAsset> = emptyMap(),
    val error: String? = null
)

class MapViewModel(
    private val locationRepo: LocationRepository = LocationRepository(),
    private val assetRepo: VirtualAssetRepository = VirtualAssetRepository(),
    private val interactionRepo: InteractionRepository = InteractionRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(MapUiState())
    val state: StateFlow<MapUiState> = _state

    fun loadMapData() {
        val user = UserSession.currentUser ?: return
        val userId = user.id

        _state.value = MapUiState(isLoading = true)

        viewModelScope.launch {
            try {
                val interactedSet = interactionRepo.getInteractedLocationIds(userId).getOrNull() ?: emptySet()
                val allLocations = locationRepo.getActiveLocations().getOrNull() ?: emptyList()
                val visible = allLocations.filter {
                    it.showInMap == true && !interactedSet.contains(it.id)
                }

                // Batch fetch all virtual assets (for both visible and interacted locations)
                val assetIds = allLocations.filter { it.showInMap == true }.mapNotNull { it.virtualAssetId }.distinct()
                val assetMap = assetRepo.getByIds(assetIds).getOrNull() ?: emptyMap()

                _state.value = MapUiState(
                    locations = visible,
                    allLocations = allLocations.filter { it.showInMap == true },
                    interactedIds = interactedSet,
                    assetMap = assetMap
                )
            } catch (e: Exception) {
                _state.value = MapUiState(
                    error = e.message ?: "Error al cargar datos del mapa"
                )
            }
        }
    }

    class Factory : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            MapViewModel() as T
    }
}
