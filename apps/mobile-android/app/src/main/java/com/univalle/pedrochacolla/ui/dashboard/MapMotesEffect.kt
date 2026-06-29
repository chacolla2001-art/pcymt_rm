package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import com.univalle.pedrochacolla.utils.map.AmbientTickOptions
import com.univalle.pedrochacolla.utils.map.AmbientWind
import com.univalle.pedrochacolla.utils.map.MapAmbientZone
import kotlin.math.sin
import kotlin.random.Random

class MapMotesEffect {
    var intensity = 0.4f
    var sizeMul = 1f
        set(value) { field = value.coerceIn(0.08f, 2.5f) }

    private data class Mote(
        var bx: Float, var by: Float, var vx: Float, var vy: Float,
        val r: Float, var phase: Float, val warm: Boolean,
    )

    private val motes = mutableListOf<Mote>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

    fun clear() { motes.clear() }
    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) { containsPoint = fn }

    private fun inZone(bx: Float, by: Float) = containsPoint?.invoke(bx, by) ?: true

    private fun spawn(bounds: AmbientTickOptions, wind: AmbientWind): Mote {
        val b = bounds.bounds
        val spanX = b.maxX - b.minX
        val spanY = b.maxY - b.minY
        var bx = b.minX + Random.nextFloat() * spanX
        var by = b.minY + Random.nextFloat() * spanY
        repeat(20) {
            bx = b.minX + Random.nextFloat() * spanX
            by = b.minY + Random.nextFloat() * spanY
            if (inZone(bx, by)) return@repeat
        }
        val (wx, wy) = MapAmbientZone.ambientWindVector(wind)
        return Mote(
            bx, by,
            wx * 0.22f + (Random.nextFloat() - 0.5f) * 0.18f,
            wy * 0.18f - 0.12f - Random.nextFloat() * 0.25f,
            0.28f + Random.nextFloat() * 0.65f,
            Random.nextFloat() * 6.28f,
            Random.nextFloat() > 0.55f,
        )
    }

    fun tick(options: AmbientTickOptions, dt: Float = 1f) {
        options.containsPoint?.let { containsPoint = it }
        val b = options.bounds
        val spanX = b.maxX - b.minX
        val spanY = b.maxY - b.minY
        if (spanX <= 0f || spanY <= 0f) return
        val inten = maxOf(0.15f, intensity)
        val target = MapAmbientZone.parkParticleTarget(8, 28, inten)
        while (motes.size < target) motes.add(spawn(options, options.wind))
        while (motes.size > target) motes.removeAt(motes.lastIndex)
        for (m in motes) {
            m.phase += 0.04f * dt
            m.bx += m.vx * dt + sin(m.phase) * 0.06f * dt
            m.by += m.vy * dt
            if (!inZone(m.bx, m.by) || m.by < b.minY - 30f || m.by > b.maxY + 20f) {
                val n = spawn(options, options.wind)
                m.bx = n.bx; m.by = b.maxY + Random.nextFloat() * spanY * 0.15f
                m.vx = n.vx; m.vy = n.vy; m.phase = n.phase
            }
        }
    }

    fun draw(canvas: Canvas, clipPath: Path?, toScreen: (Float, Float) -> Pair<Float, Float>, screenScale: Float) {
        val inten = maxOf(0.2f, intensity)
        val sr = MapAmbientZone.ambientScreenScale(screenScale, sizeMul)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        for (m in motes) {
            if (!inZone(m.bx, m.by)) continue
            val tw = 0.45f + sin(m.phase) * 0.55f
            val alpha = (inten * tw).coerceIn(0f, 1f)
            val (x, y) = toScreen(m.bx, m.by)
            val r = maxOf(0.25f, m.r * sr * 0.9f)
            val haloR = r * if (m.warm) 4.5f else 3f
            val haloA = (alpha * if (m.warm) 0.5f else 0.3f * 255).toInt()
            fillPaint.shader = RadialGradient(
                x, y, haloR,
                intArrayOf(
                    if (m.warm) android.graphics.Color.argb(haloA, 255, 224, 150)
                    else android.graphics.Color.argb(haloA, 200, 240, 255),
                    android.graphics.Color.TRANSPARENT,
                ),
                floatArrayOf(0f, 1f),
                Shader.TileMode.CLAMP,
            )
            canvas.drawCircle(x, y, haloR, fillPaint)
            fillPaint.shader = null
            val bodyR = r * 1.15f
            fillPaint.color = if (m.warm) android.graphics.Color.argb((alpha * 255).toInt(), 255, 206, 70)
            else android.graphics.Color.argb((alpha * 255).toInt(), 150, 220, 255)
            canvas.drawCircle(x, y, bodyR, fillPaint)
            strokePaint.color = if (m.warm) android.graphics.Color.argb((alpha * 255).toInt(), 120, 70, 0)
            else android.graphics.Color.argb((alpha * 255).toInt(), 20, 60, 110)
            strokePaint.strokeWidth = maxOf(0.3f, bodyR * 0.28f)
            canvas.drawCircle(x, y, bodyR, strokePaint)
            fillPaint.color = android.graphics.Color.argb((alpha * 255).toInt(), 255, 255, 255)
            canvas.drawCircle(x - bodyR * 0.15f, y - bodyR * 0.15f, bodyR * 0.45f, fillPaint)
        }
        canvas.restore()
    }
}
