package com.univalle.pedrochacolla.utils.ar

import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.univalle.pedrochacolla.data.model.SpatialData
import timber.log.Timber
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * SpatialMapper — Virtual Point Space Map Engine
 *
 * Creates a rich spatial fingerprint of the environment around an anchor by
 * scanning continuously across multiple frames, accumulating feature points
 * from different viewpoints (similar to how ARCore builds a feature map for
 * cloud anchors). The result is persisted to the backend so visitors can
 * re-localize animals with sub-centimeter accuracy.
 *
 * ## Admin (placement) flow
 * 1. Admin places anchor → call [startScanSession]
 * 2. Admin scans around the anchor → call [updateScan] each frame
 *    - [scanReadiness] rises from 0 → 1 as more data is collected
 * 3. Admin initiates upload → call [finalizeScan] to get the [SpatialData]
 *
 * ## Visitor (resolution) flow
 * 1. Cloud anchor resolves → call [matchEnvironment] with stored [SpatialData]
 * 2. Use the returned [MatchResult.pose] to pin the model at the exact world position
 */
class SpatialMapper {

    companion object {
        /** Hard cap on stored feature points to keep JSON size manageable */
        private const val MAX_FEATURE_POINTS = 400

        /** Minimum points for the spatial data to be considered valid */
        private const val MIN_FEATURE_POINTS_VALID = 30

        /** Target points for a "good" scan (readiness reaches ~0.7 here) */
        private const val TARGET_FEATURE_POINTS = 150

        /** Excellent point count (readiness reaches 1.0 here) */
        private const val EXCELLENT_FEATURE_POINTS = 300

        /** Capture radius around the anchor (meters) */
        private const val CAPTURE_RADIUS = 3.5f

        /** Minimum ARCore confidence for a point to be stored */
        private const val MIN_POINT_CONFIDENCE = 0.25f

        /** Minimum distance between stored points (de-duplication, meters) */
        private const val MIN_POINT_SPACING = 0.04f

        /** Minimum plane area to be considered dominant (m²) */
        private const val MIN_PLANE_AREA = 0.3f

        /** Minimum viewpoints (camera positions) for good coverage */
        private const val MIN_VIEWPOINTS = 4

        /** Target viewpoints for full readiness */
        private const val TARGET_VIEWPOINTS = 8

        /** Minimum distance for a new viewpoint to be considered distinct (meters) */
        private const val MIN_VIEWPOINT_SPACING = 0.15f
    }

    // ── Active scan session state ──────────────────────────────────

    /** Accumulated feature points: [dx, dy, dz, confidence] relative to anchor */
    private val accumulatedPoints = mutableListOf<FloatArray>()

    /** Camera positions visited during scanning (for coverage tracking) */
    private val viewpoints = mutableListOf<FloatArray>()

    /** Anchor pose established at [startScanSession] */
    private var anchorPose: Pose? = null

    /** Dominant plane captured at [startScanSession] */
    private var dominantPlane: Plane? = null

    /** Frame counter to throttle per-frame processing */
    private var frameCounter = 0

    /** Set of 45° angular sectors (0–7) covered by camera viewpoints around the anchor */
    private val coveredSectors = mutableSetOf<Int>()

    /** Whether a scan session is currently active */
    var isScanActive = false
        private set

    /**
     * Wall mode — set to **true** when the anchor is placed against a wall or corner.
     *
     * In wall mode the effective scan arc is a semicircle (180° / 4 sectors) instead of
     * a full circle (360° / 8 sectors), and [isVpsReadyForHosting] lowers the sector
     * requirement from 5 to 3. This lets admins successfully upload an anchor that is
     * physically impossible to approach from behind.
     */
    var wallMode: Boolean = false

    /**
     * Readiness score 0.0–1.0 based on accumulated data.
     * - < 0.5 → insufficient — need more angular coverage
     * - 0.5–0.7 → sufficient — can save, more coverage improves accuracy
     * - > 0.7 → good
     * - > 0.9 → excellent
     *
     * Wall mode scales the sector score against 4 sectors (180°) instead of 8 (360°)
     * so the same formula works for both open spaces and wall-mounted anchors.
     */
    val scanReadiness: Float
        get() = computeScanReadiness()

    /**
     * Human-readable hint describing what the admin should do to improve the scan.
     */
    val scanReadinessHint: String
        get() = buildReadinessHint()

    /** Number of 45° sectors around the anchor covered so far (0–8). */
    val angularSectorsCovered: Int
        get() = coveredSectors.size

    // ── Public API ────────────────────────────────────────────────

    /**
     * Begin a new continuous scan session right after the anchor is placed.
     * Resets all accumulated data.
     *
     * @param session Active ARCore session
     * @param frame The frame at the moment of anchor placement
     * @param anchorPose The world pose of the placed anchor
     */
    fun startScanSession(session: Session, frame: Frame, anchorPose: Pose) {
        accumulatedPoints.clear()
        viewpoints.clear()
        coveredSectors.clear()
        this.anchorPose = anchorPose
        this.frameCounter = 0
        this.isScanActive = true

        // Capture the dominant plane immediately
        dominantPlane = findDominantPlane(session, anchorPose)

        // Seed with the first batch of points
        collectPointsFromFrame(frame, anchorPose)
        recordViewpoint(frame)

        Timber.i("SpatialMapper: Scan session started — plane=${dominantPlane?.type}, " +
                "initial points=${accumulatedPoints.size}")
    }

    /**
     * Feed a new AR frame into the ongoing scan session.
     * Returns **true** if this frame was actually processed (not throttled) so the caller
     * can decide whether to push a UI update.
     */
    fun updateScan(session: Session, frame: Frame): Boolean {
        if (!isScanActive) return false
        val pose = anchorPose ?: return false
        if (frame.camera.trackingState != TrackingState.TRACKING) return false

        frameCounter++
        // Process every 3rd frame to balance responsiveness vs CPU usage
        if (frameCounter % 3 != 0) return false

        collectPointsFromFrame(frame, pose)
        recordViewpoint(frame)

        // Refresh dominant plane periodically (it grows as ARCore tracks more)
        if (frameCounter % 30 == 0) {
            val updated = findDominantPlane(session, pose)
            if (updated != null) dominantPlane = updated
        }
        return true
    }

    /**
     * Finalize the scan and produce the [SpatialData] to be saved to the backend.
     * Stops the ongoing scan session.
     *
     * @param compassHeading Compass heading from device sensor (degrees from magnetic north)
     * @param gpsAccuracy GPS accuracy in meters
     * @param altitude Altitude in meters above sea level
     * @return [SpatialData] with all accumulated data, or null if no anchor was set
     */
    fun finalizeScan(
        compassHeading: Float? = null,
        gpsAccuracy: Float? = null,
        altitude: Double? = null
    ): SpatialData? {
        isScanActive = false
        val pose = anchorPose ?: return null

        val plane = dominantPlane
        val relativePose = if (plane != null) computeRelativePose(pose, plane.centerPose) else null
        val planeEquation = plane?.let { extractPlaneEquation(it) }
        val planeType = plane?.type?.name
        val planeBoundary = plane?.let { extractPlaneBoundary(it) }

        // Select the highest-confidence points (capped at MAX_FEATURE_POINTS)
        val points = accumulatedPoints
            .sortedByDescending { it[3] }
            .take(MAX_FEATURE_POINTS)
            .map { listOf(it[0], it[1], it[2], it[3]) }
            .ifEmpty { null }

        Timber.i(
            "SpatialMapper: Scan finalized — points=%d, viewpoints=%d, plane=%s, readiness=%.2f",
            points?.size ?: 0, viewpoints.size, planeType, scanReadiness
        )

        return SpatialData(
            version = 2,
            anchorPose = relativePose?.let { sanitizeFloatList(poseToMatrixList(it)) },
            planeEquation = planeEquation?.let { sanitizeFloatList(it) },
            planeType = planeType,
            planeBoundary = planeBoundary?.map { row -> sanitizeFloatList(row) },
            featurePoints = points?.map { row -> sanitizeFloatList(row) },
            compassHeading = compassHeading?.let { if (it.isFinite()) it else null },
            gpsAccuracy = gpsAccuracy?.let { if (it.isFinite() && it >= 0f) it else null },
            altitude = altitude?.let { if (it.isFinite()) it else null },
            capturedAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
        )
    }

    /**
     * One-shot capture — kept for backward-compatibility.
     * Prefer [startScanSession] + [updateScan] + [finalizeScan] for better quality.
     */
    fun captureSpatialData(
        session: Session,
        frame: Frame,
        anchorPose: Pose,
        compassHeading: Float? = null,
        gpsAccuracy: Float? = null,
        altitude: Double? = null
    ): SpatialData? {
        startScanSession(session, frame, anchorPose)
        return finalizeScan(compassHeading, gpsAccuracy, altitude)
    }

    /** Evaluate the quality of finalized [SpatialData]. Returns 0.0–1.0. */
    fun evaluateQuality(spatialData: SpatialData): Float {
        var score = 0f

        val pointCount = spatialData.featurePoints?.size ?: 0
        score += when {
            pointCount >= EXCELLENT_FEATURE_POINTS -> 0.4f
            pointCount >= TARGET_FEATURE_POINTS -> 0.3f
            pointCount >= MIN_FEATURE_POINTS_VALID -> 0.2f
            pointCount > 0 -> 0.1f
            else -> 0f
        }

        if (spatialData.planeEquation != null) score += 0.1f
        if (spatialData.planeBoundary != null && spatialData.planeBoundary.size >= 3) score += 0.1f
        if (spatialData.planeType != null) score += 0.1f
        if (spatialData.anchorPose != null && spatialData.anchorPose.size == 16) score += 0.2f
        if (spatialData.compassHeading != null) score += 0.05f
        if (spatialData.gpsAccuracy != null && spatialData.gpsAccuracy < 10f) score += 0.05f

        return score.coerceIn(0f, 1f)
    }

    /** Reset all scan state (including [wallMode]). */
    fun reset() {
        accumulatedPoints.clear()
        viewpoints.clear()
        coveredSectors.clear()
        anchorPose = null
        dominantPlane = null
        frameCounter = 0
        isScanActive = false
        wallMode = false
    }

    /**
     * Match current AR environment against stored spatial data.
     * Used on the visitor side to re-localize the anchor precisely.
     *
     * @param session Active ARCore session
     * @param frame Current AR frame
     * @param storedData The spatial data loaded from the backend
     * @return [MatchResult] with the exact world pose, or null if no reliable match
     */
    fun matchEnvironment(
        session: Session,
        frame: Frame,
        storedData: SpatialData
    ): MatchResult? {
        if (frame.camera.trackingState != TrackingState.TRACKING) return null
        if (storedData.anchorPose == null || storedData.planeType == null) return null

        try {
            val candidatePlanes = session.getAllTrackables(Plane::class.java)
                .filter { it.trackingState == TrackingState.TRACKING }
                .filter { it.subsumedBy == null }
                .filter { it.type.name == storedData.planeType }
                .filter { it.extentX * it.extentZ >= MIN_PLANE_AREA }

            if (candidatePlanes.isEmpty()) return null

            var bestPlane: Plane? = null
            var bestScore = 0f

            for (plane in candidatePlanes) {
                val score = scorePlaneMatch(plane, storedData)
                if (score > bestScore) {
                    bestScore = score
                    bestPlane = plane
                }
            }

            if (bestPlane == null || bestScore < 0.3f) return null

            // Re-compose: plane centre pose × stored relative pose = exact world pose
            val relativePose = matrixListToPose(storedData.anchorPose)
            val worldPose = bestPlane.centerPose.compose(relativePose)

            return MatchResult(
                confidence = bestScore,
                pose = worldPose,
                matchedPlane = bestPlane
            )
        } catch (e: Exception) {
            Timber.e(e, "SpatialMapper: Error matching environment")
            return null
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE — scan helpers
    // ═══════════════════════════════════════════════════════════════

    private fun computeScanReadiness(): Float {
        anchorPose ?: return 0f

        // 1. Angular sector coverage (0 – 0.55)
        // Standard mode : 8 sectors of 45° — full 360° circle.
        // Wall mode     : 4 sectors of 45° — 180° semicircle (can’t go behind the wall).
        // In both modes the score is 0.55 when the target arc is fully covered.
        val targetSectors = if (wallMode) 4 else 8
        val sectors = coveredSectors.size
        val sectorScore = (sectors.coerceAtMost(targetSectors) / targetSectors.toFloat()) * 0.55f

        // 2. Feature points score (0 – 0.30)
        val pts = accumulatedPoints.size
        val ptsScore = when {
            pts >= EXCELLENT_FEATURE_POINTS -> 0.30f
            pts >= TARGET_FEATURE_POINTS    -> 0.22f
            pts >= MIN_FEATURE_POINTS_VALID -> 0.14f
            pts > 0                         -> 0.06f
            else                            -> 0f
        }

        // 3. Plane score (0 – 0.15)
        val planeScore = if (dominantPlane != null) 0.15f else 0f

        // Example thresholds (no feature points):
        //   Standard — 6 sectors + plane : 6/8*0.55 + 0.15 = 0.5625 → SUFFICIENT ✓
        //   Standard — 8 sectors + plane : 0.55 + 0.15     = 0.70   → GOOD ✓
        //   Wall mode — 3 sectors + plane: 3/4*0.55 + 0.15 = 0.5625 → SUFFICIENT ✓
        //   Wall mode — 4 sectors + plane: 0.55 + 0.15     = 0.70   → GOOD ✓
        return (sectorScore + ptsScore + planeScore).coerceIn(0f, 1f)
    }

    private fun buildReadinessHint(): String {
        val sectors = coveredSectors.size
        if (dominantPlane == null) return "Apunta hacia el suelo para detectar la superficie"
        return if (wallMode) {
            when {
                sectors == 0 -> "Modo pared: muévete en semicírculo frente a la pared"
                sectors < 2  -> "Desplázate hacia la izquierda y derecha ($sectors/4)"
                sectors < 3  -> "Buen progreso — $sectors/4 sectores cubiertos"
                sectors < 4  -> "¡Casi listo! $sectors/4 sectores — ya puedes guardar"
                else         -> "¡Semicírculo completo! Puedes guardar el animal"
            }
        } else {
            when {
                sectors == 0 -> "Camina lentamente alrededor del animal"
                sectors < 3  -> "Continúa caminando alrededor — $sectors/8 sectores"
                sectors < 6  -> "Buen progreso — cubre más ángulos ($sectors/8 sectores)"
                sectors < 8  -> "¡Casi completo! $sectors/8 sectores — ya puedes guardar"
                else         -> "¡Cobertura 360° completa! Puedes guardar el animal"
            }
        }
    }

    private fun collectPointsFromFrame(frame: Frame, anchorPose: Pose) {
        if (frame.camera.trackingState != TrackingState.TRACKING) return
        val cloud = frame.acquirePointCloud()
        try {
            val buf = cloud.points
            val count = buf.remaining() / 4
            var added = 0
            for (i in 0 until count) {
                if (accumulatedPoints.size >= MAX_FEATURE_POINTS * 2) break
                val x = buf.get(i * 4)
                val y = buf.get(i * 4 + 1)
                val z = buf.get(i * 4 + 2)
                val conf = buf.get(i * 4 + 3)

                // Skip NaN/Inf values that ARCore sometimes emits for untracked points
                if (!x.isFinite() || !y.isFinite() || !z.isFinite() || !conf.isFinite()) continue
                if (conf < MIN_POINT_CONFIDENCE) continue

                val dx = x - anchorPose.tx()
                val dy = y - anchorPose.ty()
                val dz = z - anchorPose.tz()
                val dist = sqrt((dx * dx + dy * dy + dz * dz).toDouble()).toFloat()
                if (dist > CAPTURE_RADIUS) continue

                // De-duplicate against existing points
                val isDuplicate = accumulatedPoints.any { p ->
                    abs(p[0] - dx) < MIN_POINT_SPACING &&
                    abs(p[1] - dy) < MIN_POINT_SPACING &&
                    abs(p[2] - dz) < MIN_POINT_SPACING
                }
                if (!isDuplicate) {
                    accumulatedPoints.add(floatArrayOf(dx, dy, dz, conf))
                    added++
                }
            }
            if (added > 0) Timber.v("SpatialMapper: +$added pts (total=${accumulatedPoints.size})")
        } catch (e: Exception) {
            Timber.w(e, "SpatialMapper: error collecting point cloud")
        } finally {
            cloud.close()
        }
    }

    private fun recordViewpoint(frame: Frame) {
        val cam = frame.camera
        if (cam.trackingState != TrackingState.TRACKING) return
        val cx = cam.pose.tx()
        val cy = cam.pose.ty()
        val cz = cam.pose.tz()

        val isDistinct = viewpoints.none { vp ->
            val d = sqrt(
                ((vp[0] - cx) * (vp[0] - cx) +
                 (vp[1] - cy) * (vp[1] - cy) +
                 (vp[2] - cz) * (vp[2] - cz)).toDouble()
            ).toFloat()
            d < MIN_VIEWPOINT_SPACING
        }
        if (isDistinct) {
            viewpoints.add(floatArrayOf(cx, cy, cz))
            Timber.v("SpatialMapper: new viewpoint #${viewpoints.size}")

            // Track which 45° sector around the anchor this viewpoint covers.
            // Only record a sector when the camera is at least 0.3 m away from the anchor
            // so that points directly on top of it don't produce noisy sector assignments.
            val pose = anchorPose
            if (pose != null) {
                val dx = cx - pose.tx()
                val dz = cz - pose.tz()
                if (dx * dx + dz * dz > 0.09f) {  // 0.3 m minimum horizontal distance
                    val angleDeg = Math.toDegrees(Math.atan2(dz.toDouble(), dx.toDouble())).toFloat()
                    val normalised = if (angleDeg < 0f) angleDeg + 360f else angleDeg
                    val sector = (normalised / 45f).toInt() % 8
                    val added = coveredSectors.add(sector)
                    if (added) Timber.v("SpatialMapper: sector $sector covered (${coveredSectors.size}/8)")
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════

    private fun findDominantPlane(session: Session, anchorPose: Pose): Plane? {
        return session.getAllTrackables(Plane::class.java)
            .filter { it.trackingState == TrackingState.TRACKING }
            .filter { it.subsumedBy == null }
            .filter {
                val dx = it.centerPose.tx() - anchorPose.tx()
                val dz = it.centerPose.tz() - anchorPose.tz()
                sqrt((dx * dx + dz * dz).toDouble()) < CAPTURE_RADIUS
            }
            .filter { it.extentX * it.extentZ >= MIN_PLANE_AREA }
            .maxByOrNull { it.extentX * it.extentZ }
    }

    private fun computeRelativePose(anchorPose: Pose, planePose: Pose): Pose =
        planePose.inverse().compose(anchorPose)

    private fun extractPlaneEquation(plane: Plane): List<Float> {
        val pose = plane.centerPose
        val normal = floatArrayOf(0f, 1f, 0f)
        val rotated = FloatArray(3)
        pose.rotateVector(normal, 0, rotated, 0)
        val d = -(rotated[0] * pose.tx() + rotated[1] * pose.ty() + rotated[2] * pose.tz())
        return listOf(rotated[0], rotated[1], rotated[2], d)
    }

    private fun extractPlaneBoundary(plane: Plane): List<List<Float>> {
        val polygon = plane.polygon
        val boundary = mutableListOf<List<Float>>()
        val count = polygon.limit() / 2
        for (i in 0 until count) {
            boundary.add(listOf(polygon.get(i * 2), 0f, polygon.get(i * 2 + 1)))
        }
        return boundary
    }

    private fun scorePlaneMatch(plane: Plane, storedData: SpatialData): Float {
        var score = 0f
        if (plane.type.name == storedData.planeType) score += 0.3f

        if (storedData.planeBoundary != null && storedData.planeBoundary.size >= 3) {
            val storedArea = estimateBoundaryArea(storedData.planeBoundary)
            val currentArea = plane.extentX * plane.extentZ
            val ratio = if (storedArea > 0) (currentArea / storedArea) else 0f
            score += when {
                ratio in 0.5f..2.0f -> 0.3f
                ratio in 0.3f..3.0f -> 0.2f
                ratio in 0.1f..5.0f -> 0.1f
                else -> 0f
            }
        }

        if (storedData.planeEquation != null && storedData.planeEquation.size >= 3) {
            val pose = plane.centerPose
            val normal = floatArrayOf(0f, 1f, 0f)
            val rotated = FloatArray(3)
            pose.rotateVector(normal, 0, rotated, 0)
            val dot = rotated[0] * storedData.planeEquation[0] +
                      rotated[1] * storedData.planeEquation[1] +
                      rotated[2] * storedData.planeEquation[2]
            score += when {
                dot > 0.95f -> 0.4f
                dot > 0.85f -> 0.3f
                dot > 0.70f -> 0.2f
                else -> 0f
            }
        }

        return score
    }

    private fun estimateBoundaryArea(boundary: List<List<Float>>): Float {
        if (boundary.size < 3) return 0f
        var area = 0f
        for (i in boundary.indices) {
            val j = (i + 1) % boundary.size
            val xi = boundary[i].getOrElse(0) { 0f }
            val zi = boundary[i].getOrElse(2) { 0f }
            val xj = boundary[j].getOrElse(0) { 0f }
            val zj = boundary[j].getOrElse(2) { 0f }
            area += xi * zj - xj * zi
        }
        return abs(area) / 2f
    }

    /**
     * Replace any NaN or Infinite value with [fallback] (default 0f).
     * ARCore can produce degenerate matrices when a pose has an ill-conditioned
     * quaternion (e.g. anchor placed in a texture-less empty space).
     */
    private fun sanitizeFloat(value: Float, fallback: Float = 0f): Float =
        if (value.isFinite()) value else fallback

    private fun sanitizeFloatList(list: List<Float>, fallback: Float = 0f): List<Float> =
        list.map { sanitizeFloat(it, fallback) }

    private fun poseToMatrixList(pose: Pose): List<Float> {
        val matrix = FloatArray(16)
        pose.toMatrix(matrix, 0)
        return matrix.toList()
    }

    private fun matrixListToPose(matrixList: List<Float>): Pose {
        if (matrixList.size != 16) return Pose.IDENTITY
        val m = matrixList.toFloatArray()
        val translation = floatArrayOf(m[12], m[13], m[14])
        val quat = matrixToQuaternion(m)
        return Pose(translation, quat)
    }

    private fun matrixToQuaternion(m: FloatArray): FloatArray {
        val trace = m[0] + m[5] + m[10]
        return when {
            trace > 0 -> {
                val s = 0.5f / sqrt((trace + 1.0f).toDouble()).toFloat()
                floatArrayOf((m[6] - m[9]) * s, (m[8] - m[2]) * s, (m[1] - m[4]) * s, 0.25f / s)
            }
            m[0] > m[5] && m[0] > m[10] -> {
                val s = 2f * sqrt((1f + m[0] - m[5] - m[10]).toDouble()).toFloat()
                floatArrayOf(0.25f * s, (m[4] + m[1]) / s, (m[8] + m[2]) / s, (m[6] - m[9]) / s)
            }
            m[5] > m[10] -> {
                val s = 2f * sqrt((1f + m[5] - m[0] - m[10]).toDouble()).toFloat()
                floatArrayOf((m[4] + m[1]) / s, 0.25f * s, (m[9] + m[6]) / s, (m[8] - m[2]) / s)
            }
            else -> {
                val s = 2f * sqrt((1f + m[10] - m[0] - m[5]).toDouble()).toFloat()
                floatArrayOf((m[8] + m[2]) / s, (m[9] + m[6]) / s, 0.25f * s, (m[1] - m[4]) / s)
            }
        }
    }

    /** Result of matching the current environment against stored spatial data. */
    data class MatchResult(
        val confidence: Float,
        val pose: Pose,
        val matchedPlane: Plane
    )
}
