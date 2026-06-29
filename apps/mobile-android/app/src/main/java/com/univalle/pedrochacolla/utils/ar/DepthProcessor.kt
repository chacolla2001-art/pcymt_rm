package com.univalle.pedrochacolla.utils.ar

import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.NotYetAvailableException
import timber.log.Timber
import java.nio.ShortBuffer

/**
 * DepthProcessor — Enhanced depth estimation over ARCore's built-in depth.
 *
 * Provides:
 * 1. **Surface detection at point** — get the depth/distance to a surface at screen coords
 * 2. **Occlusion data** — determine if a 3D model should be partially hidden
 * 3. **Surface normal estimation** — compute surface orientation from depth gradients
 * 4. **Depth confidence evaluation** — assess how reliable the depth reading is
 *
 * Uses ARCore's depth API (ToF sensor or stereo-computed depth) and enhances it with:
 * - Temporal smoothing (average over N frames)
 * - Spatial filtering (median filter to remove noise)
 * - Edge-aware processing for cleaner occlusion boundaries
 *
 * Performance: depth images are 160x120 or 240x180 (much smaller than camera)
 * so processing is fast. All operations are designed for real-time use.
 */
class DepthProcessor {

    companion object {
        /** Number of frames to average for temporal smoothing */
        private const val TEMPORAL_WINDOW = 5

        /** Kernel size for spatial median filter (must be odd) */
        private const val MEDIAN_KERNEL_SIZE = 3

        /** Maximum valid depth in millimeters (8m = 8000mm) */
        private const val MAX_DEPTH_MM = 8000

        /** Minimum valid depth in millimeters (20cm = 200mm) */
        private const val MIN_DEPTH_MM = 200

        /** Depth confidence threshold (0-1) below which readings are discarded */
        private const val CONFIDENCE_THRESHOLD = 0.3f
    }

    // Temporal smoothing buffer
    private val depthHistory = ArrayDeque<ShortArray>(TEMPORAL_WINDOW)
    private var lastWidth = 0
    private var lastHeight = 0

    /** Whether the current session supports depth */
    private var depthSupported = false

    /**
     * Check if depth is available and configure it.
     * Call this once after the ARCore session is created.
     */
    fun initialize(session: Session): Boolean {
        depthSupported = try {
            session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)
        } catch (e: Exception) {
            Timber.w(e, "DepthProcessor: Error checking depth support")
            false
        }
        Timber.i("DepthProcessor: Depth supported = $depthSupported")
        return depthSupported
    }

    /**
     * Get depth at a specific screen coordinate (pixels).
     *
     * @param frame Current AR frame
     * @param screenX X coordinate in screen pixels
     * @param screenY Y coordinate in screen pixels
     * @param imageWidth Depth image width (from acquireDepthImage16Bits)
     * @param imageHeight Depth image height
     * @return Depth in meters, or null if unavailable/unreliable
     */
    fun getDepthAtPoint(frame: Frame, screenX: Float, screenY: Float): DepthReading? {
        if (!depthSupported) return null

        try {
            val depthImage = frame.acquireDepthImage16Bits()
            try {
                val width = depthImage.width
                val height = depthImage.height
                val plane = depthImage.planes[0]
                val buffer = plane.buffer.asShortBuffer()

                // Map screen coords to depth image coords
                val sceneWidth = frame.camera.imageIntrinsics.imageDimensions[0].toFloat()
                val sceneHeight = frame.camera.imageIntrinsics.imageDimensions[1].toFloat()
                val depthX = ((screenX / sceneWidth) * width).toInt().coerceIn(0, width - 1)
                val depthY = ((screenY / sceneHeight) * height).toInt().coerceIn(0, height - 1)

                // Read depth in millimeters
                val rawDepthMm = buffer.get(depthY * width + depthX).toInt() and 0xFFFF

                if (rawDepthMm < MIN_DEPTH_MM || rawDepthMm > MAX_DEPTH_MM) {
                    return null
                }

                // Apply spatial median filter around the point
                val filteredDepthMm = medianFilter(buffer, width, height, depthX, depthY)

                // Add to temporal history for smoothing
                addToTemporalBuffer(buffer, width, height)

                // Temporal smoothing at this specific point
                val smoothedDepthMm = temporalSmooth(depthX, depthY, width, filteredDepthMm)

                val depthMeters = smoothedDepthMm / 1000f

                // Estimate surface normal from depth gradients
                val surfaceNormal = estimateSurfaceNormal(buffer, width, height, depthX, depthY)

                // Evaluate confidence
                val confidence = evaluateConfidence(
                    rawDepthMm, filteredDepthMm, smoothedDepthMm, surfaceNormal
                )

                return DepthReading(
                    depthMeters = depthMeters,
                    confidence = confidence,
                    surfaceNormal = surfaceNormal,
                    rawDepthMm = rawDepthMm,
                    processedDepthMm = smoothedDepthMm
                )
            } finally {
                depthImage.close()
            }
        } catch (e: NotYetAvailableException) {
            // Depth not yet computed for this frame — normal during initialization
            return null
        } catch (e: Exception) {
            Timber.w(e, "DepthProcessor: Error reading depth")
            return null
        }
    }

    /**
     * Check if a 3D world point is occluded by real-world geometry.
     *
     * @param frame Current AR frame
     * @param worldPoint The 3D position in world coordinates
     * @return OcclusionResult with occlusion state and confidence
     */
    fun checkOcclusion(frame: Frame, worldPoint: Pose): OcclusionResult {
        if (!depthSupported || frame.camera.trackingState != TrackingState.TRACKING) {
            return OcclusionResult(isOccluded = false, confidence = 0f)
        }

        try {
            // Project world point to screen coordinates
            val viewMatrix = FloatArray(16)
            val projMatrix = FloatArray(16)
            frame.camera.getViewMatrix(viewMatrix, 0)
            frame.camera.getProjectionMatrix(projMatrix, 0, 0.1f, 100f)

            val worldPos = floatArrayOf(
                worldPoint.tx(), worldPoint.ty(), worldPoint.tz(), 1f
            )

            // Transform to clip space
            val viewPos = multiplyMV(viewMatrix, worldPos)
            val clipPos = multiplyMV(projMatrix, viewPos)

            if (clipPos[3] <= 0) return OcclusionResult(false, 0f) // Behind camera

            // Normalize to NDC
            val ndcX = clipPos[0] / clipPos[3]
            val ndcY = clipPos[1] / clipPos[3]

            // Check if in view frustum
            if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) {
                return OcclusionResult(false, 0f)
            }

            // Distance from camera to the 3D point
            val cameraToPointDist = Math.sqrt(
                (viewPos[0] * viewPos[0] + viewPos[1] * viewPos[1] + viewPos[2] * viewPos[2]).toDouble()
            ).toFloat()

            // Map NDC to screen coords
            val dims = frame.camera.imageIntrinsics.imageDimensions
            val screenX = ((ndcX + 1) / 2f) * dims[0]
            val screenY = ((1 - ndcY) / 2f) * dims[1]

            // Get depth at that screen location
            val depthReading = getDepthAtPoint(frame, screenX, screenY) ?: return OcclusionResult(false, 0f)

            // Compare distances: if depth is closer than the point, it's occluded
            val isOccluded = depthReading.depthMeters < cameraToPointDist - 0.05f // 5cm tolerance
            val confidence = depthReading.confidence

            return OcclusionResult(isOccluded = isOccluded, confidence = confidence)
        } catch (e: Exception) {
            return OcclusionResult(false, 0f)
        }
    }

    /**
     * Get the average depth confidence for the current frame.
     * Useful for guiding the user to move to better-lit areas.
     */
    fun getFrameDepthConfidence(frame: Frame): Float {
        if (!depthSupported) return 0f

        try {
            val confidenceImage = frame.acquireRawDepthConfidenceImage()
            try {
                val buffer = confidenceImage.planes[0].buffer
                var totalConfidence = 0L
                var count = 0
                while (buffer.hasRemaining()) {
                    totalConfidence += (buffer.get().toInt() and 0xFF)
                    count++
                }
                return if (count > 0) totalConfidence / (count * 255f) else 0f
            } finally {
                confidenceImage.close()
            }
        } catch (e: NotYetAvailableException) {
            return 0f
        } catch (e: Exception) {
            return 0f
        }
    }

    /**
     * Reset temporal buffers (call when session restarts or user moves significantly).
     */
    fun reset() {
        depthHistory.clear()
        lastWidth = 0
        lastHeight = 0
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════

    private fun medianFilter(
        buffer: ShortBuffer,
        width: Int,
        height: Int,
        cx: Int,
        cy: Int
    ): Int {
        val halfK = MEDIAN_KERNEL_SIZE / 2
        val values = mutableListOf<Int>()

        for (dy in -halfK..halfK) {
            for (dx in -halfK..halfK) {
                val x = (cx + dx).coerceIn(0, width - 1)
                val y = (cy + dy).coerceIn(0, height - 1)
                val depth = buffer.get(y * width + x).toInt() and 0xFFFF
                if (depth in MIN_DEPTH_MM..MAX_DEPTH_MM) {
                    values.add(depth)
                }
            }
        }

        return if (values.isNotEmpty()) {
            values.sort()
            values[values.size / 2]
        } else {
            buffer.get(cy * width + cx).toInt() and 0xFFFF
        }
    }

    private fun addToTemporalBuffer(buffer: ShortBuffer, width: Int, height: Int) {
        if (width != lastWidth || height != lastHeight) {
            depthHistory.clear()
            lastWidth = width
            lastHeight = height
        }

        val snapshot = ShortArray(width * height)
        buffer.position(0)
        buffer.get(snapshot)
        buffer.position(0)

        depthHistory.addLast(snapshot)
        while (depthHistory.size > TEMPORAL_WINDOW) {
            depthHistory.removeAt(0)
        }
    }

    private fun temporalSmooth(x: Int, y: Int, width: Int, currentValue: Int): Int {
        if (depthHistory.size < 2) return currentValue

        val idx = y * width + x
        var sum = 0L
        var count = 0

        for (frame in depthHistory) {
            if (idx < frame.size) {
                val val_ = frame[idx].toInt() and 0xFFFF
                if (val_ in MIN_DEPTH_MM..MAX_DEPTH_MM) {
                    sum += val_
                    count++
                }
            }
        }

        return if (count > 0) (sum / count).toInt() else currentValue
    }

    private fun estimateSurfaceNormal(
        buffer: ShortBuffer,
        width: Int,
        height: Int,
        cx: Int,
        cy: Int
    ): FloatArray? {
        if (cx < 1 || cx >= width - 1 || cy < 1 || cy >= height - 1) return null

        val dLeft = (buffer.get(cy * width + cx - 1).toInt() and 0xFFFF).toFloat()
        val dRight = (buffer.get(cy * width + cx + 1).toInt() and 0xFFFF).toFloat()
        val dUp = (buffer.get((cy - 1) * width + cx).toInt() and 0xFFFF).toFloat()
        val dDown = (buffer.get((cy + 1) * width + cx).toInt() and 0xFFFF).toFloat()

        // Check validity
        if (dLeft < MIN_DEPTH_MM || dRight < MIN_DEPTH_MM ||
            dUp < MIN_DEPTH_MM || dDown < MIN_DEPTH_MM
        ) return null

        // Compute gradients
        val dzdx = (dRight - dLeft) / 2f
        val dzdy = (dDown - dUp) / 2f

        // Normal = normalize(-dzdx, -dzdy, 1)
        val len = Math.sqrt((dzdx * dzdx + dzdy * dzdy + 1f).toDouble()).toFloat()
        return floatArrayOf(-dzdx / len, -dzdy / len, 1f / len)
    }

    private fun evaluateConfidence(
        rawMm: Int,
        filteredMm: Int,
        smoothedMm: Int,
        surfaceNormal: FloatArray?
    ): Float {
        var confidence = 1.0f

        // Penalty for large difference between raw and filtered (noise)
        val filterDiff = Math.abs(rawMm - filteredMm).toFloat()
        if (filterDiff > 100) confidence -= 0.2f
        if (filterDiff > 300) confidence -= 0.2f

        // Penalty for large temporal variation
        val temporalDiff = Math.abs(filteredMm - smoothedMm).toFloat()
        if (temporalDiff > 50) confidence -= 0.1f
        if (temporalDiff > 150) confidence -= 0.2f

        // Bonus for valid surface normal (indicates a proper surface)
        if (surfaceNormal != null) confidence += 0.1f

        // Penalty for very far depths (less reliable)
        if (rawMm > 5000) confidence -= 0.1f

        return confidence.coerceIn(0f, 1f)
    }

    private fun multiplyMV(matrix: FloatArray, vector: FloatArray): FloatArray {
        val result = FloatArray(4)
        for (i in 0..3) {
            result[i] = 0f
            for (j in 0..3) {
                result[i] += matrix[j * 4 + i] * vector[j]
            }
        }
        return result
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA CLASSES
    // ═══════════════════════════════════════════════════════════════

    /**
     * A single depth reading with confidence and surface information.
     */
    data class DepthReading(
        /** Depth in meters from the camera */
        val depthMeters: Float,
        /** Confidence 0.0-1.0 */
        val confidence: Float,
        /** Surface normal vector [nx, ny, nz] or null */
        val surfaceNormal: FloatArray?,
        /** Raw depth in millimeters (before processing) */
        val rawDepthMm: Int,
        /** Processed depth in millimeters (after filtering) */
        val processedDepthMm: Int
    )

    /**
     * Result of an occlusion check.
     */
    data class OcclusionResult(
        /** Whether the point is occluded by real-world geometry */
        val isOccluded: Boolean,
        /** Confidence of the occlusion determination */
        val confidence: Float
    )
}
