package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import com.univalle.pedrochacolla.utils.map.AmbientTickOptions
import com.univalle.pedrochacolla.utils.map.AmbientWind
import com.univalle.pedrochacolla.utils.map.MapAmbientZone
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/** Niebla cartoon — port de `map-fog-effect.ts`. */
class MapFogEffect {
    var intensity = 0.35f
    var sizeMul = 1f
        set(value) { field = value.coerceIn(0.08f, 2.5f) }

    private data class Patch(
        var bx: Float, var by: Float, var vx: Float, var vy: Float,
        val r: Float, var phase: Float,
    )

    private val patches = mutableListOf<Patch>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    fun clear() { patches.clear() }
    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) { containsPoint = fn }

    private fun inZone(bx: Float, by: Float) = containsPoint?.invoke(bx, by) ?: true

    private fun spawn(bounds: AmbientTickOptions, wind: AmbientWind): Patch {
        val spanX = bounds.bounds.maxX - bounds.bounds.minX
        val spanY = bounds.bounds.maxY - bounds.bounds.minY
        var bx = bounds.bounds.minX + Random.nextFloat() * spanX
        var by = bounds.bounds.minY + Random.nextFloat() * spanY
        repeat(20) {
            bx = bounds.bounds.minX + Random.nextFloat() * spanX
            by = bounds.bounds.minY + Random.nextFloat() * spanY
            if (inZone(bx, by)) return@repeat
        }
        val (wx, wy) = MapAmbientZone.ambientWindVector(wind)
        return Patch(
            bx, by,
            wx * 0.35f + (Random.nextFloat() - 0.5f) * 0.12f,
            wy * 0.28f + (Random.nextFloat() - 0.5f) * 0.1f,
            MapAmbientZone.parkPlanSize(18f + Random.nextFloat() * 32f),
            Random.nextFloat() * 6.28f,
        )
    }

    fun tick(options: AmbientTickOptions, dt: Float = 1f) {
        options.containsPoint?.let { containsPoint = it }
        val wind = options.wind
        val bounds = options.bounds
        val spanX = bounds.maxX - bounds.minX
        val spanY = bounds.maxY - bounds.minY
        if (spanX <= 0f || spanY <= 0f) return
        val inten = maxOf(0.15f, intensity)
        val target = MapAmbientZone.parkParticleTarget(3, 9, inten)
        while (patches.size < target) patches.add(spawn(options, wind))
        while (patches.size > target) patches.removeAt(patches.lastIndex)
        val (wx, wy) = MapAmbientZone.ambientWindVector(wind)
        for (p in patches) {
            p.phase += 0.012f * dt
            p.vx += (wx * 0.35f - p.vx) * 0.03f * dt
            p.vy += (wy * 0.28f - p.vy) * 0.03f * dt
            p.bx += p.vx * dt + sin(p.phase) * 0.08f * dt
            p.by += p.vy * dt + cos(p.phase * 0.8f) * 0.05f * dt
            if (!inZone(p.bx, p.by) || p.bx < bounds.minX - 20f || p.bx > bounds.maxX + 20f) {
                val n = spawn(options, wind)
                p.bx = n.bx; p.by = n.by; p.vx = n.vx; p.vy = n.vy; p.phase = n.phase
            }
        }
    }

    fun draw(
        canvas: Canvas,
        clipPath: Path?,
        toScreen: (Float, Float) -> Pair<Float, Float>,
        screenScale: Float,
    ) {
        val inten = maxOf(0.2f, intensity)
        val sr = MapAmbientZone.ambientScreenScale(screenScale, sizeMul)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        val puffs = arrayOf(
            floatArrayOf(-0.5f, 0.12f, 0.52f),
            floatArrayOf(0.5f, 0.12f, 0.52f),
            floatArrayOf(0f, -0.22f, 0.62f),
        )
        for (p in patches) {
            if (!inZone(p.bx, p.by)) continue
            val (x, y) = toScreen(p.bx, p.by)
            val pulse = 0.82f + sin(p.phase) * 0.18f
            val radius = p.r * sr * pulse
            for (pr in puffs) {
                val cx = x + pr[0] * radius
                val cy = y + pr[1] * radius * 0.7f
                val cr = pr[2] * radius
                fillPaint.shader = RadialGradient(
                    cx, cy, cr,
                    intArrayOf(
                        android.graphics.Color.argb((inten * 41).toInt(), 236, 244, 255),
                        android.graphics.Color.argb(0, 236, 244, 255),
                    ),
                    floatArrayOf(0.7f, 1f),
                    Shader.TileMode.CLAMP,
                )
                canvas.drawCircle(cx, cy, cr, fillPaint)
            }
        }
        fillPaint.shader = null
        canvas.restore()
    }
}
