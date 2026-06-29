package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import com.univalle.pedrochacolla.utils.map.AmbientTickOptions
import com.univalle.pedrochacolla.utils.map.AmbientWind
import com.univalle.pedrochacolla.utils.map.MapAmbientZone
import kotlin.math.cos
import kotlin.random.Random

class MapLeavesEffect {
    var intensity = 0.45f
    var sizeMul = 1f
        set(value) { field = value.coerceIn(0.08f, 2.5f) }

    private data class Leaf(
        var bx: Float, var by: Float, var vx: Float, var vy: Float,
        var rot: Float, val spin: Float, val r: Float,
        val kind: Int, val hue: Int,
    )

    private val particles = mutableListOf<Leaf>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private var sectionAt: ((Float, Float) -> Int)? = null
    private var wind = AmbientWind()
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

    private val sectionWindBias = arrayOf(
        floatArrayOf(-0.08f, 0.04f),
        floatArrayOf(0.06f, 0.02f),
        floatArrayOf(0.05f, 0.1f),
    )

    fun clear() { particles.clear() }
    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) { containsPoint = fn }
    fun setSectionAt(fn: ((Float, Float) -> Int)?) { sectionAt = fn }

    private fun inZone(bx: Float, by: Float) = containsPoint?.invoke(bx, by) ?: true

    private fun windAt(bx: Float, by: Float): Pair<Float, Float> {
        val (wx, wy) = MapAmbientZone.ambientWindVector(wind)
        val idx = sectionAt?.invoke(bx, by) ?: -1
        val bias = if (idx in sectionWindBias.indices) sectionWindBias[idx] else floatArrayOf(0f, 0f)
        return (wx * 0.55f + bias[0]) to (wy * 0.45f + bias[1] + 0.2f)
    }

    private fun spawn(bounds: AmbientTickOptions): Leaf {
        val b = bounds.bounds
        val spanX = b.maxX - b.minX
        val spanY = b.maxY - b.minY
        var bx = b.minX + Random.nextFloat() * spanX
        var by = b.minY - 10f - Random.nextFloat() * spanY * 0.2f
        repeat(20) {
            bx = b.minX + Random.nextFloat() * spanX
            by = b.minY - 10f - Random.nextFloat() * spanY * 0.25f
            if (inZone(bx, by)) return@repeat
        }
        val (wx, wy) = windAt(bx, by)
        return Leaf(
            bx, by,
            wx + (Random.nextFloat() - 0.5f) * 0.12f,
            wy + 0.25f + Random.nextFloat() * 0.35f,
            Random.nextFloat() * 6.28f,
            (Random.nextFloat() - 0.5f) * 0.08f,
            1f + Random.nextFloat() * 1.8f,
            if (Random.nextFloat() > 0.45f) 1 else 0,
            if (Random.nextFloat() > 0.5f) 95 else 28,
        )
    }

    fun tick(options: AmbientTickOptions, dt: Float = 1f) {
        options.containsPoint?.let { containsPoint = it }
        wind = options.wind
        val b = options.bounds
        if (b.maxX - b.minX <= 0f || b.maxY - b.minY <= 0f) return
        val inten = maxOf(0.15f, intensity)
        val target = MapAmbientZone.parkParticleTarget(5, 18, inten)
        while (particles.size < target) particles.add(spawn(options))
        while (particles.size > target) particles.removeAt(particles.lastIndex)
        for (p in particles) {
            val (wx, wy) = windAt(p.bx, p.by)
            p.vx += (wx - p.vx) * 0.04f * dt
            p.vy += (wy + 0.3f - p.vy) * 0.03f * dt
            p.bx += p.vx * dt * 2.2f
            p.by += p.vy * dt * 2.2f
            p.rot += p.spin * dt
            if (!inZone(p.bx, p.by) || p.by > b.maxY + 25f) {
                val n = spawn(options)
                p.bx = n.bx; p.by = b.minY - 5f - Random.nextFloat() * 30f
                p.vx = n.vx; p.vy = n.vy; p.rot = n.rot
            }
        }
    }

    fun draw(canvas: Canvas, clipPath: Path?, toScreen: (Float, Float) -> Pair<Float, Float>, screenScale: Float) {
        val inten = maxOf(0.2f, intensity)
        val sr = MapAmbientZone.ambientScreenScale(screenScale, sizeMul)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        for (p in particles) {
            if (!inZone(p.bx, p.by)) continue
            val (x, y) = toScreen(p.bx, p.by)
            val r = maxOf(0.4f, p.r * sr)
            val alpha = (inten * 0.85f * 255).toInt().coerceIn(0, 255)
            canvas.save()
            canvas.translate(x, y)
            canvas.rotate(Math.toDegrees(p.rot.toDouble()).toFloat())
            val flip = 0.4f + 0.6f * kotlin.math.abs(cos(p.rot * 1.6f))
            canvas.scale(flip, 1f)
            if (p.kind == 0) {
                fillPaint.color = android.graphics.Color.HSVToColor(alpha, floatArrayOf(p.hue.toFloat(), 0.6f, 0.48f))
                strokePaint.color = android.graphics.Color.HSVToColor(alpha, floatArrayOf(p.hue.toFloat(), 0.55f, 0.22f))
                strokePaint.strokeWidth = maxOf(0.3f, r * 0.18f)
                canvas.drawOval(-r * 0.5f, -r, r * 0.5f, r, fillPaint)
                canvas.drawOval(-r * 0.5f, -r, r * 0.5f, r, strokePaint)
            } else {
                fillPaint.color = android.graphics.Color.HSVToColor(alpha, floatArrayOf(p.hue.toFloat(), 0.78f, 0.7f))
                canvas.drawOval(-r * 0.6f, -r, r * 0.6f, r, fillPaint)
            }
            canvas.restore()
        }
        canvas.restore()
    }
}
