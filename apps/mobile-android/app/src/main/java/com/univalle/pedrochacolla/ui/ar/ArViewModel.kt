package com.univalle.pedrochacolla.ui.ar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.Interaction
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.SpatialData
import com.univalle.pedrochacolla.data.model.VirtualAsset
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.ar.RemoteAnchorResolver
import com.univalle.pedrochacolla.utils.session.UserSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ArViewModel - Manages AR screen state and business logic
 *
 * Responsibilities:
 * - State management with StateFlow
 * - Repository coordination (locations, assets, interactions)
 * - Anchor hosting/resolving logic
 * - Feature map quality evaluation
 *
 * Note: Actual ARCore operations (scene management, anchor nodes, etc.)
 * are delegated to specialized components in utils/ar/
 */
@HiltViewModel
class ArViewModel @Inject constructor(
    private val locationRepo: LocationRepository,
    private val assetRepo: VirtualAssetRepository,
    private val interactionRepo: InteractionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArUiState>(ArUiState.Idle)
    val uiState: StateFlow<ArUiState> = _uiState

    // Tracks how many anchors have been hosted in this session (for the success banner)
    private val _hostedCount = MutableStateFlow(0)
    val hostedCount: StateFlow<Int> = _hostedCount

    // Available virtual assets for the animal picker (admin AR flow)
    private val _virtualAssets = MutableStateFlow<List<VirtualAsset>>(emptyList())
    val virtualAssets: StateFlow<List<VirtualAsset>> = _virtualAssets

    // Remote anchor resolver with batch loading (fixes N+1 bug)
    private val anchorResolver = RemoteAnchorResolver(locationRepo, assetRepo, interactionRepo)

    // Current user for interactions
    private val currentUserId: String?
        get() = UserSession.currentUser?.id

    init {
        Timber.d("ArViewModel initialized")
        loadVirtualAssets()
    }

    /** Pre-load active virtual assets so the animal picker is ready when needed */
    private fun loadVirtualAssets() {
        viewModelScope.launch {
            assetRepo.getActive()
                .onSuccess { assets ->
                    _virtualAssets.value = assets.sortedBy { it.displayOrder }
                    Timber.d("loadVirtualAssets: loaded ${assets.size} assets")
                }
                .onFailure { e ->
                    Timber.w(e, "loadVirtualAssets: failed to fetch assets (picker will be empty)")
                }
        }
    }

    /**
     * Public refresh so the Fragment can trigger a reload when the picker is opened
     * and data hasn't arrived yet (race condition between init load and user tap).
     */
    fun refreshVirtualAssets() {
        loadVirtualAssets()
    }

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR RESOLVING (Fix N+1 query bug with batch loading)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Load and resolve all remote anchors using RemoteAnchorResolver
     * PERFORMANCE: 3 API calls total (fixes N+1 bug)
     */
    fun loadRemoteAnchors() {
        val userId = currentUserId
        if (userId == null) {
            Timber.w("loadRemoteAnchors: User not authenticated")
            _uiState.value = ArUiState.Error("Usuario no autenticado")
            return
        }

        Timber.d("loadRemoteAnchors: Starting to load anchors for user=$userId")
        viewModelScope.launch {
            _uiState.value = ArUiState.SearchingForAnchors()
            Timber.d("loadRemoteAnchors: State -> SearchingForAnchors")

            anchorResolver.loadAndResolveAnchors(userId)
                .onSuccess { resolved ->
                    Timber.i("loadRemoteAnchors: Success - loaded ${resolved.size} anchors")
                    Timber.d("loadRemoteAnchors: Anchors - ${resolved.joinToString { it.location.anchorCode ?: "" }}")
                    _uiState.value = ArUiState.AnchorsLoaded(resolved)
                    Timber.d("loadRemoteAnchors: State -> AnchorsLoaded")
                }
                .onFailure { error ->
                    Timber.e(error, "loadRemoteAnchors: Failed to load anchors")
                    _uiState.value = ArUiState.Error(error.message ?: "Error al cargar anclas")
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR HOSTING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Start anchor hosting mode
     * UI should display placement instructions and enable tap-to-place
     */
    fun startAnchorPlacementMode() {
        Timber.d("startAnchorPlacementMode: Entering anchor placement mode")
        _uiState.value = ArUiState.WaitingForAnchorPlacement
        Timber.d("startAnchorPlacementMode: State -> WaitingForAnchorPlacement")
    }

    /**
     * Called when user taps a surface and a cube is placed.
     * Transitions to [ArUiState.EditingAnchor] so the admin can adjust
     * scale/rotation while the VPS 360° scan accumulates data.
     */
    fun onAnchorPlacedInScene() {
        Timber.i("onAnchorPlacedInScene: cube placed")
        _uiState.value = ArUiState.EditingAnchor
        Timber.d("onAnchorPlacedInScene: State -> EditingAnchor")
    }

    /**
     * Called when the admin taps "Subir ancla" but VPS readiness is still insufficient.
     * Transitions to [ArUiState.CapturingQuality] to keep scanning.
     *
     * @param progress Current VPS readiness percentage (0–100)
     */
    fun startQualityCapture(progress: Int = 0) {
        Timber.d("startQualityCapture: Entering VPS quality capture (progress=${progress}%)")
        _uiState.value = ArUiState.CapturingQuality(progress)
        Timber.d("startQualityCapture: State -> CapturingQuality")
    }

    /**
     * Update the feature-map quality from a string label and transition to
     * [ArUiState.CapturingQuality]. Kept for compatibility with legacy call-sites and tests
     * that pass quality as "INSUFFICIENT" / "SUFFICIENT" / "GOOD".
     */
    fun updateFeatureMapQuality(quality: String) {
        Timber.d("updateFeatureMapQuality: quality=$quality")
        val progress = when (quality.uppercase()) {
            "GOOD"       -> 80
            "SUFFICIENT" -> 60
            else         -> 20  // INSUFFICIENT or unknown
        }
        startQualityCapture(progress)
    }

    /**
     * Single-anchor backend save.
     */
    fun onAnchorHostedToCloud(
        cloudAnchorId: String,
        virtualAssetId: String?,
        latitude: Double,
        longitude: Double,
        scale: Float = 1.0f,
        rotationY: Float = 0.0f,
        spatialData: SpatialData? = null
    ) {
        Timber.i("onAnchorHostedToCloud: Cloud anchor hosted - id=$cloudAnchorId, lat=$latitude, lng=$longitude, scale=$scale, rotY=$rotationY, hasSpatial=${spatialData != null}")
        viewModelScope.launch {
            _uiState.value = ArUiState.Loading("Guardando ubicación...")
            Timber.d("onAnchorHostedToCloud: State -> Loading")

            val location = Location(
                id = null,
                name = "AR Anchor",
                anchorCode = cloudAnchorId,
                virtualAssetId = virtualAssetId,
                latitude = latitude,
                longitude = longitude,
                scale = scale,
                rotationY = rotationY,
                spatialData = spatialData,
                isActive = true,
                createdAt = null,
                updatedAt = null
            )

            locationRepo.createLocation(location)
                .onSuccess {
                    Timber.i("onAnchorHostedToCloud: Success - location saved to backend")
                    _hostedCount.value++
                    _uiState.value = ArUiState.AnchorHostingSuccess(cloudAnchorId)
                    Timber.d("onAnchorHostedToCloud: State -> AnchorHostingSuccess")
                }
                .onFailure {
                    Timber.e(it, "onAnchorHostedToCloud: Failed to save location")
                    _uiState.value = ArUiState.Error(
                        "Error al guardar: ${it.message}"
                    )
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERACTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Record user interaction with a virtual asset at a location
     */
    fun recordInteraction(locationId: String?, virtualAssetId: String?) {
        val userId = currentUserId ?: return

        Timber.d("recordInteraction: Recording interaction - userId=$userId, locationId=$locationId, assetId=$virtualAssetId")
        viewModelScope.launch {
            val interaction = Interaction(
                id = null,
                userId = userId,
                locationId = locationId?.takeIf { it.isNotBlank() },
                virtualAssetId = virtualAssetId?.takeIf { it.isNotBlank() },
                interactionType = "view",
                createdAt = null,
                metadata = null
            )

            interactionRepo.createInteraction(interaction)
                .onSuccess {
                    Timber.i("recordInteraction: Success - interaction recorded")
                    // Optionally reload anchors to update interaction status
                    // loadRemoteAnchors()
                }
                .onFailure {
                    Timber.w(it, "recordInteraction: Failed to record interaction (non-blocking)")
                    // Log error but don't block user experience
                    // Could show a subtle toast
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Reset to idle state
     */
    fun resetToIdle() {
        Timber.d("resetToIdle: Resetting to idle state")
        _hostedCount.value = 0
        _uiState.value = ArUiState.Idle
        Timber.d("resetToIdle: State -> Idle")
    }

    /**
     * Set error state
     */
    fun setError(message: String) {
        Timber.e("setError: Error state set - $message")
        _uiState.value = ArUiState.Error(message)
    }
}
