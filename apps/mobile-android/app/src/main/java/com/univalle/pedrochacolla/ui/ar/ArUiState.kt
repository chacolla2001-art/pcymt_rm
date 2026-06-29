package com.univalle.pedrochacolla.ui.ar

import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.SpatialData
import com.univalle.pedrochacolla.data.model.VirtualAsset

/**
 * ArUiState - Represents all possible states of the AR screen
 * Used with StateFlow for reactive UI updates
 *
 * Placement flow (admin — one anchor at a time):
 *   Idle → WaitingForAnchorPlacement → [tap surface] → EditingAnchor
 *       → ["Subir ancla"] → CapturingQuality (if VPS insufficient) or direct host
 *       → Loading → AnchorHostingSuccess → Idle (repeat for next anchor)
 */
sealed class ArUiState {
    object Idle : ArUiState()

    data class Loading(val message: String = "Cargando...") : ArUiState()

    object WaitingForAnchorPlacement : ArUiState()

    /**
     * Admin placed a cube on a surface and is now editing scale/rotation
     * while scanning 360° around the anchor (VPS data collection).
     */
    object EditingAnchor : ArUiState()

    data class CapturingQuality(val progress: Int) : ArUiState()

    data class SearchingForAnchors(val message: String = "Buscando anclas disponibles...") : ArUiState()

    data class AnchorsLoaded(val anchors: List<ResolvedAnchor>) : ArUiState()

    data class AnchorHostingSuccess(val cloudAnchorId: String) : ArUiState()

    data class Error(val message: String) : ArUiState()
}

/**
 * ResolvedAnchor - Combines Location, VirtualAsset, and interaction status
 * Pre-resolved to avoid N+1 queries
 */
data class ResolvedAnchor(
    val location: Location,
    val asset: VirtualAsset?,
    val isInteracted: Boolean
)


