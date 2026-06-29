package com.univalle.pedrochacolla.utils.ar

import android.content.Context
import android.view.MotionEvent
import android.widget.Toast
import androidx.lifecycle.LifecycleCoroutineScope
import com.google.ar.core.Anchor
import com.google.ar.core.HitResult
import com.google.ar.core.InstantPlacementPoint
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.univalle.pedrochacolla.data.model.SpatialData
import com.univalle.pedrochacolla.utils.config.ConfigManager
import timber.log.Timber
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.CloudAnchorNode
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ModelNode
import kotlinx.coroutines.launch

/**
 * AnchorManager - Manages anchor placement, transformation, and cloud hosting
 *
 * Responsibilities:
 * - Touch-based anchor placement with enhanced plane selection
 * - Anchor and model transformations (scale, rotation)
 * - Cloud anchor hosting with quality evaluation
 * - Spatial data capture for Virtual Point Space Map persistence
 * - Anchor node lifecycle management
 */
class AnchorManager(
    private val sceneView: ARSceneView,
    private val context: Context,
    private val lifecycleScope: LifecycleCoroutineScope
) {

    var cloudAnchorNode: CloudAnchorNode? = null
        private set

    var modelNode: ModelNode? = null
        private set

    /**
     * The intended model size in scene units (meters).
     * This is the `scaleToUnits` value that should be persisted and reused
     * when resolving the anchor later. NOT the same as `node.scale.x`
     * (which is an internal transform factor computed by SceneView).
     */
    var currentScaleToUnits: Float = DEFAULT_SCALE_TO_UNITS
        private set

    companion object {
        /** Default scaleToUnits for the initial cube model */
        const val DEFAULT_SCALE_TO_UNITS = 0.5f
    }

    /** Captured spatial data from the last anchor placement (used for backend persistence) */
    var lastCapturedSpatialData: SpatialData? = null
        private set

    /** The plane where the anchor was placed (used for spatial capture) */
    private var placementPlane: Plane? = null

    /** The hit result from placement (used for spatial capture) */
    private var placementHitResult: HitResult? = null

    /** Reference to PlaneEnhancer for quality-based placement */
    var planeEnhancer: PlaneEnhancer? = null

    /** Reference to SpatialMapper for capturing spatial context */
    var spatialMapper: SpatialMapper? = null

    // Callbacks for communicating with Fragment/ViewModel
    var onAnchorPlaced: ((Anchor) -> Unit)? = null
    var onAnchorHosted: ((cloudAnchorId: String, spatialData: SpatialData?) -> Unit)? = null
    var onAnchorHostingError: ((errorMessage: String) -> Unit)? = null
    var onPlacementQualityUpdate: ((PlaneEnhancer.PlacementQuality) -> Unit)? = null
    /**
     * Called each time the VPS scan readiness changes.
     * Float: 0.0–1.0 readiness score.
     * String: human-readable hint for the admin.
     */
    var onVpsReadinessUpdate: ((readiness: Float, hint: String) -> Unit)? = null

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR PLACEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Enable touch-to-place mode with enhanced plane quality evaluation.
     * User taps on a detected plane to place an anchor. The PlaneEnhancer
     * evaluates surface quality and provides feedback.
     *
     * @param acceptInstantPlacement When true, also accepts InstantPlacementPoint hits as
     *   fallback when a strict plane polygon hit is not available. Default false.
     * @param modelLoader Suspend function that loads the model node
     */
    fun enableAnchorPlacementMode(
        acceptInstantPlacement: Boolean = false,
        modelLoader: suspend () -> ModelNode?
    ) {
        sceneView.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                try {
                    val frame = sceneView.frame
                    if (frame == null) {
                        Timber.w("AnchorManager: frame es null – la sesión AR aún no inicia")
                        Toast.makeText(
                            context,
                            "La sesión AR se está iniciando, espera un momento…",
                            Toast.LENGTH_SHORT
                        ).show()
                        return@setOnTouchListener true
                    }

                    val trackingState = frame.camera.trackingState
                    if (trackingState != TrackingState.TRACKING) {
                        Timber.w("AnchorManager: cámara no rastreando – state=$trackingState")
                        Toast.makeText(
                            context,
                            "Mueve el teléfono lentamente para que la cámara ubique el espacio",
                            Toast.LENGTH_SHORT
                        ).show()
                        return@setOnTouchListener true
                    }

                    val hits = frame.hitTest(event.x, event.y)
                    Timber.d("AnchorManager: hitTest → ${hits.size} hits: ${hits.map { it.trackable::class.simpleName }}")

                    // Primary: strict plane polygon hit
                    val hit = hits.firstOrNull {
                        it.trackable is Plane && (it.trackable as Plane).isPoseInPolygon(it.hitPose)
                    }
                    // Fallback
                    ?: if (acceptInstantPlacement) {
                        hits.firstOrNull { it.trackable is Plane }
                            ?: hits.firstOrNull { it.trackable is InstantPlacementPoint }
                    } else null

                    if (hit != null) {
                        // Evaluate placement quality with PlaneEnhancer if available
                        val enhancer = planeEnhancer
                        val currentFrame = frame
                        if (enhancer != null && hit.trackable is Plane && currentFrame != null) {
                            val quality = enhancer.evaluatePlacement(
                                hit.trackable as Plane,
                                hit.hitPose,
                                currentFrame
                            )
                            onPlacementQualityUpdate?.invoke(quality)

                            if (quality.score < 0.3f) {
                                // Quality too low — warn user but still allow placement
                                Toast.makeText(
                                    context,
                                    quality.recommendation,
                                    Toast.LENGTH_SHORT
                                ).show()
                                Timber.w("AnchorManager: Low placement quality: ${quality.score}")
                            }
                        }

                        Timber.i("AnchorManager: ancla colocada via ${hit.trackable::class.simpleName}")
                        val anchor = hit.createAnchor()

                        // Store placement context for spatial capture
                        placementHitResult = hit
                        placementPlane = hit.trackable as? Plane

                        placeAnchorWithModel(anchor, modelLoader)

                        // Start VPS scan session immediately after placement
                        val mapper = spatialMapper
                        val currentSession = sceneView.session
                        if (mapper != null && currentSession != null) {
                            mapper.startScanSession(currentSession, frame, anchor.pose)
                            onVpsReadinessUpdate?.invoke(mapper.scanReadiness, mapper.scanReadinessHint)
                        }

                        onAnchorPlaced?.invoke(anchor)
                        disableAnchorPlacementMode()
                    } else {
                        Toast.makeText(
                            context,
                            "Apunta la cámara hacia el suelo y espera que aparezcan los planos",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                } catch (e: Exception) {
                    Timber.e(e, "AnchorManager: error en enableAnchorPlacementMode")
                    onAnchorHostingError?.invoke("Error al colocar ancla: ${e.message}")
                }
            }
            true
        }
    }

    /**
     * Disable touch-to-place mode
     */
    fun disableAnchorPlacementMode() {
        sceneView.setOnTouchListener(null)
    }

    /**
     * Place anchor with model at specified location
     *
     * @param anchor ARCore Anchor object
     * @param modelLoader Suspend function that loads the model node
     */
    private fun placeAnchorWithModel(anchor: Anchor, modelLoader: suspend () -> ModelNode?) {
        cloudAnchorNode = CloudAnchorNode(sceneView.engine, anchor).apply {
            // Prevent gesture-based transforms on the parent anchor node.
            // Only the child model should be adjustable, and only via FAB buttons.
            isEditable = false
            lifecycleScope.launch {
                val loaded = modelLoader()
                modelNode = loaded
                loaded?.let {
                    // Disable gesture-based scale/rotation on the model —
                    // these are controlled exclusively via FAB buttons so that
                    // currentScaleToUnits stays in sync with the visual.
                    it.isScaleEditable = false
                    it.isRotationEditable = false
                    addChildNode(it)
                    // Sync currentScaleToUnits from the model's actual scale,
                    // accounting for any adjustment (e.g. getRecommendedScale).
                    syncScaleFromNode(it)
                }
            }
        }
        cloudAnchorNode?.let { sceneView.addChildNode(it) }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR TRANSFORMATIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Scale up the model (multiply by factor)
     *
     * @param factor Scale multiplier (default 1.1 = 10% increase)
     */
    fun scaleUp(factor: Float = 1.1f) {
        modelNode?.let { node ->
            node.scale = node.scale.times(factor)
            currentScaleToUnits *= factor
        }
    }

    /**
     * Scale down the model (multiply by factor)
     *
     * @param factor Scale multiplier (default 0.9 = 10% decrease)
     */
    fun scaleDown(factor: Float = 0.9f) {
        modelNode?.let { node ->
            node.scale = node.scale.times(factor)
            currentScaleToUnits *= factor
        }
    }

    /**
     * Rotate model left (counter-clockwise on Y-axis)
     *
     * @param degrees Rotation amount in degrees (default 15)
     */
    fun rotateLeft(degrees: Float = 15f) {
        modelNode?.let { node ->
            val rot = node.rotation
            node.rotation = Rotation(rot.x, rot.y - degrees, rot.z)
        }
    }

    /**
     * Rotate model right (clockwise on Y-axis)
     *
     * @param degrees Rotation amount in degrees (default 15)
     */
    fun rotateRight(degrees: Float = 15f) {
        modelNode?.let { node ->
            val rot = node.rotation
            node.rotation = Rotation(rot.x, rot.y + degrees, rot.z)
        }
    }

    /**
     * Lock anchor and model to prevent further editing
     * Call this before hosting to cloud
     */
    fun lockForHosting() {
        modelNode?.apply {
            isEditable = false
            isPositionEditable = false
            isRotationEditable = false
            isScaleEditable = false
        }
        cloudAnchorNode?.isEditable = false
    }

    // ═══════════════════════════════════════════════════════════════
    // CLOUD ANCHOR HOSTING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Returns true when the VPS spatial map has collected enough data to upload.
     *
     * Standard mode : readiness ≥0.5 AND ≥5 sectors covered (≈225°).
     * Wall mode     : readiness ≥0.5 AND ≥3 sectors covered (≈135°) — a semicircle
     *   is already sufficient because the visitor can only approach from the front too.
     */
    fun isVpsReadyForHosting(): Boolean {
        val mapper = spatialMapper ?: return false
        val requiredSectors = if (mapper.wallMode) 3 else 5
        return mapper.scanReadiness >= 0.5f && mapper.angularSectorsCovered >= requiredSectors
    }

    /**
     * Feed a new AR frame into the active VPS scan session.
     * Only notifies the UI via [onVpsReadinessUpdate] when the frame was actually processed
     * (every 3rd frame) to avoid redundant UI work.
     */
    fun updateVpsScan() {
        val mapper = spatialMapper ?: return
        if (!mapper.isScanActive) return
        val session = sceneView.session ?: return
        val frame = sceneView.frame ?: return
        // updateScan returns true only when data actually changed
        if (mapper.updateScan(session, frame)) {
            onVpsReadinessUpdate?.invoke(mapper.scanReadiness, mapper.scanReadinessHint)
        }
    }

    /**
     * Host the cloud anchor to Google Cloud.
     * Also finalizes the VPS scan session and includes the spatial data.
     *
     * @param onProgress Optional callback for hosting progress updates
     */
    fun hostToCloud(onProgress: ((String) -> Unit)? = null) {
        val session = sceneView.session ?: run {
            onAnchorHostingError?.invoke("ARCore session not available")
            return
        }

        val cloudNode = cloudAnchorNode ?: run {
            onAnchorHostingError?.invoke("No anchor placed")
            return
        }

        // Refresh config from backend to get the latest TTL value,
        // then proceed with hosting on the main thread.
        lifecycleScope.launch {
            val refreshResult = ConfigManager.refresh()
            if (refreshResult.isFailure) {
                Timber.w("AnchorManager: Config refresh failed, using cached TTL")
            }
            performHosting(session, cloudNode, onProgress)
        }
    }

    /**
     * Internal: performs the actual cloud anchor hosting after config is refreshed.
     */
    private fun performHosting(
        session: Session,
        cloudNode: CloudAnchorNode,
        onProgress: ((String) -> Unit)?
    ) {
        try {
            // Capture spatial data BEFORE hosting (we have the live AR frame)
            captureSpatialData(session)

            // Create new anchor at current position
            val anchor = session.createAnchor(cloudNode.transform.toPose())
            cloudNode.anchor = anchor

            // Host to cloud with configurable TTL
            val ttlDays = ConfigManager.getCloudAnchorTtlDays()
            Timber.d("AnchorManager: Hosting cloud anchor with TTL=$ttlDays days")
            cloudNode.host(session, ttlDays) { cloudAnchorId, state ->
                onProgress?.invoke("Hosting: ${state.name}")

                if (state.isError) {
                    onAnchorHostingError?.invoke("Error al subir ancla: ${state.name}")
                    return@host
                }

                // Only react to the final SUCCESS state to prevent duplicate backend records.
                // Intermediate states (TASK_IN_PROGRESS, NONE) fire this callback too but
                // cloudAnchorId may not yet be valid and the anchor isn't ready to save.
                if (cloudAnchorId == null ||
                    state != com.google.ar.core.Anchor.CloudAnchorState.SUCCESS) {
                    return@host
                }

                // Final success — include spatial data for backend persistence
                onAnchorHosted?.invoke(cloudAnchorId, lastCapturedSpatialData)
            }
        } catch (e: Exception) {
            onAnchorHostingError?.invoke("Error al subir ancla: ${e.message}")
        }
    }

    /**
     * Finalize the VPS scan and store the result into [lastCapturedSpatialData].
     * GPS fields are enriched later by the Fragment.
     */
    private fun captureSpatialData(session: Session) {
        val mapper = spatialMapper ?: return

        try {
            // If a scan session is active, finalize it for a richer dataset.
            // If not, fall back to a one-shot capture.
            val capturedData = if (mapper.isScanActive) {
                mapper.finalizeScan()
            } else {
                val frame = sceneView.frame ?: return
                val anchor = cloudAnchorNode?.anchor ?: return
                mapper.captureSpatialData(session, frame, anchor.pose)
            }

            if (capturedData != null) {
                lastCapturedSpatialData = capturedData
                val quality = mapper.evaluateQuality(capturedData)
                Timber.i(
                    "AnchorManager: VPS data finalized — quality=%.2f, features=%d, version=%d",
                    quality, capturedData.featurePoints?.size ?: 0, capturedData.version
                )
            } else {
                Timber.w("AnchorManager: Failed to finalize VPS data")
            }
        } catch (e: Exception) {
            Timber.e(e, "AnchorManager: Exception finalizing VPS data")
        }
    }

    /**
     * Get current model transformations for persistence.
     *
     * Derives `scaleToUnits` from the model's **actual** node scale and bounding
     * box to guarantee accuracy even when untracked transform changes occurred
     * (e.g. gesture-based edits, parent-node scaling, or getRecommendedScale
     * adjustments). Falls back to the tracked [currentScaleToUnits] when the
     * bounding box is unavailable.
     *
     * Returns safe fallback values (scale=DEFAULT, rotY=0.0) if the model
     * hasn't finished loading yet or SceneView returns NaN/Inf.
     */
    fun getModelTransform(): Pair<Float, Float> {
        val node = modelNode
        val rawRotY = node?.rotation?.y ?: 0.0f
        val rotY = if (rawRotY.isFinite()) rawRotY else 0.0f

        // Derive effective scaleToUnits from the node's actual local scale and
        // its model-space bounding box.  scaleToUnitCube(S) sets:
        //   node.scale = S / (2 * maxHalfExtent)
        // Therefore:  S = node.scale.x * 2 * maxHalfExtent
        val derivedScale = deriveScaleToUnits(node)
        val scale = when {
            derivedScale != null && derivedScale.isFinite() && derivedScale > 0f -> derivedScale
            currentScaleToUnits.isFinite() && currentScaleToUnits > 0f -> currentScaleToUnits
            else -> DEFAULT_SCALE_TO_UNITS
        }

        Timber.d("getModelTransform: derived=%.4f tracked=%.4f → used=%.4f, rotY=%.1f",
            derivedScale ?: -1f, currentScaleToUnits, scale, rotY)

        return Pair(scale, rotY)
    }

    /**
     * Derive `scaleToUnits` from a [ModelNode]'s current local scale and its
     * model-space bounding box.  Returns `null` if the bounding box info is
     * unavailable (model still loading).
     */
    private fun deriveScaleToUnits(node: ModelNode?): Float? {
        if (node == null) return null
        val he = node.halfExtent ?: return null
        val maxH = maxOf(he.x, he.y, he.z)
        if (maxH <= 0f) return null
        val derived = node.scale.x * 2f * maxH
        return if (derived.isFinite() && derived > 0f) derived else null
    }

    /**
     * Synchronise [currentScaleToUnits] with a [ModelNode]'s actual state.
     * Call after the model is first placed or replaced so that the tracked
     * value matches the real visual size (which may have been adjusted by
     * [ArPerformanceManager.getRecommendedScale]).
     */
    private fun syncScaleFromNode(node: ModelNode) {
        val derived = deriveScaleToUnits(node)
        if (derived != null && derived.isFinite() && derived > 0f) {
            Timber.d("syncScaleFromNode: updating currentScaleToUnits %.4f → %.4f",
                currentScaleToUnits, derived)
            currentScaleToUnits = derived
        }
    }

    /**
     * Set the tracked scaleToUnits value.
     * Called when replacing the model to preserve the intended visual size.
     */
    fun setScaleToUnits(scaleToUnits: Float) {
        currentScaleToUnits = if (scaleToUnits.isFinite() && scaleToUnits > 0f)
            scaleToUnits else DEFAULT_SCALE_TO_UNITS
    }

    /**
     * Replace the current model node with a new one.
     * Used when admin selects a different animal model during anchor editing.
     * Preserves the anchor position — only swaps the visual model.
     */
    fun replaceModel(newModelNode: ModelNode) {
        val cloud = cloudAnchorNode ?: return
        modelNode?.let { cloud.removeChildNode(it) }
        modelNode = newModelNode
        // Ensure gestures cannot desync the tracked scale
        newModelNode.isScaleEditable = false
        newModelNode.isRotationEditable = false
        cloud.addChildNode(newModelNode)
        // Sync tracked value from the model's actual scale & bounding box
        syncScaleFromNode(newModelNode)
        Timber.d("replaceModel: currentScaleToUnits=%.4f nodeScale=(%.4f,%.4f,%.4f)",
            currentScaleToUnits,
            newModelNode.scale.x, newModelNode.scale.y, newModelNode.scale.z)
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    /**
     * Remove anchor and model from scene
     * Call when user cancels or needs to start over
     */
    fun clear() {
        cloudAnchorNode?.let { sceneView.removeChildNode(it) }
        cloudAnchorNode = null
        modelNode = null
        currentScaleToUnits = DEFAULT_SCALE_TO_UNITS
        lastCapturedSpatialData = null
        placementPlane = null
        placementHitResult = null
        // Reset the spatial mapper so stale scan data never bleeds into the next anchor session
        spatialMapper?.reset()
    }
}

/**
 * Convert a SceneView Transform to an ARCore Pose.
 * The SceneView rotation is Euler degrees (XYZ). We promote only the Y component
 * to a proper unit quaternion (a Y-axis rotation by angle θ is [0, sin(θ/2), 0, cos(θ/2)]).
 */
private fun io.github.sceneview.math.Transform.toPose(): Pose {
    val translation = this.position
    val halfRadY = Math.toRadians(this.rotation.y.toDouble()).toFloat() / 2f
    val sinY = kotlin.math.sin(halfRadY)
    val cosY = kotlin.math.cos(halfRadY)
    return Pose(
        floatArrayOf(translation.x, translation.y, translation.z),
        floatArrayOf(0f, sinY, 0f, cosY)   // unit quaternion for Y-axis rotation
    )
}
