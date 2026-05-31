package com.univalle.pedrochacolla.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.AnchorIcon
import com.univalle.pedrochacolla.data.model.Section
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class CollectionUiState(
    val isLoading: Boolean = false,
    val sections: List<Section> = emptyList(),
    val interactedIds: Set<String> = emptySet(),
    val totalCount: Int = 0,
    val foundCount: Int = 0,
    val isCompleted: Boolean = false,
    val error: String? = null
)

class CollectionViewModel(
    private val locationRepo: LocationRepository = LocationRepository(),
    private val assetRepo: VirtualAssetRepository = VirtualAssetRepository(),
    private val interactionRepo: InteractionRepository = InteractionRepository()
) : ViewModel() {

    /** Maps raw section values (text labels or legacy numeric codes) to display labels */
    private val sectionLabels = mapOf(
        "Tierras Altas" to "Tierras Altas",
        "Tierras Medias" to "Tierras Medias",
        "Tierras Bajas" to "Tierras Bajas",
        "Mitos y Leyendas" to "Mitos y Leyendas",
        // Backward-compat: old numeric codes from legacy frontend saves
        "1" to "Tierras Altas",
        "2" to "Tierras Medias",
        "3" to "Tierras Bajas",
        "4" to "Mitos y Leyendas"
    )

    private val _state = MutableStateFlow(CollectionUiState())
    val state: StateFlow<CollectionUiState> = _state

    fun loadCollection() {
        val user = UserSession.currentUser ?: return
        val userId = user.id

        _state.value = CollectionUiState(isLoading = true)

        viewModelScope.launch {
            try {
                val interactedSet = interactionRepo.getInteractedLocationIds(userId).getOrNull() ?: emptySet()
                val allLocations = locationRepo.getActiveLocations().getOrNull() ?: emptyList()
                val filtered = allLocations.filter {
                    it.isActive && it.showInMap == true && it.virtualAssetId != null
                }

                // Batch fetch all virtual assets (fixes N+1 query)
                val assetIds = filtered.mapNotNull { it.virtualAssetId }.distinct()
                val assetMap = assetRepo.getByIds(assetIds).getOrNull() ?: emptyMap()

                val grouped = filtered.groupBy { it.section.toString() }
                val sections = grouped.map { (code, locations) ->
                    Section(
                        title = sectionLabels[code] ?: "Sin sección",
                        anchors = locations.mapNotNull { location ->
                            val asset = assetMap[location.virtualAssetId]
                            asset?.iconUrl?.let { iconPath ->
                                AnchorIcon(
                                    anchorId = location.id ?: "",
                                    iconUrl = iconPath,
                                    latitude = location.latitude,
                                    longitude = location.longitude,
                                    description = asset.name
                                )
                            }
                        }
                    )
                }

                val foundCount = filtered.count { it.id != null && it.id in interactedSet }
                _state.value = CollectionUiState(
                    sections = sections,
                    interactedIds = interactedSet,
                    totalCount = filtered.size,
                    foundCount = foundCount,
                    isCompleted = filtered.isNotEmpty() && foundCount >= filtered.size
                )
            } catch (e: Exception) {
                _state.value = CollectionUiState(
                    error = e.message ?: "Error al cargar colección"
                )
            }
        }
    }

    fun resetProgress() {
        val user = UserSession.currentUser ?: return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val interactions = interactionRepo.getUserInteractions(user.id).getOrNull() ?: emptyList()
                interactions.forEach { interaction ->
                    interaction.id?.let { interactionRepo.deleteInteraction(it) }
                }
                loadCollection()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error al reiniciar: ${e.message}"
                )
            }
        }
    }

    class Factory : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            CollectionViewModel() as T
    }
}
