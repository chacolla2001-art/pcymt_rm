package com.univalle.pedrochacolla.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.ar.InteractionTracker
import com.univalle.pedrochacolla.utils.session.UserSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Represents one animal badge in the home game screen trophy strip.
 * @param isFound true if the user has interacted with at least one of its locations.
 */
data class AnimalTrophy(
    val id: String,
    val name: String,
    val iconUrl: String?,
    val isFound: Boolean
)

data class StatsUiState(
    val isLoading: Boolean = false,
    val userName: String = "invitado",
    val foundCount: Int = 0,
    val totalCount: Int = 0,
    val allFound: Boolean = false,
    val animals: List<AnimalTrophy> = emptyList(),
    val error: String? = null,
    val isResetting: Boolean = false,
    val resetSuccess: Boolean = false
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val locationRepo: LocationRepository,
    private val interactionRepo: InteractionRepository,
    private val assetRepo: VirtualAssetRepository
) : ViewModel() {

    private val _state = MutableStateFlow(StatsUiState())
    val state: StateFlow<StatsUiState> = _state

    fun loadStats() {
        val user = UserSession.currentUser ?: return
        val userId = user.id
        val name = user.name.takeIf { it.isNotBlank() } ?: user.email.substringBefore("@")

        _state.value = StatsUiState(isLoading = true, userName = name)

        viewModelScope.launch {
            try {
                val locationsResult  = locationRepo.getActiveLocations()
                val interactedResult = interactionRepo.getInteractedLocationIds(userId)
                val assetsResult     = assetRepo.getActive()

                if (locationsResult.isSuccess && interactedResult.isSuccess) {
                    val allLocations = locationsResult.getOrNull() ?: emptyList()
                    val visibleLocations = allLocations.filter { it.isActive && it.showInMap == true }
                    val interactedIds    = interactedResult.getOrNull() ?: emptySet()
                    val foundCount       = visibleLocations.count { it.id in interactedIds }

                    // Build trophy list: one badge per unique virtual asset
                    val assets = assetsResult.getOrNull() ?: emptyList()

                    // Map assetId → set of location IDs that belong to it
                    val assetToLocationIds: Map<String, Set<String>> = visibleLocations
                        .filter { it.virtualAssetId != null }
                        .groupBy { it.virtualAssetId!! }
                        .mapValues { (_, locs) -> locs.mapNotNull { it.id }.toSet() }

                    val trophies = assets
                        .filter { it.isActive && it.id != null }
                        .sortedBy { it.displayOrder ?: 0 }
                        .map { asset ->
                            val locIds = assetToLocationIds[asset.id!!] ?: emptySet()
                            AnimalTrophy(
                                id      = asset.id,
                                name    = asset.name,
                                iconUrl = asset.iconUrl,
                                isFound = locIds.any { it in interactedIds }
                            )
                        }

                    val allFound = trophies.isNotEmpty() && trophies.all { it.isFound }

                    _state.value = StatsUiState(
                        userName   = name,
                        foundCount = foundCount,
                        totalCount = visibleLocations.size,
                        animals    = trophies,
                        allFound   = allFound
                    )
                } else {
                    val error = locationsResult.exceptionOrNull() ?: interactedResult.exceptionOrNull()
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = error?.message ?: "Error al cargar estadísticas"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = e.message ?: "Error inesperado al cargar estadísticas"
                )
            }
        }
    }

    fun resetGame() {
        val userId = UserSession.currentUser?.id ?: return
        // Immediately clear allFound so the overlay hides before the network call
        _state.value = _state.value.copy(isResetting = true, resetSuccess = false, allFound = false, error = null)
        viewModelScope.launch {
            try {
                val result = interactionRepo.resetGame(userId)
                if (result.isSuccess) {
                    // Clear local SharedPreferences deduplication cache so
                    // all locations can be re-recorded immediately after reset
                    InteractionTracker.clearAll()
                    // loadStats() overwrites the entire state (isLoading=true, allFound=false)
                    loadStats()
                } else {
                    _state.value = _state.value.copy(
                        isResetting = false,
                        allFound = false,
                        error = result.exceptionOrNull()?.message ?: "Error al reiniciar el juego"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isResetting = false,
                    allFound = false,
                    error = e.message ?: "Error inesperado al reiniciar el juego"
                )
            }
        }
    }

    /** Call this from the fragment after the error has been shown to the user. */
    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}

