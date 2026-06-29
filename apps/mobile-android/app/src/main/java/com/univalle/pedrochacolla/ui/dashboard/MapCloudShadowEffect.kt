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

class MapCloudShadowEffect {
    var intensity = 0.4f
    var sizeMul = 1f
        set(value) { field = value.coerceIn(0.08f, 2.5f) }

    private data class Blob(
        var bx: Float, var by: Float, val r: Float, val layer: Int, var phase: Float,
    )

    private val blobs = mutableListOf<Blob>()
    private var containsPoint: ((Float, Float) -> Boolean)? = null
    private var driftPhase = 0f
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    fun clear() { blobs.clear(); driftPhase = 0f }
    fun setContainsPoint(fn: ((Float, Float) -> Boolean)?) { containsPoint = fn }

    private fun inZone(bx: Float, by: Float) = containsPoint?.invoke(bx, by) ?: true

    private fun spawn(bounds: AmbientTickOptions, layer: Int): Blob {
        val b = bounds.bounds
        val spanX = b.maxX - b.minX
        val spanY = b.maxY - b.minY
        var bx = b.minX + Random.nextFloat() * spanX
        var by = b.minY + Random.nextFloat() * spanY
        repeat(16) {
            bx = b.minX + Random.nextFloat() * spanX
            by = b.minY + Random.nextFloat() * spanY
            if (inZone(bx, by)) return@repeat
        }
        val baseR = if (layer == 0) MapAmbientZone.parkPlanSize(32f + Random.nextFloat() * 48f)
        else MapAmbientZone.parkPlanSize(16f + Random.nextFloat() * 26f)
        return Blob(bx, by, baseR, layer, Random.nextFloat() * 6.28f)
    }

    fun tick(options: AmbientTickOptions, dt: Float = 1f) {
        options.containsPoint?.let { containsPoint = it }
        val b = options.bounds
        if (b.maxX - b.minX <= 0f || b.maxY - b.minY <= 0f) return
        val inten = maxOf(0.15f, intensity)
        val target = (2 + inten * 4).toInt() + (2 + inten * 5).toInt()
        while (blobs.size < target) blobs.add(spawn(options, blobs.size % 2))
        while (blobs.size > target) blobs.removeAt(blobs.lastIndex)
        driftPhase += 0.004f * dt
        val (wx, wy) = MapAmbientZone.ambientWindVector(options.wind)
        val windX = wx * 0.35f + sin(driftPhase) * 0.08f
        val windY = wy * 0.28f + cos(driftPhase * 0.7f) * 0.05f
        for (blob in blobs) {
            val parallax = if (blob.layer == 0) 0.35f else 0.85f
            blob.phase += 0.01f * dt
            blob.bx += (windX + sin(blob.phase) * 0.04f) * parallax * dt
            blob.by += (windY + cos(blob.phase * 0.9f) * 0.03f) * parallax * dt
            if (!inZone(blob.bx, blob.by) || blob.bx < b.minX - 40f || blob.bx > b.maxX + 40f) {
                val n = spawn(options, blob.layer)
                blob.bx = n.bx; blob.by = n.by; blob.phase = n.phase
            }
        }
    }

    fun draw(canvas: Canvas, clipPath: Path?, toScreen: (Float, Float) -> Pair<Float, Float>, screenScale: Float) {
        val inten = maxOf(0.2f, intensity)
        val sr = MapAmbientZone.ambientScreenScale(screenScale, sizeMul)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        for (b in blobs) {
            if (!inZone(b.bx, b.by)) continue
            val (x, y) = toScreen(b.bx, b.by)
            val pulse = 0.9f + sin(b.phase) * 0.1f
            val radius = b.r * sr * pulse
            val alpha = (inten * if (b.layer == 0) 0.14f else 0.22f * 255).toInt()
            fillPaint.shader = RadialGradient(
                x, y, radius,
                intArrayOf(
                    android.graphics.Color.argb((alpha * 0.9f).toInt(), 25, 35, 55),
                    android.graphics.Color.TRANSPARENT,
                ),
                floatArrayOf(0.1f, 1f),
                Shader.TileMode.CLAMP,
            )
            canvas.drawOval(x - radius, y - radius * 0.68f, x + radius, y + radius * 0.68f, fillPaint)
        }
        fillPaint.shader = null
        canvas.restore()
    }
}
