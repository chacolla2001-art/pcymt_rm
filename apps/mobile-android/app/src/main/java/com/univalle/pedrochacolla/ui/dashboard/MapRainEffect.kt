package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.pow
import kotlin.math.sin
import kotlin.random.Random

/**
 * Lluvia en el plano del mapa (coords. base), no en la pantalla.
 */
class MapRainEffect {

    var intensity = 0.45f
    var sizeMul = 1f

    fun setSizeMul(value: Float) {
        sizeMul = value.coerceIn(0.08f, 2.5f)
    }

    data class MapPlaneBounds(
        val minX: Float,
        val maxX: Float,
        val minY: Float,
        val maxY: Float,
    )

    data class RainTickOptions(
        val bounds: MapPlaneBounds,
        val containsPoint: ((Float, Float) -> Boolean)? = null,
    )

    private val fallers = mutableListOf<Faller>()
    private val ripples = mutableListOf<Ripple>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private var windPhase = 0f

    private val dropPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val dropTrailPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeCap = Paint.Cap.ROUND
    }
    private val rippleStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
    }
    private val rippleFillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private data class Faller(
        var bx: Float,
        var by: Float,
        var speed: Float,
        var r: Float,
        var layer: Int,
        var streak: Float,
        var groundY: Float,
        var drift: Float,
    )

    private data class Ripple(
        val bx: Float,
        val by: Float,
        var age: Float,
        val duration: Float,
        val maxR: Float,
    )

    companion object {
        private const val FALL_DX = 0.38f
        private const val FALL_DY = 1f
        private val FALL_LEN = hypot(FALL_DX.toDouble(), FALL_DY.toDouble()).toFloat()
        private val LAYER_ALPHA = floatArrayOf(0.42f, 0.68f, 0.92f)
        private val LAYER_SPEED = floatArrayOf(0.72f, 1f, 1.28f)

        fun ambientScreenScale(screenScale: Float, sizeMul: Float): Float {
            val zoomComp = maxOf(0.25f, screenScale).toDouble().pow(0.52).toFloat()
            return zoomComp * sizeMul
        }
    }

    fun clear() {
        fallers.clear()
        ripples.clear()
        windPhase = 0f
    }

    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) {
        containsPoint = fn
    }

    private fun inZone(bx: Float, by: Float): Boolean =
        containsPoint?.invoke(bx, by) ?: true

    private fun randomInBounds(bounds: MapPlaneBounds, fromTop: Boolean): Pair<Float, Float> {
        val spanX = bounds.maxX - bounds.minX
        val spanY = bounds.maxY - bounds.minY
        repeat(28) {
            val bx = bounds.minX + Random.nextFloat() * spanX
            val by = if (fromTop) {
                bounds.minY - 10f - Random.nextFloat() * spanY * 0.25f
            } else {
                bounds.minY + Random.nextFloat() * spanY * 0.95f
            }
            if (inZone(bx, by) || (!fromTop && inZone(bx, bounds.minY + spanY * 0.5f))) {
                return bx to by
            }
        }
        return (bounds.minX + spanX * 0.5f) to (bounds.minY + spanY * 0.35f)
    }

    private fun spawnFaller(bounds: MapPlaneBounds, spanX: Float, spanY: Float, fromTop: Boolean): Faller {
        val layer = Random.nextInt(3)
        val layerMul = LAYER_SPEED[layer]
        val (bx, by) = randomInBounds(bounds, fromTop)
        return Faller(
            bx = bx,
            by = by,
            speed = (6f + Random.nextFloat() * 12f) * layerMul,
            r = (0.9f + Random.nextFloat() * 1.6f) * (0.75f + layer * 0.22f),
            layer = layer,
            streak = 2.4f + Random.nextFloat() * 4.8f,
            groundY = bounds.minY + (0.1f + Random.nextFloat() * 0.9f) * spanY,
            drift = (Random.nextFloat() - 0.5f) * 0.35f,
        )
    }

    private fun pickGroundY(bounds: MapPlaneBounds, spanY: Float): Float {
        repeat(16) {
            val gy = bounds.minY + (0.1f + Random.nextFloat() * 0.9f) * spanY
            val gx = bounds.minX + Random.nextFloat() * (bounds.maxX - bounds.minX)
            if (inZone(gx, gy)) return gy
        }
        return bounds.minY + spanY * (0.2f + Random.nextFloat() * 0.7f)
    }

    fun tick(options: RainTickOptions, dt: Float = 1f) {
        containsPoint = options.containsPoint
        val bounds = options.bounds
        val spanX = bounds.maxX - bounds.minX
        val spanY = bounds.maxY - bounds.minY
        if (spanX <= 0f || spanY <= 0f) return

        val inten = intensity.coerceIn(0.2f, 1f)
        val target = (40 + inten * 130).toInt()

        while (fallers.size < target) {
            fallers.add(spawnFaller(bounds, spanX, spanY, fromTop = true))
        }
        while (fallers.size > target) fallers.removeAt(fallers.lastIndex)

        windPhase += 0.007f * dt
        val wind = sin(windPhase) * 0.14f + sin(windPhase * 2.3f) * 0.05f
        val speedMul = 0.55f + inten * 1.1f

        for (f in fallers) {
            val step = f.speed * speedMul * dt
            f.bx += (FALL_DX / FALL_LEN) * step + (wind + f.drift) * step * 0.22f
            f.by += (FALL_DY / FALL_LEN) * step

            if (!inZone(f.bx, f.by)) {
                val next = spawnFaller(bounds, spanX, spanY, fromTop = true)
                f.bx = next.bx
                f.by = next.by
                f.groundY = next.groundY
                f.speed = next.speed
                f.r = next.r
                f.layer = next.layer
                f.streak = next.streak
                f.drift = next.drift
                continue
            }

            if (f.by >= f.groundY) {
                if (inZone(f.bx, f.groundY)) addRipple(f.bx, f.groundY, inten)
                val next = spawnFaller(bounds, spanX, spanY, fromTop = true)
                f.bx = next.bx
                f.by = next.by
                f.groundY = pickGroundY(bounds, spanY)
                f.speed = next.speed
                f.r = next.r
                f.layer = next.layer
                f.streak = next.streak
                f.drift = next.drift
            }

            if (f.bx > bounds.maxX + 16f) f.bx = bounds.minX - 10f
            if (f.bx < bounds.minX - 16f) f.bx = bounds.maxX + 10f
        }

        ripples.forEach { it.age += dt }
        ripples.removeAll { it.age >= it.duration || !inZone(it.bx, it.by) }
        while (ripples.size > 55) ripples.removeAt(0)
    }

    private fun addRipple(bx: Float, by: Float, inten: Float) {
        if (Random.nextFloat() > 0.12f + inten * 0.72f) return
        ripples.add(
            Ripple(
                bx = bx,
                by = by,
                age = 0f,
                duration = 22f + Random.nextFloat() * 28f,
                maxR = 5f + Random.nextFloat() * 14f,
            ),
        )
        if (Random.nextFloat() < 0.18f + inten * 0.12f) {
            ripples.add(
                Ripple(
                    bx = bx + (Random.nextFloat() - 0.5f) * 6f,
                    by = by + (Random.nextFloat() - 0.5f) * 3f,
                    age = 0.5f + Random.nextFloat() * 2f,
                    duration = 18f + Random.nextFloat() * 20f,
                    maxR = 3f + Random.nextFloat() * 9f,
                ),
            )
        }
    }

    fun draw(
        canvas: Canvas,
        clipPath: Path?,
        toScreen: (bx: Float, by: Float) -> Pair<Float, Float>,
        screenScale: Float = 1f,
    ) {
        val inten = intensity.coerceIn(0.35f, 1f)
        val sr = ambientScreenScale(screenScale, sizeMul)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }

        val fallAngle = atan2(FALL_DY, FALL_DX)

        for (r in ripples) {
            if (!inZone(r.bx, r.by)) continue
            val t = r.age / r.duration
            val fade = (1f - t) * inten
            val (x, y) = toScreen(r.bx, r.by)
            val radius = r.maxR * sr * (0.1f + t * 1.15f)

            rippleStrokePaint.color = Color.argb((fade * 0.85f * 255).toInt().coerceIn(0, 255), 120, 210, 255)
            rippleStrokePaint.strokeWidth = (2.4f * sr * (1f - t * 0.55f)).coerceAtLeast(0.5f)
            canvas.drawOval(x - radius, y - radius * 0.36f, x + radius, y + radius * 0.36f, rippleStrokePaint)

            if (t < 0.45f) {
                rippleStrokePaint.color = Color.argb((fade * 0.95f * 255).toInt().coerceIn(0, 255), 235, 250, 255)
                rippleStrokePaint.strokeWidth = (1.2f * sr).coerceAtLeast(0.4f)
                val ir = radius * 0.38f
                canvas.drawOval(x - ir, y - ir * 0.4f, x + ir, y + ir * 0.4f, rippleStrokePaint)
            }

            rippleFillPaint.color = Color.argb((fade * 0.22f * 255).toInt().coerceIn(0, 255), 80, 175, 245)
            val fr = radius * 0.55f
            canvas.drawOval(x - fr, y - fr * 0.2f, x + fr, y + fr * 0.2f, rippleFillPaint)
        }

        for (f in fallers) {
            if (!inZone(f.bx, f.by)) continue
            val head = toScreen(f.bx, f.by)
            val tail = toScreen(
                f.bx - (FALL_DX / FALL_LEN) * f.streak * sizeMul,
                f.by - (FALL_DY / FALL_LEN) * f.streak * sizeMul,
            )
            val alpha = LAYER_ALPHA[f.layer] * inten
            val headR = f.r * sr * 0.75f

            dropTrailPaint.shader = LinearGradient(
                tail.first,
                tail.second,
                head.first,
                head.second,
                intArrayOf(
                    Color.argb(0, 100, 190, 255),
                    Color.argb((alpha * 0.25f * 255).toInt().coerceIn(0, 255), 130, 215, 255),
                    Color.argb((alpha * 255).toInt().coerceIn(0, 255), 235, 250, 255),
                ),
                floatArrayOf(0f, 0.55f, 1f),
                Shader.TileMode.CLAMP,
            )
            dropTrailPaint.strokeWidth = ((0.7f + f.layer * 0.35f) * sr).coerceAtLeast(0.45f)
            canvas.drawLine(tail.first, tail.second, head.first, head.second, dropTrailPaint)
            dropTrailPaint.shader = null

            canvas.save()
            canvas.translate(head.first, head.second)
            canvas.rotate(Math.toDegrees((fallAngle + PI / 2).toDouble()).toFloat())
            dropPaint.color = Color.argb((alpha * 0.95f * 255).toInt().coerceIn(0, 255), 220, 245, 255)
            canvas.drawOval(-headR * 0.55f, -headR, headR * 0.55f, headR, dropPaint)
            canvas.restore()
        }

        canvas.restore()
    }
}
