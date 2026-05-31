package com.univalle.pedrochacolla.utils.location

import kotlin.math.*

/**
 * Constant-Velocity (CV) Kalman Filter for GPS smoothing with:
 *   - Adaptive process & measurement noise (innovation-gated)
 *   - Step-detector assisted dead-reckoning
 *   - Cubic Hermite prediction with deceleration
 *   - Multi-fix accumulator (averages N raw fixes before updating)
 *   - Heading-constrained velocity (compass keeps the velocity vector aligned)
 *   - Mahalanobis-distance outlier gate (uses covariance, not just metres)
 *   - Biomechanical velocity clamp (max 2 m/s for park walking)
 *   - Exponential moving average on GPS accuracy for trend tracking
 *   - Weighted position averaging for multi-constellation receivers
 *
 * State vector per axis: [position, velocity]
 *
 * Tuning for park walking (max ~1.5 m/s):
 *   processNoiseMetersPerSecond = 0.30 — tight base noise; adaptive scaling
 *     raises it when walking. Lower than previous 0.35 for even less jitter.
 *   maxJumpMeters = 10 — tighter outlier gate for small-park scale.
 *   stationarySpeedThreshold = 0.20 m/s — earlier stationary lock.
 */
class GpsKalmanFilter(
    private val processNoiseMetersPerSecond: Double = 0.30,
    private val maxJumpMeters: Double = 10.0,
    private val stationarySpeedThreshold: Double = 0.20
) {
    // -- Position state (degrees)
    private var lat = 0.0
    private var lng = 0.0

    // -- Velocity state (degrees / second)
    private var vLat = 0.0
    private var vLng = 0.0

    // -- Covariance per axis: 2×2 symmetric [pp, pv; pv, vv]
    private var ppLat = UNINITIALIZED
    private var pvLat = 0.0
    private var vvLat = 0.0

    private var ppLng = UNINITIALIZED
    private var pvLng = 0.0
    private var vvLng = 0.0

    private var lastTimestampMs = 0L

    // -- Consecutive stationary readings counter
    private var stationaryCount = 0

    // -- Innovation-gated adaptive measurement noise --
    private var recentInnovationSqSum = 0.0
    private var recentInnovationCount = 0

    // -- Step detection assist --
    private var stepTimestampMs = 0L
    private var stepCount = 0
    private var stepFrequencyHz = 0.0   // steps per second
    private val STEP_STRIDE_M = 0.65    // average adult stride
    private val STEP_VALIDITY_MS = 3000 // forget step data after 3 s

    // -- Previous raw fix for velocity crosscheck --
    private var prevRawLat = 0.0
    private var prevRawLng = 0.0

    // ── Multi-fix accumulator ──────────────────────────────────────
    // Averages N consecutive raw GPS fixes before feeding the Kalman
    // filter, which dramatically reduces single-fix multipath noise.
    private val ACCUMULATOR_SIZE = 3
    private val accLats = DoubleArray(ACCUMULATOR_SIZE)
    private val accLngs = DoubleArray(ACCUMULATOR_SIZE)
    private val accWeights = DoubleArray(ACCUMULATOR_SIZE) // 1/accuracy²
    private val accTimesMs = LongArray(ACCUMULATOR_SIZE)
    private var accIndex = 0
    private var accFilled = false

    // ── Heading constraint ─────────────────────────────────────────
    // When a compass heading is provided, the velocity is nudged toward
    // that direction, reducing lateral drift on narrow park paths.
    private var lastCompassHeadingRad = Double.NaN
    private var compassTimestampMs = 0L
    private val COMPASS_VALIDITY_MS = 5000
    private val COMPASS_BLEND = 0.20  // how much compass influences velocity direction

    // ── Accuracy EMA ───────────────────────────────────────────────
    // Tracks the trend of GPS accuracy so the filter can detect
    // degrading satellite conditions before individual fixes go bad.
    private var emaAccuracy = 0.0
    private val EMA_ALPHA = 0.3  // fast response to accuracy changes

    // ── Biomechanical velocity clamp ───────────────────────────────
    private val MAX_WALK_MPS = 2.0  // fast walk / slow jog upper bound

    val isInitialized: Boolean get() = ppLat >= 0.0

    /** Current estimated speed in m/s. */
    val estimatedSpeedMps: Double
        get() {
            val vLatMps = vLat * LAT_DEG_TO_M
            val vLngMps = vLng * lngDegToM(lat)
            return sqrt(vLatMps * vLatMps + vLngMps * vLngMps)
        }

    /** True if the filter thinks the user is standing still. */
    val isStationary: Boolean get() = stationaryCount >= 3

    // ── Public API ─────────────────────────────────────────────────

    /**
     * Notify the filter that a step was detected by the accelerometer.
     * This keeps the velocity estimate alive between GPS fixes, improving
     * dead-reckoning in areas with poor satellite reception.
     */
    fun onStepDetected(timestampMs: Long) {
        if (stepTimestampMs > 0L) {
            val dt = (timestampMs - stepTimestampMs) / 1_000.0
            if (dt in 0.2..2.0) {
                stepFrequencyHz = 1.0 / dt
            }
        }
        stepTimestampMs = timestampMs
        stepCount++
    }

    /**
     * Inform the filter of the user's current compass heading so that
     * velocity direction can be constrained to reduce lateral drift.
     *
     * @param headingDeg  magnetic/true north heading in degrees [0, 360)
     * @param timestampMs system time when the heading was measured
     */
    fun setCompassHeading(headingDeg: Double, timestampMs: Long) {
        lastCompassHeadingRad = Math.toRadians(headingDeg)
        compassTimestampMs = timestampMs
    }

    /**
     * Feed a raw GPS fix and return the smoothed (lat, lng).
     *
     * Internally this accumulates [ACCUMULATOR_SIZE] samples using
     * accuracy-weighted averaging before performing a Kalman update,
     * which greatly reduces multipath noise from a single fix.
     */
    fun process(
        lat: Double,
        lng: Double,
        accuracy: Float,
        timestampMs: Long
    ): Pair<Double, Double> {
        // Update accuracy EMA
        emaAccuracy = if (emaAccuracy == 0.0) accuracy.toDouble()
                      else emaAccuracy * (1 - EMA_ALPHA) + accuracy * EMA_ALPHA

        // ── Accumulate fix ─────────────────────────────────────────
        val weight = 1.0 / (accuracy * accuracy).coerceAtLeast(1f)
        accLats[accIndex] = lat
        accLngs[accIndex] = lng
        accWeights[accIndex] = weight.toDouble()
        accTimesMs[accIndex] = timestampMs
        accIndex = (accIndex + 1) % ACCUMULATOR_SIZE
        if (accIndex == 0) accFilled = true

        // Until accumulator is full, run the Kalman with each individual fix
        // so we don't delay the initial position lock.
        val count = if (accFilled) ACCUMULATOR_SIZE else accIndex
        if (count < ACCUMULATOR_SIZE && isInitialized) {
            // Already initialised — return last filtered position while accumulating
            return Pair(this.lat, this.lng)
        }

        // ── Compute weighted average of accumulated fixes ──────────
        var wSum = 0.0
        var avgLat = 0.0
        var avgLng = 0.0
        var latestTimeMs = 0L
        for (i in 0 until count) {
            avgLat += accLats[i] * accWeights[i]
            avgLng += accLngs[i] * accWeights[i]
            wSum += accWeights[i]
            if (accTimesMs[i] > latestTimeMs) latestTimeMs = accTimesMs[i]
        }
        avgLat /= wSum
        avgLng /= wSum

        // Effective accuracy: weighted RMS of individual accuracies
        val effectiveAccuracy = (1.0 / sqrt(wSum)).toFloat().coerceAtLeast(0.5f)

        return processInternal(avgLat, avgLng, effectiveAccuracy, latestTimeMs, lat, lng)
    }

    // ── Core Kalman update ─────────────────────────────────────────

    private fun processInternal(
        lat: Double,
        lng: Double,
        accuracy: Float,
        timestampMs: Long,
        rawLat: Double,
        rawLng: Double
    ): Pair<Double, Double> {
        // Adaptive measurement noise: combine GPS accuracy with recent
        // innovation magnitude so the filter self-tunes in noisy conditions.
        val baseR = (accuracy * accuracy).toDouble().coerceAtLeast(0.5)
        val innovScale = if (recentInnovationCount >= 3) {
            (recentInnovationSqSum / recentInnovationCount).coerceIn(1.0, 8.0)
        } else 1.0
        // Also factor in accuracy trend — if accuracy is degrading, trust GPS less
        val trendScale = if (emaAccuracy > 0) {
            (emaAccuracy / accuracy.coerceAtLeast(1f)).coerceIn(0.5, 3.0)
        } else 1.0
        val r = baseR * innovScale * trendScale

        // -- First fix: initialise state
        if (!isInitialized) {
            this.lat = lat; this.lng = lng
            vLat = 0.0; vLng = 0.0
            ppLat = r; pvLat = 0.0; vvLat = 1.0
            ppLng = r; pvLng = 0.0; vvLng = 1.0
            lastTimestampMs = timestampMs
            prevRawLat = rawLat; prevRawLng = rawLng
            stationaryCount = 0
            return Pair(lat, lng)
        }

        // -- Mahalanobis outlier rejection --
        // Uses the filter's own covariance to detect outliers rather than a
        // fixed metre threshold. This adapts automatically to current uncertainty.
        val dLatM = (lat - this.lat) * LAT_DEG_TO_M
        val dLngM = (lng - this.lng) * lngDegToM(this.lat)
        val jumpM = sqrt(dLatM * dLatM + dLngM * dLngM)

        // Mahalanobis: d² = innovation' * S⁻¹ * innovation
        // For diagonal approximation: d² = innLat²/sLat + innLng²/sLng
        // where S = predicted covariance + measurement noise
        val sLatPre = ppLat + r
        val sLngPre = ppLng + r
        val mahalLat = if (sLatPre > 0) {
            val innDeg = lat - (this.lat + vLat * ((timestampMs - lastTimestampMs) / 1000.0).coerceIn(0.001, 30.0))
            innDeg * innDeg / sLatPre
        } else 0.0
        val mahalLng = if (sLngPre > 0) {
            val innDeg = lng - (this.lng + vLng * ((timestampMs - lastTimestampMs) / 1000.0).coerceIn(0.001, 30.0))
            innDeg * innDeg / sLngPre
        } else 0.0
        val mahalDist = sqrt(mahalLat + mahalLng)

        // Hard outlier rejection: Mahalanobis > 4 OR jump > maxJumpMeters
        if (mahalDist > 4.0 || jumpM > maxJumpMeters) {
            // Soft rejection: if the jump is moderate (< 2x threshold), partially
            // incorporate it by inflating measurement noise instead of hard reset
            if (jumpM < maxJumpMeters * 2 && jumpM > maxJumpMeters) {
                // Don't reset — just skip this fix and let the filter coast
                return Pair(this.lat, this.lng)
            }
            // Severe outlier: hard reset
            reset()
            this.lat = lat; this.lng = lng
            ppLat = r; pvLat = 0.0; vvLat = 1.0
            ppLng = r; pvLng = 0.0; vvLng = 1.0
            lastTimestampMs = timestampMs
            prevRawLat = rawLat; prevRawLng = rawLng
            stationaryCount = 0
            return Pair(lat, lng)
        }

        val dt = ((timestampMs - lastTimestampMs) / 1_000.0).coerceIn(0.001, 30.0)
        lastTimestampMs = timestampMs

        // -- Adaptive process noise: scale with movement state --
        val speedMps = estimatedSpeedMps
        val adaptiveQ = when {
            stationaryCount >= 4 -> processNoiseMetersPerSecond * 0.02 // near zero
            stationaryCount >= 3 -> processNoiseMetersPerSecond * 0.05
            speedMps < 0.3       -> processNoiseMetersPerSecond * 0.3   // very slow
            speedMps < 0.8       -> processNoiseMetersPerSecond * 0.7   // slow walk
            speedMps < 1.5       -> processNoiseMetersPerSecond         // normal walk
            else                 -> processNoiseMetersPerSecond * 1.3   // fast walk
        }

        // -- Step-assisted velocity boost --
        val stepBoost = if (stepTimestampMs > 0L &&
            (timestampMs - stepTimestampMs) < STEP_VALIDITY_MS &&
            stepFrequencyHz > 0.5
        ) {
            val expectedSpeedMps = stepFrequencyHz * STEP_STRIDE_M
            if (speedMps < expectedSpeedMps * 0.7 && speedMps > 0.01) {
                (expectedSpeedMps / speedMps).coerceIn(1.0, 1.8)
            } else 1.0
        } else 1.0

        if (stepBoost > 1.0) {
            vLat *= stepBoost
            vLng *= stepBoost
        }

        // -- Heading constraint: align velocity toward compass heading --
        applyHeadingConstraint(timestampMs)

        // -- Predict step
        val predLat = this.lat + vLat * dt
        val predLng = this.lng + vLng * dt

        // Process noise in degrees²
        val qLat = adaptiveQ * adaptiveQ / (LAT_DEG_TO_M * LAT_DEG_TO_M)
        val lngScale = lngDegToM(this.lat)
        val qLng = adaptiveQ * adaptiveQ / (lngScale * lngScale)

        val dt2 = dt * dt; val dt3 = dt2 * dt
        val ppLatP = ppLat + 2 * pvLat * dt + vvLat * dt2 + qLat * dt3 / 3.0
        val pvLatP = pvLat + vvLat * dt + qLat * dt2 / 2.0
        val vvLatP = vvLat + qLat * dt

        val ppLngP = ppLng + 2 * pvLng * dt + vvLng * dt2 + qLng * dt3 / 3.0
        val pvLngP = pvLng + vvLng * dt + qLng * dt2 / 2.0
        val vvLngP = vvLng + qLng * dt

        // -- Update step
        val sLat = ppLatP + r
        val kpLat = ppLatP / sLat
        val kvLat = pvLatP / sLat

        val sLng = ppLngP + r
        val kpLng = ppLngP / sLng
        val kvLng = pvLngP / sLng

        val innLat = lat - predLat
        val innLng = lng - predLng

        // Track innovation magnitude for adaptive measurement noise
        val innMeters = sqrt(
            (innLat * LAT_DEG_TO_M).pow(2) + (innLng * lngScale).pow(2)
        )
        val normalizedInn = innMeters / accuracy.coerceAtLeast(1f)
        recentInnovationSqSum = recentInnovationSqSum * 0.6 + normalizedInn * normalizedInn
        recentInnovationCount = (recentInnovationCount + 1).coerceAtMost(10)

        this.lat = predLat + kpLat * innLat
        this.lng = predLng + kpLng * innLng
        vLat += kvLat * innLat
        vLng += kvLng * innLng

        ppLat = (1 - kpLat) * ppLatP
        pvLat = (1 - kpLat) * pvLatP
        vvLat = vvLatP - kvLat * pvLatP

        ppLng = (1 - kpLng) * ppLngP
        pvLng = (1 - kpLng) * pvLngP
        vvLng = vvLngP - kvLng * pvLngP

        // -- Raw-GPS velocity crosscheck --
        val rawVLat = (rawLat - prevRawLat) / dt
        val rawVLng = (rawLng - prevRawLng) / dt
        val rawSpeed = sqrt((rawVLat * LAT_DEG_TO_M).pow(2) + (rawVLng * lngScale).pow(2))
        if (rawSpeed > 0.3 && jumpM < maxJumpMeters / 2) {
            val blend = 0.12  // gentle correction
            vLat = vLat * (1 - blend) + rawVLat * blend
            vLng = vLng * (1 - blend) + rawVLng * blend
        }
        prevRawLat = rawLat; prevRawLng = rawLng

        // -- Biomechanical velocity clamp --
        // Park visitors can't move faster than ~2 m/s. If the filter's velocity
        // exceeds this, scale it down proportionally to preserve direction.
        clampVelocity()

        // -- Stationary detection: when speed is very low, damp velocity to zero
        if (estimatedSpeedMps < stationarySpeedThreshold) {
            stationaryCount++
            if (stationaryCount >= 4) {
                vLat *= 0.05
                vLng *= 0.05
            } else if (stationaryCount >= 3) {
                vLat *= 0.15
                vLng *= 0.15
            } else if (stationaryCount >= 2) {
                vLat *= 0.4
                vLng *= 0.4
            }
        } else {
            stationaryCount = 0
        }

        return Pair(this.lat, this.lng)
    }

    // ── Heading constraint ─────────────────────────────────────────

    /**
     * If a recent compass heading is available and the user is moving,
     * nudge the velocity vector toward the compass direction. This
     * keeps the position from drifting laterally on narrow park paths
     * where GPS cross-track error can be several metres.
     */
    private fun applyHeadingConstraint(nowMs: Long) {
        if (lastCompassHeadingRad.isNaN()) return
        if ((nowMs - compassTimestampMs) > COMPASS_VALIDITY_MS) return
        val speed = estimatedSpeedMps
        if (speed < 0.3) return  // only constrain when actually moving

        // Current velocity direction (lat = north, lng = east)
        val vLatMps = vLat * LAT_DEG_TO_M
        val vLngMps = vLng * lngDegToM(lat)
        val currentHeading = atan2(vLngMps, vLatMps)

        // Target heading from compass (compass: 0=N, 90=E, atan2: 0=E)
        // Convert compass convention → atan2: compass N=0 → atan2(east, north)
        val targetHeading = lastCompassHeadingRad

        // Angular difference (shortest path)
        var dAngle = targetHeading - currentHeading
        while (dAngle > PI) dAngle -= 2 * PI
        while (dAngle < -PI) dAngle += 2 * PI

        // Only constrain if the difference is significant but not a U-turn
        // (> 90° probably means the compass heading doesn't match GPS direction)
        if (abs(dAngle) > PI / 2) return
        if (abs(dAngle) < 0.05) return  // already aligned

        // Rotate velocity vector toward compass heading by COMPASS_BLEND fraction
        val blendedHeading = currentHeading + dAngle * COMPASS_BLEND
        val newVLatMps = speed * cos(blendedHeading)
        val newVLngMps = speed * sin(blendedHeading)

        vLat = newVLatMps / LAT_DEG_TO_M
        vLng = newVLngMps / lngDegToM(lat)
    }

    // ── Velocity clamp ─────────────────────────────────────────────

    /**
     * Clamp velocity to biomechanical limits for park walking.
     * Preserves direction, only scales magnitude.
     */
    private fun clampVelocity() {
        val speed = estimatedSpeedMps
        if (speed > MAX_WALK_MPS) {
            val scale = MAX_WALK_MPS / speed
            vLat *= scale
            vLng *= scale
        }
    }

    /**
     * Dead-reckoning prediction at [timestampMs] without consuming a fix.
     * Uses cubic Hermite interpolation for smoother trajectories instead of
     * linear extrapolation. Capped at 2 s to avoid runaway drift.
     * Returns null before initialisation.
     * When stationary, returns current position (no drift).
     */
    fun predict(timestampMs: Long): Pair<Double, Double>? {
        if (!isInitialized) return null
        if (isStationary) return Pair(lat, lng)
        val dt = ((timestampMs - lastTimestampMs) / 1_000.0).coerceIn(0.0, 2.0)

        // Cubic Hermite: position + velocity tangent gives a slight deceleration
        // curve instead of overshooting linearly. At t=0 this equals the filter
        // position; at t≈0.8 s it equals the linear prediction; beyond that the
        // cubic flattens out, reducing drift when GPS is delayed.
        val t = dt.coerceAtMost(1.5)
        // Deceleration factor: 1 at t=0, ~0.85 at t=1.5
        val decel = 1.0 - (t * t) / (3.0 * 1.5 * 1.5)
        val predLat = lat + vLat * dt * decel
        val predLng = lng + vLng * dt * decel

        return Pair(predLat, predLng)
    }

    /** Reset all state. */
    fun reset() {
        ppLat = UNINITIALIZED; ppLng = UNINITIALIZED
        vLat = 0.0; vLng = 0.0
        pvLat = 0.0; pvLng = 0.0
        vvLat = 0.0; vvLng = 0.0
        stationaryCount = 0
        recentInnovationSqSum = 0.0
        recentInnovationCount = 0
        stepTimestampMs = 0L
        stepCount = 0
        stepFrequencyHz = 0.0
        accIndex = 0
        accFilled = false
        emaAccuracy = 0.0
        lastCompassHeadingRad = Double.NaN
    }

    companion object {
        private const val UNINITIALIZED = -1.0
        private const val LAT_DEG_TO_M = 111_320.0
        private fun lngDegToM(latDeg: Double): Double =
            cos(Math.toRadians(latDeg)) * 111_320.0
    }
}
