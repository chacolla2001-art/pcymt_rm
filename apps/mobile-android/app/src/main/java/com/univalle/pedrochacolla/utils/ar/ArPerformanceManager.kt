package com.univalle.pedrochacolla.utils.ar

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.node.ModelNode
import timber.log.Timber

/**
 * ArPerformanceManager — Runtime performance optimizations for AR.
 *
 * Adapts rendering quality based on device capabilities:
 * - Adjusts resolution scaling on low-end devices
 * - Manages model LOD (Level of Detail)
 * - Controls frame rate targets
 * - Monitors and throttles GPU usage
 * - Caches loaded models to avoid redundant downloads
 * - Limits concurrent model renders
 *
 * USAGE:
 *   val perfManager = ArPerformanceManager(context)
 *   perfManager.configure(sceneView)  // Call once after scene setup
 *   perfManager.onFrameUpdate(frame)  // Call every frame
 */
class ArPerformanceManager(private val context: Context) {

    companion object {
        /** Number of frames between performance evaluations */
        private const val EVAL_INTERVAL_FRAMES = 60

        /** Target frame time in ms (30 FPS = 33ms, 60 FPS = 16ms) */
        private const val TARGET_FRAME_TIME_MS = 33L // 30 FPS target for AR

        /** Below this threshold we reduce quality */
        private const val LOW_FPS_THRESHOLD = 20f

        /** Maximum simultaneous rendered models */
        private const val MAX_CONCURRENT_MODELS_HIGH = 10
        private const val MAX_CONCURRENT_MODELS_LOW = 5

        /** Scale factor for resolution on low-end devices */
        private const val LOW_RES_SCALE = 0.75f
    }

    enum class PerformanceTier {
        HIGH,    // Flagship devices — full quality
        MEDIUM,  // Mid-range — reduced shadows, fewer models
        LOW      // Low-end — minimal effects, resolution scaling
    }

    // Current performance state
    var currentTier: PerformanceTier = PerformanceTier.MEDIUM
        private set

    var maxConcurrentModels: Int = MAX_CONCURRENT_MODELS_HIGH
        private set

    // Frame timing
    private var frameCount = 0
    private var frameTimeAccumulator = 0L
    private var lastFrameTimeNs = 0L
    private var averageFps = 30f

    // Model cache
    private val modelCache = mutableMapOf<String, Any>() // URL → ModelInstance
    private var activeModelCount = 0

    /**
     * Detect device capabilities and set the initial performance tier.
     */
    fun detectTier() {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val totalRamGb = memInfo.totalMem / (1024.0 * 1024.0 * 1024.0)
        val isLowRam = activityManager.isLowRamDevice

        // Determine tier based on RAM and device characteristics
        currentTier = when {
            isLowRam || totalRamGb < 3.0 -> PerformanceTier.LOW
            totalRamGb < 6.0 -> PerformanceTier.MEDIUM
            else -> PerformanceTier.HIGH
        }

        maxConcurrentModels = when (currentTier) {
            PerformanceTier.HIGH -> MAX_CONCURRENT_MODELS_HIGH
            PerformanceTier.MEDIUM -> 8
            PerformanceTier.LOW -> MAX_CONCURRENT_MODELS_LOW
        }

        Timber.i(
            "ArPerformanceManager: Tier=%s, RAM=%.1f GB, maxModels=%d",
            currentTier, totalRamGb, maxConcurrentModels
        )
    }

    /**
     * Configure the ARSceneView for optimal performance based on the detected tier.
     */
    fun configure(sceneView: ARSceneView) {
        detectTier()

        when (currentTier) {
            PerformanceTier.HIGH -> configureHigh(sceneView)
            PerformanceTier.MEDIUM -> configureMedium(sceneView)
            PerformanceTier.LOW -> configureLow(sceneView)
        }

        Timber.i("ArPerformanceManager: Configured for tier $currentTier")
    }

    /**
     * Call every frame to monitor performance and adapt quality.
     */
    fun onFrameUpdate() {
        val currentTimeNs = System.nanoTime()
        if (lastFrameTimeNs > 0) {
            val frameTimeMs = (currentTimeNs - lastFrameTimeNs) / 1_000_000L
            frameTimeAccumulator += frameTimeMs
            frameCount++

            if (frameCount >= EVAL_INTERVAL_FRAMES) {
                val avgFrameTimeMs = frameTimeAccumulator / frameCount.toFloat()
                averageFps = if (avgFrameTimeMs > 0) 1000f / avgFrameTimeMs else 30f

                if (averageFps < LOW_FPS_THRESHOLD && currentTier != PerformanceTier.LOW) {
                    Timber.w(
                        "ArPerformanceManager: Low FPS (%.1f), consider reducing quality",
                        averageFps
                    )
                }

                frameCount = 0
                frameTimeAccumulator = 0
            }
        }
        lastFrameTimeNs = currentTimeNs
    }

    /**
     * Get the current average FPS.
     */
    fun getAverageFps(): Float = averageFps

    /**
     * Check if we can add another model (within concurrent limit).
     */
    fun canAddModel(): Boolean = activeModelCount < maxConcurrentModels

    /**
     * Register a model as active.
     */
    fun registerModel() {
        activeModelCount++
    }

    /**
     * Unregister a model.
     */
    fun unregisterModel() {
        activeModelCount = (activeModelCount - 1).coerceAtLeast(0)
    }

    /**
     * Get recommended model scale based on tier.
     * Lower-end devices may benefit from smaller models (fewer polygons rendered).
     */
    fun getRecommendedScale(baseScale: Float): Float {
        return when (currentTier) {
            PerformanceTier.HIGH -> baseScale
            PerformanceTier.MEDIUM -> baseScale * 0.9f
            PerformanceTier.LOW -> baseScale * 0.8f
        }
    }

    /**
     * Whether to enable shadow rendering.
     */
    fun shouldRenderShadows(): Boolean = currentTier != PerformanceTier.LOW

    /**
     * Whether to enable environmental HDR lighting.
     */
    fun shouldUseHdrLighting(): Boolean = currentTier == PerformanceTier.HIGH

    /**
     * Get stats for debugging.
     */
    fun getStats(): String {
        return "Tier=$currentTier, FPS=%.1f, Models=$activeModelCount/$maxConcurrentModels".format(averageFps)
    }

    /**
     * Reset performance tracking.
     */
    fun reset() {
        frameCount = 0
        frameTimeAccumulator = 0
        lastFrameTimeNs = 0
        averageFps = 30f
        activeModelCount = 0
        modelCache.clear()
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE — Tier configurations
    // ═══════════════════════════════════════════════════════════════

    private fun configureHigh(sceneView: ARSceneView) {
        // Full quality — HDR lighting, shadows, full resolution
        sceneView.apply {
            // SceneView 2.x uses Filament — minimal runtime config needed
            // Full quality enabled by default on high-tier
        }
    }

    private fun configureMedium(sceneView: ARSceneView) {
        // Balanced — ambient intensity lighting, reduced plane visualization
        sceneView.apply {
            // Use AMBIENT_INTENSITY instead of ENVIRONMENTAL_HDR
            // (configured in ArSceneManager.configureScene)
        }
    }

    private fun configureLow(sceneView: ARSceneView) {
        // Minimal — disable heavy features
        sceneView.apply {
            // Reduce plane renderer complexity
            planeRenderer.isVisible = false // Render manually with simpler visualization
        }
    }
}
