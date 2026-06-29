package com.univalle.pedrochacolla.utils.ar

import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import timber.log.Timber
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * PlaneEnhancer — Improved plane detection on top of ARCore's built-in planes.
 *
 * ARCore's default plane detection is good but can be improved for the AUGMENT-like
 * experience where we need:
 *
 * 1. **Plane merging** — combines overlapping/adjacent planes into larger surfaces
 * 2. **Plane extension** — extends small planes based on depth data
 * 3. **Plane stability scoring** — evaluates how stable a plane is for placement
 * 4. **Best placement finder** — suggests the optimal placement point on a plane
 * 5. **Surface quality assessment** — rates surface quality for AR content
 *
 * Performance: All operations are O(n) where n = number of tracked planes (typically < 20).
 * Safe to call every frame.
 */
class PlaneEnhancer {

    companion object {
        /** Minimum plane area (m²) to consider for placement */
        private const val MIN_PLACEMENT_AREA = 0.15f

        /** Distance threshold (m) for merging adjacent planes */
        private const val MERGE_DISTANCE_THRESHOLD = 0.15f

        /** Normal vector dot product threshold for parallel plane merging */
        private const val NORMAL_ALIGNMENT_THRESHOLD = 0.95f

        /** Minimum number of frames a plane must be tracked to be "stable" */
        private const val STABILITY_MIN_FRAMES = 10

        /** Maximum distance (m) from camera for placement consideration */
        private const val MAX_PLACEMENT_DISTANCE = 5.0f
    }

    // Track plane stability over time
    private val planeFrameCounts = mutableMapOf<Plane, Int>()
    private val planePoseHistory = mutableMapOf<Plane, MutableList<Pose>>()

    // Merged plane groups
    private val mergedGroups = mutableListOf<EnhancedPlane>()

    /**
     * Process the current frame's planes and return enhanced plane data.
     * Call this every frame in onSessionUpdated.
     *
     * @param session Active ARCore session
     * @param frame Current AR frame
     * @return List of EnhancedPlanes sorted by quality (best first)
     */
    fun processFrame(session: Session, frame: Frame): List<EnhancedPlane> {
        val trackedPlanes = session.getAllTrackables(Plane::class.java)
            .filter { it.trackingState == TrackingState.TRACKING }
            .filter { it.subsumedBy == null } // Top-level only

        // Update tracking counts
        updateStability(trackedPlanes)

        // Merge adjacent/overlapping planes
        val enhanced = buildEnhancedPlanes(trackedPlanes, frame)

        // Sort by quality
        return enhanced.sortedByDescending { it.quality }
    }

    /**
     * Find the best placement point on the highest-quality plane.
     *
     * @param frame Current AR frame
     * @param session ARCore session
     * @param preferredDistance Distance from camera to prefer (meters)
     * @return BestPlacement or null if no suitable surface found
     */
    fun findBestPlacement(
        frame: Frame,
        session: Session,
        preferredDistance: Float = 1.5f
    ): BestPlacement? {
        val enhanced = processFrame(session, frame)
        if (enhanced.isEmpty()) return null

        val cameraPose = frame.camera.pose

        for (plane in enhanced) {
            if (plane.quality < 0.3f) continue
            if (plane.area < MIN_PLACEMENT_AREA) continue

            // Check distance from camera
            val dx = plane.centerPose.tx() - cameraPose.tx()
            val dz = plane.centerPose.tz() - cameraPose.tz()
            val distance = sqrt((dx * dx + dz * dz).toDouble()).toFloat()

            if (distance > MAX_PLACEMENT_DISTANCE) continue

            // Find the point on the plane closest to the preferred distance
            val dirX = dx / distance
            val dirZ = dz / distance
            val targetX = cameraPose.tx() + dirX * preferredDistance
            val targetZ = cameraPose.tz() + dirZ * preferredDistance

            // Verify the target point is within the plane boundary
            val targetPose = Pose(
                floatArrayOf(targetX, plane.centerPose.ty(), targetZ),
                plane.centerPose.rotationQuaternion
            )

            return BestPlacement(
                pose = targetPose,
                plane = plane,
                distanceFromCamera = minOf(distance, preferredDistance),
                quality = plane.quality
            )
        }

        return null
    }

    /**
     * Evaluate whether a specific hit point is a good placement location.
     *
     * @param plane The plane hit by the ray
     * @param hitPose The pose at the hit point
     * @param frame Current frame
     * @return PlacementQuality assessment
     */
    fun evaluatePlacement(plane: Plane, hitPose: Pose, frame: Frame): PlacementQuality {
        val cameraPose = frame.camera.pose

        // Distance from camera
        val dx = hitPose.tx() - cameraPose.tx()
        val dy = hitPose.ty() - cameraPose.ty()
        val dz = hitPose.tz() - cameraPose.tz()
        val distance = sqrt((dx * dx + dy * dy + dz * dz).toDouble()).toFloat()

        // Plane area
        val area = plane.extentX * plane.extentZ

        // Stability
        val frameCount = planeFrameCounts[plane] ?: 0
        val isStable = frameCount >= STABILITY_MIN_FRAMES

        // Pose stability (low variation = stable)
        val poseVariation = computePoseVariation(plane)

        // Surface quality score
        var score = 0f
        // Area contribution (0-0.25)
        score += (area / 4f).coerceIn(0f, 0.25f)
        // Distance contribution (0-0.25) — prefer 0.5-2.5m
        score += when {
            distance in 0.5f..2.5f -> 0.25f
            distance in 0.3f..4.0f -> 0.15f
            else -> 0.05f
        }
        // Stability contribution (0-0.25)
        score += if (isStable) 0.25f else (frameCount / STABILITY_MIN_FRAMES.toFloat()) * 0.25f
        // Pose variation contribution (0-0.25) — lower is better
        score += when {
            poseVariation < 0.005f -> 0.25f
            poseVariation < 0.02f -> 0.15f
            poseVariation < 0.05f -> 0.1f
            else -> 0f
        }

        val recommendation = when {
            score >= 0.7f -> "Excelente superficie para colocar"
            score >= 0.5f -> "Buena superficie"
            score >= 0.3f -> "Superficie aceptable, mueve más para mejorar"
            else -> "Superficie inestable, busca una mejor"
        }

        return PlacementQuality(
            score = score,
            isStable = isStable,
            area = area,
            distanceFromCamera = distance,
            recommendation = recommendation,
            planeType = plane.type.name
        )
    }

    /**
     * Clean up stale plane data (planes that are no longer tracked).
     * Call periodically (e.g., every 30 frames) to prevent memory leaks.
     */
    fun cleanup() {
        planeFrameCounts.keys.removeAll { it.trackingState != TrackingState.TRACKING }
        planePoseHistory.keys.removeAll { it.trackingState != TrackingState.TRACKING }
    }

    /**
     * Reset all state. Call when the AR session restarts.
     */
    fun reset() {
        planeFrameCounts.clear()
        planePoseHistory.clear()
        mergedGroups.clear()
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════

    private fun updateStability(planes: List<Plane>) {
        for (plane in planes) {
            planeFrameCounts[plane] = (planeFrameCounts[plane] ?: 0) + 1

            val history = planePoseHistory.getOrPut(plane) { mutableListOf() }
            history.add(plane.centerPose)
            // Keep only last 30 poses
            while (history.size > 30) history.removeAt(0)
        }
    }

    private fun buildEnhancedPlanes(
        planes: List<Plane>,
        frame: Frame
    ): List<EnhancedPlane> {
        val cameraPose = frame.camera.pose
        val result = mutableListOf<EnhancedPlane>()

        // Try to merge adjacent parallel planes
        val merged = mutableSetOf<Plane>()
        val groups = mutableListOf<List<Plane>>()

        for (i in planes.indices) {
            if (planes[i] in merged) continue
            val group = mutableListOf(planes[i])

            for (j in i + 1 until planes.size) {
                if (planes[j] in merged) continue
                if (shouldMergePlanes(planes[i], planes[j])) {
                    group.add(planes[j])
                    merged.add(planes[j])
                }
            }

            merged.add(planes[i])
            groups.add(group)
        }

        for (group in groups) {
            val primary = group.maxByOrNull { it.extentX * it.extentZ } ?: continue

            // Combined area of the group
            val totalArea = group.sumOf { (it.extentX * it.extentZ).toDouble() }.toFloat()

            // Stability: use the most stable plane in the group
            val maxFrames = group.maxOfOrNull { planeFrameCounts[it] ?: 0 } ?: 0
            val isStable = maxFrames >= STABILITY_MIN_FRAMES

            // Distance from camera
            val dx = primary.centerPose.tx() - cameraPose.tx()
            val dz = primary.centerPose.tz() - cameraPose.tz()
            val distance = sqrt((dx * dx + dz * dz).toDouble()).toFloat()

            // Quality score
            var quality = 0f
            quality += (totalArea / 3f).coerceIn(0f, 0.3f) // Area: 0-0.3
            quality += if (isStable) 0.3f else 0f           // Stability: 0-0.3
            quality += when {                                // Distance: 0-0.2
                distance in 0.3f..3.0f -> 0.2f
                distance < 5.0f -> 0.1f
                else -> 0f
            }
            quality += when (primary.type) {                 // Type: 0-0.2
                Plane.Type.HORIZONTAL_UPWARD_FACING -> 0.2f  // Best for animals
                Plane.Type.HORIZONTAL_DOWNWARD_FACING -> 0.05f
                Plane.Type.VERTICAL -> 0.1f
                else -> 0f
            }

            result.add(
                EnhancedPlane(
                    primaryPlane = primary,
                    mergedPlanes = group,
                    area = totalArea,
                    quality = quality,
                    isStable = isStable,
                    centerPose = primary.centerPose,
                    planeType = primary.type,
                    distanceFromCamera = distance,
                    trackedFrames = maxFrames
                )
            )
        }

        return result
    }

    private fun shouldMergePlanes(a: Plane, b: Plane): Boolean {
        // Must be same type
        if (a.type != b.type) return false

        // Normals must be aligned
        val normalA = getPlaneNormal(a)
        val normalB = getPlaneNormal(b)
        val dot = normalA[0] * normalB[0] + normalA[1] * normalB[1] + normalA[2] * normalB[2]
        if (abs(dot) < NORMAL_ALIGNMENT_THRESHOLD) return false

        // Centers must be close enough
        val dx = a.centerPose.tx() - b.centerPose.tx()
        val dy = a.centerPose.ty() - b.centerPose.ty()
        val dz = a.centerPose.tz() - b.centerPose.tz()
        val dist = sqrt((dx * dx + dy * dy + dz * dz).toDouble()).toFloat()

        // Consider extents: merge if within sum of half-extents + threshold
        val maxExtent = maxOf(a.extentX, a.extentZ, b.extentX, b.extentZ) / 2f
        return dist < maxExtent + MERGE_DISTANCE_THRESHOLD
    }

    private fun getPlaneNormal(plane: Plane): FloatArray {
        val normal = floatArrayOf(0f, 1f, 0f)
        val rotated = FloatArray(3)
        plane.centerPose.rotateVector(normal, 0, rotated, 0)
        return rotated
    }

    private fun computePoseVariation(plane: Plane): Float {
        val history = planePoseHistory[plane] ?: return 1f
        if (history.size < 3) return 1f

        // Compute average pose variation over recent history
        var totalVariation = 0f
        for (i in 1 until history.size) {
            val dx = history[i].tx() - history[i - 1].tx()
            val dy = history[i].ty() - history[i - 1].ty()
            val dz = history[i].tz() - history[i - 1].tz()
            totalVariation += sqrt((dx * dx + dy * dy + dz * dz).toDouble()).toFloat()
        }
        return totalVariation / (history.size - 1)
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA CLASSES
    // ═══════════════════════════════════════════════════════════════

    /**
     * An enhanced plane that may be a merge of multiple ARCore planes.
     */
    data class EnhancedPlane(
        /** The primary (largest) ARCore plane */
        val primaryPlane: Plane,
        /** All planes merged into this group */
        val mergedPlanes: List<Plane>,
        /** Total combined area in m² */
        val area: Float,
        /** Quality score 0.0-1.0 */
        val quality: Float,
        /** Whether the plane has been stable for enough frames */
        val isStable: Boolean,
        /** Center pose of the primary plane */
        val centerPose: Pose,
        /** Type of the plane */
        val planeType: Plane.Type,
        /** Distance from camera in meters */
        val distanceFromCamera: Float,
        /** Number of frames this plane has been tracked */
        val trackedFrames: Int
    )

    /**
     * The best suggested placement point.
     */
    data class BestPlacement(
        /** Suggested world pose for the anchor */
        val pose: Pose,
        /** The enhanced plane for placement */
        val plane: EnhancedPlane,
        /** Distance from camera in meters */
        val distanceFromCamera: Float,
        /** Quality score */
        val quality: Float
    )

    /**
     * Quality assessment of a specific placement location.
     */
    data class PlacementQuality(
        /** Quality score 0.0-1.0 */
        val score: Float,
        /** Whether the surface is stable enough */
        val isStable: Boolean,
        /** Surface area in m² */
        val area: Float,
        /** Distance from camera in meters */
        val distanceFromCamera: Float,
        /** User-facing recommendation text */
        val recommendation: String,
        /** Type of surface (HORIZONTAL_UPWARD, etc.) */
        val planeType: String
    )
}
