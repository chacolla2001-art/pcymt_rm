package com.univalle.pedrochacolla.utils.map

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Árboles cartoon isométricos — port de `draw-simple-tree.ts` (web-admin).
 */
object SimpleTreeDrawer {
    private const val TREE_MIN_WORLD = 4f
    private const val TREE_BASE_WORLD = 8f

    private data class TreeCanopyPalette(
        val light: Int,
        val mid: Int,
        val dark: Int,
        val highlight: Int,
        val stroke: Int,
        val trunk: Int,
        val trunkDark: Int,
    )

    private data class TreeZoneStyle(val scale: Float, val outline: Float, val shadowW: Float)

    private data class Lobe(val x: Float, val y: Float, val r: Float)

    private val treeStyle = mapOf(
        0 to TreeZoneStyle(1f, 0.045f, 0.66f),
        1 to TreeZoneStyle(1f, 0.045f, 0.8f),
        2 to TreeZoneStyle(1.02f, 0.05f, 0.98f),
    )

    private val bloomJacaranda = intArrayOf(Color.parseColor("#9B6FD4"), Color.parseColor("#553B86"))
    private val bloomToborochi = intArrayOf(Color.parseColor("#F58FBE"), Color.parseColor("#B85A86"))

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val path = Path()
    private val rect = RectF()

    fun drawSimpleTree(
        canvas: Canvas,
        footX: Float,
        footY: Float,
        height: Float,
        seed: Double,
        variant: Int,
        isDark: Boolean,
        section: Int,
        sizeMul: Float = 1f,
    ) {
        val colors = treePaletteForSection(section, isDark)
        val rand = seededTreeRand(seed * 131.7 + section * 17 + variant * 5 + 3)
        val cfg = treeStyle[section] ?: treeStyle[1]!!
        val h = max(TREE_MIN_WORLD, height * cfg.scale * sizeMul)
        val lw = max(0.6f, h * cfg.outline)
        val v = ((variant % 3) + 3) % 3
        canvas.save()
        canvas.translate(footX, footY)
        drawGroundShadow(canvas, h * cfg.shadowW, isDark)
        when (section.coerceIn(0, 2)) {
            0 -> when (v) {
                0 -> quenua(canvas, h, colors, lw, rand)
                1 -> kiswara(canvas, h, colors, lw)
                else -> kiswara(canvas, h, colors, lw)
            }
            2 -> when (v) {
                0 -> toborochi(canvas, h, colors, lw, rand)
                1 -> palmera(canvas, h, colors, lw, rand)
                else -> toborochi(canvas, h, colors, lw, rand)
            }
            else -> when (v) {
                0 -> molle(canvas, h, colors, lw, rand)
                1 -> jacaranda(canvas, h, colors, lw, rand)
                else -> tipa(canvas, h, colors, lw)
            }
        }
        canvas.restore()
    }

    fun defaultTreeHeight(scaleMul: Float, slotScale: Double): Float =
        TREE_BASE_WORLD * scaleMul * slotScale.toFloat()

    private fun treePaletteForSection(section: Int, isDark: Boolean): TreeCanopyPalette = when (section) {
        0 -> if (isDark) TreeCanopyPalette(
            Color.parseColor("#3E8A52"), Color.parseColor("#256A3A"), Color.parseColor("#164A28"),
            Color.parseColor("#7FD08A"), Color.parseColor("#08200F"),
            Color.parseColor("#7A3A24"), Color.parseColor("#4E2414"),
        ) else TreeCanopyPalette(
            Color.parseColor("#5BB562"), Color.parseColor("#2F7D44"), Color.parseColor("#1C5530"),
            Color.parseColor("#9FE0A0"), Color.parseColor("#0C2A16"),
            Color.parseColor("#9A4A2E"), Color.parseColor("#63301C"),
        )
        2 -> if (isDark) TreeCanopyPalette(
            Color.parseColor("#3FB055"), Color.parseColor("#1F7A38"), Color.parseColor("#125424"),
            Color.parseColor("#7FE889"), Color.parseColor("#06220E"),
            Color.parseColor("#5A3A24"), Color.parseColor("#382414"),
        ) else TreeCanopyPalette(
            Color.parseColor("#5FD46A"), Color.parseColor("#2E9E48"), Color.parseColor("#1A6E30"),
            Color.parseColor("#A6F0A0"), Color.parseColor("#0A3018"),
            Color.parseColor("#7A4E32"), Color.parseColor("#4E3020"),
        )
        else -> if (isDark) TreeCanopyPalette(
            Color.parseColor("#7FCC48"), Color.parseColor("#4F9628"), Color.parseColor("#356E1A"),
            Color.parseColor("#C2F074"), Color.parseColor("#0E2A0A"),
            Color.parseColor("#6A4628"), Color.parseColor("#432C18"),
        ) else TreeCanopyPalette(
            Color.parseColor("#A6E85A"), Color.parseColor("#6FC23A"), Color.parseColor("#4A8E24"),
            Color.parseColor("#D8F79A"), Color.parseColor("#163A10"),
            Color.parseColor("#8A5E3C"), Color.parseColor("#5A3A22"),
        )
    }

    private fun seededTreeRand(seed: Double): () -> Double {
        var s = (abs(seed.toLong()) % 2147483646L).toInt().let { if (it == 0) 1 else it }
        return {
            s = (s * 16807) % 2147483647
            (s - 1) / 2147483646.0
        }
    }

    private fun paintLobes(canvas: Canvas, lobes: List<Lobe>, colors: TreeCanopyPalette, lw: Float) {
        fillPaint.color = colors.stroke
        for (l in lobes) canvas.drawCircle(l.x, l.y, l.r + lw, fillPaint)
        fillPaint.color = colors.dark
        for (l in lobes) canvas.drawCircle(l.x, l.y, l.r, fillPaint)
        for (l in lobes) {
            canvas.save()
            path.reset()
            path.addCircle(l.x, l.y, l.r, Path.Direction.CW)
            canvas.clipPath(path)
            fillPaint.color = colors.mid
            canvas.drawCircle(l.x - l.r * 0.16f, l.y - l.r * 0.18f, l.r * 0.94f, fillPaint)
            fillPaint.color = colors.light
            canvas.drawCircle(l.x - l.r * 0.32f, l.y - l.r * 0.36f, l.r * 0.6f, fillPaint)
            canvas.restore()
        }
        var top = lobes.first()
        for (l in lobes) if (l.y - l.r < top.y - top.r) top = l
        fillPaint.color = Color.argb(128, 255, 255, 255)
        canvas.drawCircle(top.x - top.r * 0.34f, top.y - top.r * 0.4f, top.r * 0.22f, fillPaint)
    }

    private fun trunkTrapezoid(canvas: Canvas, trunkH: Float, trunkW: Float, colors: TreeCanopyPalette, lw: Float): Float {
        val baseW = trunkW * 1.1f
        val topW = trunkW * 0.72f
        path.reset()
        path.moveTo(-baseW / 2f, 0f)
        path.lineTo(-topW / 2f, -trunkH)
        path.lineTo(topW / 2f, -trunkH)
        path.lineTo(baseW / 2f, 0f)
        path.close()
        fillPaint.color = colors.trunk
        canvas.drawPath(path, fillPaint)
        canvas.save()
        canvas.clipPath(path)
        fillPaint.color = colors.trunkDark
        rect.set(0f, -trunkH, baseW, 0f)
        canvas.drawRect(rect, fillPaint)
        canvas.restore()
        strokePaint.color = colors.stroke
        strokePaint.strokeWidth = lw
        canvas.drawPath(path, strokePaint)
        return -trunkH
    }

    private fun drawGroundShadow(canvas: Canvas, w: Float, isDark: Boolean) {
        fillPaint.color = Color.argb(if (isDark) 87 else 51, 0, 0, 0)
        rect.set(-w * 0.42f, -w * 0.13f, w * 0.42f, w * 0.15f)
        canvas.drawOval(rect, fillPaint)
    }

    private fun quenua(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float, rand: () -> Double) {
        val w = h * 0.72f
        val trunkH = h * 0.42f
        val lean = ((rand() - 0.5) * w * 0.16).toFloat()
        val topY = -trunkH
        strokePaint.strokeCap = Paint.Cap.ROUND
        strokePaint.color = colors.trunk
        strokePaint.strokeWidth = w * 0.16f + lw
        path.reset()
        path.moveTo(0f, 0f)
        path.quadTo(w * 0.1f, -trunkH * 0.5f, lean, topY)
        canvas.drawPath(path, strokePaint)
        val cy = topY
        paintLobes(
            canvas,
            listOf(
                Lobe(lean, cy - h * 0.16f, w * 0.27f),
                Lobe(lean - w * 0.22f, cy - h * 0.06f, w * 0.2f),
                Lobe(lean + w * 0.22f, cy - h * 0.06f, w * 0.2f),
            ),
            colors,
            lw,
        )
    }

    private fun kiswara(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float) {
        val w = h * 0.58f
        val cb = trunkTrapezoid(canvas, h * 0.48f, w * 0.13f, colors, lw)
        paintLobes(
            canvas,
            listOf(
                Lobe(0f, cb - h * 0.18f, w * 0.34f),
                Lobe(-w * 0.22f, cb - h * 0.06f, w * 0.22f),
                Lobe(w * 0.22f, cb - h * 0.06f, w * 0.22f),
            ),
            colors,
            lw,
        )
    }

    private fun molle(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float, rand: () -> Double) {
        val w = h * 0.82f
        val cb = trunkTrapezoid(canvas, h * 0.32f, w * 0.12f, colors, lw)
        paintLobes(
            canvas,
            listOf(
                Lobe(-w * 0.3f, cb - h * 0.32f, w * 0.3f),
                Lobe(w * 0.3f, cb - h * 0.32f, w * 0.3f),
                Lobe(0f, cb - h * 0.5f, w * 0.4f),
            ),
            colors,
            lw,
        )
    }

    private fun jacaranda(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float, rand: () -> Double) {
        val w = h * 0.8f
        val cb = trunkTrapezoid(canvas, h * 0.3f, w * 0.12f, colors, lw)
        val lobes = listOf(
            Lobe(-w * 0.26f, cb - h * 0.34f, w * 0.3f),
            Lobe(w * 0.26f, cb - h * 0.34f, w * 0.3f),
            Lobe(0f, cb - h * 0.52f, w * 0.4f),
        )
        paintLobes(canvas, lobes, colors, lw)
        bloomDots(canvas, lobes, bloomJacaranda, rand, max(0.8f, w * 0.05f), 12)
    }

    private fun tipa(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float) {
        val w = h * 0.96f
        val cb = trunkTrapezoid(canvas, h * 0.3f, w * 0.12f, colors, lw)
        paintLobes(
            canvas,
            listOf(
                Lobe(-w * 0.36f, cb - h * 0.3f, w * 0.3f),
                Lobe(w * 0.36f, cb - h * 0.3f, w * 0.3f),
                Lobe(0f, cb - h * 0.42f, w * 0.34f),
            ),
            colors,
            lw,
        )
    }

    private fun toborochi(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float, rand: () -> Double) {
        val w = h * 0.9f
        val cb = trunkTrapezoid(canvas, h * 0.44f, w * 0.16f, colors, lw)
        val lobes = listOf(
            Lobe(-w * 0.34f, cb - h * 0.1f, w * 0.3f),
            Lobe(w * 0.34f, cb - h * 0.1f, w * 0.3f),
            Lobe(0f, cb - h * 0.26f, w * 0.42f),
        )
        paintLobes(canvas, lobes, colors, lw)
        bloomDots(canvas, lobes, bloomToborochi, rand, max(0.9f, w * 0.055f), 10)
    }

    private fun palmera(canvas: Canvas, h: Float, colors: TreeCanopyPalette, lw: Float, rand: () -> Double) {
        val trunkH = h * 0.66f
        val lean = ((rand() - 0.4) * h * 0.16).toFloat()
        val tx = lean
        val ty = -trunkH
        strokePaint.strokeCap = Paint.Cap.ROUND
        strokePaint.color = colors.trunk
        strokePaint.strokeWidth = h * 0.1f + lw
        path.reset()
        path.moveTo(0f, 0f)
        path.quadTo(lean * 0.3f, -trunkH * 0.5f, tx, ty)
        canvas.drawPath(path, strokePaint)
        val fronds = 7
        for (i in 0 until fronds) {
            val a = (-PI * 0.94 + (i / (fronds - 1.0)) * PI * 0.88).toFloat()
            val len = h * (0.4f + rand().toFloat() * 0.12f)
            strokePaint.color = if (i % 2 == 0) colors.mid else colors.dark
            strokePaint.strokeWidth = lw * 1.8f
            path.reset()
            path.moveTo(tx, ty)
            path.quadTo(
                tx + cos(a) * len * 0.5f,
                ty + sin(a) * len * 0.4f,
                tx + cos(a) * len,
                ty + sin(a) * len * 0.78f + len * 0.18f,
            )
            canvas.drawPath(path, strokePaint)
        }
        fillPaint.color = colors.dark
        canvas.drawCircle(tx, ty, h * 0.06f, fillPaint)
    }

    private fun bloomDots(
        canvas: Canvas,
        lobes: List<Lobe>,
        bloom: IntArray,
        rand: () -> Double,
        r: Float,
        count: Int,
    ) {
        fillPaint.color = bloom[0]
        strokePaint.color = bloom[1]
        strokePaint.strokeWidth = r * 0.5f
        for (k in 0 until count) {
            val l = lobes[(rand() * lobes.size).toInt().coerceIn(0, lobes.lastIndex)]
            val a = rand() * PI * 2
            val rr = sqrt(rand()) * l.r * 0.82
            val x = l.x + (cos(a) * rr).toFloat()
            val y = l.y + (sin(a) * rr).toFloat()
            canvas.drawCircle(x, y, r, fillPaint)
        }
    }
}
