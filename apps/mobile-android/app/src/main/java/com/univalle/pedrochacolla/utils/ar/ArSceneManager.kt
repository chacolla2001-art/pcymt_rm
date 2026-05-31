package com.univalle.pedrochacolla.utils.ar

import android.content.Context
import androidx.lifecycle.LifecycleOwner
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.math.Position
import io.github.sceneview.node.ModelNode
import timber.log.Timber

/**
 * ArSceneManager - Manages ARCore scene configuration and setup
 *
 * Responsibilities:
 * - ARCore session configuration (Cloud Anchors, Depth, Lighting)
 * - Scene lifecycle management
 * - Model loading and instantiation
 * - Plane renderer visibility
 * - Integration with DepthProcessor, PlaneEnhancer, and ArPerformanceManager
 */
class ArSceneManager(private val sceneView: ARSceneView) {

    /** Enhanced depth processor for occlusion and surface analysis */
    val depthProcessor = DepthProcessor()

    /** Enhanced plane detection with merging and stability tracking */
    val planeEnhancer = PlaneEnhancer()

    /** Spatial mapper for Virtual Point Space Map persistence */
    val spatialMapper = SpatialMapper()

    /** Performance manager (initialized lazily with context) */
    var performanceManager: ArPerformanceManager? = null
        private set

    /** Whether depth mode was successfully enabled */
    var isDepthEnabled = false
        private set

    /** Frame counter for periodic operations */
    private var frameCounter = 0

    /** Last processed AR frame (used for VPS spatial matching on visitor side) */
    var lastFrame: Frame? = null
        private set

    /**
     * Configure ARCore session with optimal settings for AUGMENT-like experience.
     *
     * @param lifecycleOwner Lifecycle owner for scene lifecycle management
     * @param showPlanes Whether to show plane detection (typically only for admin users)
     * @param context Application context for performance tier detection
     * @param enableCloudAnchors Whether to enable cloud anchors (admin mode)
     */
    fun configureScene(
        lifecycleOwner: LifecycleOwner,
        showPlanes: Boolean = false,
        context: Context? = null,
        enableCloudAnchors: Boolean = true
    ) {
        // Initialize performance manager if context is provided
        if (context != null && performanceManager == null) {
            performanceManager = ArPerformanceManager(context).also { it.detectTier() }
        }

        val perfManager = performanceManager

        sceneView.apply {
            lifecycle = lifecycleOwner.lifecycle

            // Configure ARCore session with enhanced settings
            configureSession { session, config ->
                // Cloud Anchors — enable for admin placement, visitor resolution
                config.cloudAnchorMode = if (enableCloudAnchors)
                    Config.CloudAnchorMode.ENABLED
                else
                    Config.CloudAnchorMode.DISABLED

                // Disable instant placement for more accurate, stable placement
                config.instantPlacementMode = Config.InstantPlacementMode.DISABLED

                // DEPTH MODE — core enhancement for AUGMENT-like experience
                // Enables depth-based occlusion, better surface detection
                config.depthMode = if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                    isDepthEnabled = true
                    Config.DepthMode.AUTOMATIC
                } else {
                    isDepthEnabled = false
                    Config.DepthMode.DISABLED
                }

                // PLANE FINDING — detect both horizontal and vertical planes
                config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL

                // LIGHTING — adapt based on device capabilities
                config.lightEstimationMode = if (perfManager?.shouldUseHdrLighting() != false) {
                    Config.LightEstimationMode.ENVIRONMENTAL_HDR
                } else {
                    Config.LightEstimationMode.AMBIENT_INTENSITY
                }

                // Initialize depth processor
                if (isDepthEnabled) {
                    depthProcessor.initialize(session)
                    Timber.i("ArSceneManager: Depth enabled (AUTOMATIC)")
                } else {
                    Timber.i("ArSceneManager: Depth disabled (not supported)")
                }
            }

            // Control plane visualization
            planeRenderer.isVisible = showPlanes

            // Apply performance configuration
            perfManager?.configure(this)
        }

        Timber.i(
            "ArSceneManager: Configured — depth=%s, clouds=%s, planes=%s, tier=%s",
            isDepthEnabled, enableCloudAnchors, showPlanes, perfManager?.currentTier
        )
    }

    /**
     * Process a frame update — call from onSessionUpdated.
     * Runs enhanced plane detection and performance monitoring.
     *
     * @param session Active ARCore session
     * @param frame Current AR frame
     * @return List of enhanced planes (sorted by quality, best first)
     */
    fun onFrameUpdate(session: Session, frame: Frame): List<PlaneEnhancer.EnhancedPlane> {
        lastFrame = frame
        frameCounter++

        // Monitor performance
        performanceManager?.onFrameUpdate()

        // Process enhanced planes
        val enhancedPlanes = planeEnhancer.processFrame(session, frame)

        // Periodic cleanup every ~2 seconds (at 30fps)
        if (frameCounter % 60 == 0) {
            planeEnhancer.cleanup()
        }

        return enhancedPlanes
    }

    /**
     * Load a 3D model from assets and create a ModelNode
     */
    suspend fun loadModelNode(
        modelPath: String,
        scaleToUnits: Float = 0.5f,
        centerOffset: Float = -0.5f,
        isEditable: Boolean = true
    ): ModelNode? {
        val modelInstance = sceneView.modelLoader.loadModelInstance(modelPath)
            ?: return null

        val adjustedScale = performanceManager?.getRecommendedScale(scaleToUnits) ?: scaleToUnits

        return ModelNode(
            modelInstance = modelInstance,
            scaleToUnits = adjustedScale,
            centerOrigin = Position(y = centerOffset)
        ).apply {
            this.isEditable = isEditable
        }
    }

    /**
     * Load the default cube model
     */
    suspend fun loadDefaultModel(isEditable: Boolean = true): ModelNode? {
        return loadModelNode(
            modelPath = "models/cube.glb",
            scaleToUnits = 0.5f,
            centerOffset = -0.5f,
            isEditable = isEditable
        )
    }

    /**
     * Reset all enhanced processors. Call when restarting the AR experience.
     */
    fun resetProcessors() {
        depthProcessor.reset()
        planeEnhancer.reset()
        spatialMapper.reset()
        performanceManager?.reset()
        frameCounter = 0
    }

    fun getSession() = sceneView.session
    fun getSceneView() = sceneView
}
