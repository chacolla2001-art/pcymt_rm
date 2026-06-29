package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import com.univalle.pedrochacolla.utils.map.AmbientTickOptions
import com.univalle.pedrochacolla.utils.map.MapAmbientZone
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

class MapNightMistEffect {
    var intensity = 0.35f

    private data class Veil(var bx: Float, var by: Float, val r: Float, var phase: Float)

    private val veils = mutableListOf<Veil>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private var globalPhase = 0f
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    fun clear() { veils.clear(); globalPhase = 0f }
    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) { containsPoint = fn }

    private fun inZone(bx: Float, by: Float) = containsPoint?.invoke(bx, by) ?: true

    fun tick(options: AmbientTickOptions, dt: Float = 1f) {
        options.containsPoint?.let { containsPoint = it }
        val b = options.bounds
        if (b.maxX - b.minX <= 0f || b.maxY - b.minY <= 0f) return
        val inten = maxOf(0.15f, intensity)
        val target = MapAmbientZone.parkParticleTarget(2, 6, inten)
        while (veils.size < target) {
            val spanX = b.maxX - b.minX
            val spanY = b.maxY - b.minY
            var bx = b.minX + Random.nextFloat() * spanX
            var by = b.minY + Random.nextFloat() * spanY
            repeat(16) {
                bx = b.minX + Random.nextFloat() * spanX
                by = b.minY + Random.nextFloat() * spanY
                if (inZone(bx, by)) return@repeat
            }
            veils.add(Veil(bx, by, MapAmbientZone.parkPlanSize(22f + Random.nextFloat() * 38f), Random.nextFloat() * 6.28f))
        }
        while (veils.size > target) veils.removeAt(veils.lastIndex)
        globalPhase += 0.005f * dt
        for (v in veils) {
            v.phase += 0.008f * dt
            v.bx += sin(v.phase + globalPhase) * 0.05f * dt
            v.by += cos(v.phase * 0.85f) * 0.03f * dt
        }
    }

    fun draw(
        canvas: Canvas,
        clipPath: Path?,
        toScreen: (Float, Float) -> Pair<Float, Float>,
        screenScale: Float,
        isDarkTheme: Boolean,
        viewportW: Float,
        viewportH: Float,
    ) {
        if (!isDarkTheme) return
        val inten = maxOf(0.2f, intensity)
        val sr = MapAmbientZone.ambientScreenScale(screenScale, 1f)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        for (v in veils) {
            if (!inZone(v.bx, v.by)) continue
            val (x, y) = toScreen(v.bx, v.by)
            val pulse = 0.88f + sin(v.phase) * 0.12f
            val radius = v.r * sr * pulse
            fillPaint.shader = RadialGradient(
                x, y, radius,
                intArrayOf(
                    android.graphics.Color.argb((inten * 51).toInt(), 80, 120, 200),
                    android.graphics.Color.TRANSPARENT,
                ),
                floatArrayOf(0f, 1f),
                Shader.TileMode.CLAMP,
            )
            canvas.drawOval(x - radius, y - radius * 0.75f, x + radius, y + radius * 0.75f, fillPaint)
        }
        fillPaint.shader = null
        fillPaint.color = android.graphics.Color.argb((inten * 15).toInt(), 25, 40, 90)
        canvas.drawRect(0f, 0f, viewportW, viewportH, fillPaint)
        canvas.restore()
    }
}
