package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import kotlin.random.Random

class MapLightningEffect {
    private data class BoltPoint(val x: Float, val y: Float)

    private var flashAge = 0f
    private var flashDuration = 0f
    private var cooldown = 90f
    private var enabled = false
    private var rainIntensity = 0f
    private var bolt: List<BoltPoint>? = null
    private var branches: List<List<BoltPoint>> = emptyList()
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) clear()
    }

    fun setRainIntensity(value: Float) {
        rainIntensity = value.coerceIn(0f, 1f)
    }

    fun clear() {
        flashAge = 0f
        flashDuration = 0f
        cooldown = 60f
        bolt = null
        branches = emptyList()
    }

    private fun generateBolt() {
        val boltSide = 0.2f + Random.nextFloat() * 0.6f
        val segments = 7 + Random.nextInt(4)
        val main = mutableListOf(BoltPoint(boltSide, 0f))
        var x = boltSide
        val endY = 0.5f + Random.nextFloat() * 0.32f
        for (i in 1..segments) {
            val t = i / segments.toFloat()
            x += (Random.nextFloat() - 0.5f) * 0.11f
            x = x.coerceIn(0.05f, 0.95f)
            main.add(BoltPoint(x, t * endY))
        }
        bolt = main
        val branchList = mutableListOf<List<BoltPoint>>()
        val branchCount = 1 + Random.nextInt(2)
        for (b in 0 until branchCount) {
            val startIdx = 2 + Random.nextInt((main.size - 3).coerceAtLeast(1))
            val start = main[startIdx.coerceIn(0, main.lastIndex)]
            val branch = mutableListOf(start)
            var bx = start.x
            var by = start.y
            val dir = if (Random.nextBoolean()) 1f else -1f
            val steps = 2 + Random.nextInt(3)
            for (i in 0 until steps) {
                bx += dir * (0.03f + Random.nextFloat() * 0.06f)
                by += 0.04f + Random.nextFloat() * 0.07f
                bx = bx.coerceIn(0.03f, 0.97f)
                branch.add(BoltPoint(bx, by))
            }
            branchList.add(branch)
        }
        branches = branchList
    }

    fun tick(rainActive: Boolean, dt: Float = 1f) {
        if (flashDuration > 0f) {
            flashAge += dt
            if (flashAge >= flashDuration) {
                flashAge = 0f
                flashDuration = 0f
                bolt = null
                branches = emptyList()
                cooldown = 70f + Random.nextFloat() * 120f
            }
            return
        }
        if (!enabled || !rainActive || rainIntensity < 0.7f) return
        cooldown -= dt
        if (cooldown > 0f) return
        if (Random.nextFloat() > 0.018f + (rainIntensity - 0.7f) * 0.06f) return
        flashDuration = 4f + Random.nextFloat() * 6f
        flashAge = 0f
        cooldown = 80f + Random.nextFloat() * 140f
        bolt = null
        branches = emptyList()
        if (Random.nextFloat() < 0.55f) generateBolt()
    }

    private fun isFlashing() = flashDuration > 0f && flashAge < flashDuration

    private fun strokeBolt(canvas: Canvas, pts: List<BoltPoint>, w: Float, h: Float, width: Float, color: Int) {
        if (pts.size < 2) return
        strokePaint.color = color
        strokePaint.strokeWidth = width
        val path = Path()
        path.moveTo(pts[0].x * w, pts[0].y * h)
        for (i in 1 until pts.size) path.lineTo(pts[i].x * w, pts[i].y * h)
        canvas.drawPath(path, strokePaint)
    }

    fun draw(canvas: Canvas, clipPath: Path?, viewportW: Float, viewportH: Float) {
        if (!isFlashing()) return
        val t = flashAge / flashDuration
        val peak = if (t < 0.25f) t / 0.25f else 1f - (t - 0.25f) / 0.75f
        val alpha = (peak * 0.42f * 255).toInt()
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        fillPaint.color = Color.argb((alpha * 0.5f).toInt(), 255, 250, 215)
        canvas.drawRect(0f, 0f, viewportW, viewportH, fillPaint)
        fillPaint.color = Color.argb((alpha * 0.3f).toInt(), 255, 235, 150)
        canvas.drawRect(0f, viewportH * 0.06f, viewportW, viewportH * 0.41f, fillPaint)
        val b = bolt
        if (b != null) {
            val boltFade = maxOf(0f, 1f - t * 1.4f)
            if (boltFade > 0.02f) {
                val scale = minOf(viewportW, viewportH) / 320f + 0.6f
                val a = (boltFade * 255).toInt()
                strokeBolt(canvas, b, viewportW, viewportH, 7f * scale, Color.argb(a, 10, 10, 20))
                for (br in branches) strokeBolt(canvas, br, viewportW, viewportH, 4.5f * scale, Color.argb(a, 10, 10, 20))
                strokeBolt(canvas, b, viewportW, viewportH, 4f * scale, Color.argb(a, 255, 214, 40))
                for (br in branches) strokeBolt(canvas, br, viewportW, viewportH, 2.4f * scale, Color.argb(a, 255, 214, 40))
            }
        }
        canvas.restore()
    }
}
