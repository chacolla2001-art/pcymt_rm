package com.univalle.pedrochacolla.utils.map

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.univalle.pedrochacolla.data.model.AmbientTreeSlotData
import com.univalle.pedrochacolla.data.model.GroundElementSpecData
import com.univalle.pedrochacolla.data.model.GroundMapSettingsData
import com.univalle.pedrochacolla.data.model.ZoneGroundStyleData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/** Suelo procedural simplificado — port parcial de `draw-ground-texture.ts`. */
object MapGroundRenderer {
    data class Viewport(val minX: Float, val minY: Float, val maxX: Float, val maxY: Float)

    private data class GroundPalette(val base: Int, val accent: Int, val speck: Int, val line: Int, val light: Int)

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val path = Path()
    private val rect = RectF()

    fun parseGroundStyle(raw: Map<String, ZoneGroundStyleData>?): Map<Int, ZoneGroundStyleData> {
        if (raw.isNullOrEmpty()) return emptyMap()
        return raw.mapNotNull { (k, v) -> k.toIntOrNull()?.let { it to v } }.toMap()
    }

    fun drawMapBackdrop(
        canvas: Canvas,
        w: Float,
        h: Float,
        isDark: Boolean,
        mapScale: Float,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
    ) {
        val pad = max(w, h) * 2f
        val palette = mapBackdropPalette(isDark)
        fillPaint.color = palette.base
        canvas.drawRect(-pad, -pad, w + pad, h + pad, fillPaint)
        val style = groundStyle[-2] ?: emptyZoneStyle()
        scatterInRect(canvas, palette, style, -pad, -pad, w + pad, h + pad, mapScale, settings, viewport)
    }

    fun drawPolygonLayer(
        canvas: Canvas,
        points: List<ParkMapView.ScreenPoint>,
        sectionIndex: Int,
        isDark: Boolean,
        mapScale: Float,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
    ) {
        if (points.size < 3) return
        path.reset()
        path.moveTo(points[0].x, points[0].y)
        for (i in 1 until points.size) path.lineTo(points[i].x, points[i].y)
        path.close()
        val palette = paletteForSection(sectionIndex, isDark)
        canvas.save()
        canvas.clipPath(path)
        fillPaint.color = palette.base
        canvas.drawPath(path, fillPaint)
        val bounds = polygonBounds(points)
        val style = groundStyle[sectionIndex] ?: emptyZoneStyle()
        scatterInRect(canvas, palette, style, bounds.left, bounds.top, bounds.right, bounds.bottom, mapScale, settings, viewport)
        canvas.restore()
    }

    private fun polygonBounds(points: List<ParkMapView.ScreenPoint>): RectF {
        var minX = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY
        for (p in points) {
            minX = min(minX, p.x)
            maxX = max(maxX, p.x)
            minY = min(minY, p.y)
            maxY = max(maxY, p.y)
        }
        return RectF(minX, minY, maxX, maxY)
    }

    private fun emptyZoneStyle() = ZoneGroundStyleData(elements = emptyList())

    private fun paletteForSection(sectionIndex: Int, isDark: Boolean): GroundPalette = when (sectionIndex) {
        0 -> if (isDark) GroundPalette(
            Color.parseColor("#5A4A30"), Color.parseColor("#46381F"), Color.parseColor("#6A5C44"),
            Color.parseColor("#241A0E"), Color.parseColor("#7A6640"),
        ) else GroundPalette(
            Color.parseColor("#D8B878"), Color.parseColor("#C09A55"), Color.parseColor("#9A8B73"),
            Color.parseColor("#6B4F2A"), Color.parseColor("#EAD6A0"),
        )
        2 -> if (isDark) GroundPalette(
            Color.parseColor("#1A5028"), Color.parseColor("#103A1C"), Color.parseColor("#5A4A2A"),
            Color.parseColor("#06200E"), Color.parseColor("#2E8B40"),
        ) else GroundPalette(
            Color.parseColor("#2E8B40"), Color.parseColor("#1F6B30"), Color.parseColor("#8A6A3C"),
            Color.parseColor("#0E3A1A"), Color.parseColor("#5CC85E"),
        )
        -2 -> mapBackdropPalette(isDark)
        else -> if (sectionIndex < 0) parkBasePalette(isDark) else if (isDark) GroundPalette(
            Color.parseColor("#3E6A22"), Color.parseColor("#2E5418"), Color.parseColor("#7A8E3A"),
            Color.parseColor("#16300C"), Color.parseColor("#5A8E30"),
        ) else GroundPalette(
            Color.parseColor("#7DBE3F"), Color.parseColor("#69A82F"), Color.parseColor("#D8C84A"),
            Color.parseColor("#2E5418"), Color.parseColor("#A6E060"),
        )
    }

    private fun parkBasePalette(isDark: Boolean) = if (isDark) GroundPalette(
        Color.parseColor("#3A4632"), Color.parseColor("#2C3626"), Color.parseColor("#46523A"),
        Color.parseColor("#1A2014"), Color.parseColor("#52624A"),
    ) else GroundPalette(
        Color.parseColor("#8FA86A"), Color.parseColor("#79925A"), Color.parseColor("#6E8050"),
        Color.parseColor("#41502E"), Color.parseColor("#A8C084"),
    )

    private fun mapBackdropPalette(isDark: Boolean) = if (isDark) GroundPalette(
        Color.parseColor("#252B33"), Color.parseColor("#323A45"), Color.parseColor("#3A424E"),
        Color.parseColor("#161A20"), Color.parseColor("#3E4754"),
    ) else GroundPalette(
        Color.parseColor("#AEB8A6"), Color.parseColor("#98A28E"), Color.parseColor("#888F7E"),
        Color.parseColor("#6E7866"), Color.parseColor("#C6CEBE"),
    )

    private fun scatterInRect(
        canvas: Canvas,
        palette: GroundPalette,
        style: ZoneGroundStyleData,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        mapScale: Float,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
    ) {
        val elements = style.elements.orEmpty().filter { (it.density) > 0.01 }
        if (elements.isEmpty()) return
        val quality = ((settings?.qualityPercent ?: 85.0) / 100.0).coerceIn(0.25, 1.0)
        val scalePct = ((settings?.scalePercent ?: 100.0) / 100.0).coerceIn(0.5, 2.0)
        val unit = resolveTilePx(settings).toFloat() * scalePct.toFloat()
        if (mapScale < 0.35f && settings?.lodEnabled != false) return
        val region = intersect(left, top, right, bottom, viewport)
        if (region.width() <= 0f || region.height() <= 0f) return
        val cell = max(5f, unit * 1.2f)
        var cy = region.top
        var row = 0
        while (cy <= region.bottom) {
            var cx = region.left + (row % 2) * cell * 0.5f
            while (cx <= region.right) {
                for (el in elements) {
                    val budget = (el.density * quality * 0.35).toInt().coerceAtLeast(0)
                    if (budget == 0) continue
                    val seed = (cx * 12.9898f + cy * 78.233f + el.type.hashCode()).toLong()
                    val rand = Random(seed)
                    if (rand.nextDouble() > el.density * quality) continue
                    val size = unit * (el.sizeMin + rand.nextDouble() * (el.sizeMax - el.sizeMin)).toFloat()
                    drawElement(canvas, palette, el.type, cx, cy, size, rand)
                }
                cx += cell
            }
            cy += cell
            row++
        }
    }

    private fun drawElement(
        canvas: Canvas,
        palette: GroundPalette,
        type: String,
        x: Float,
        y: Float,
        size: Float,
        rand: Random,
    ) {
        when (type) {
            "stone", "pebbles" -> {
                fillPaint.color = palette.speck
                canvas.drawOval(RectF(x - size, y - size * 0.72f, x + size, y + size * 0.72f), fillPaint)
                strokePaint.color = palette.line
                strokePaint.strokeWidth = max(0.5f, size * 0.08f)
                canvas.drawOval(RectF(x - size, y - size * 0.72f, x + size, y + size * 0.72f), strokePaint)
            }
            "grass", "reed" -> {
                strokePaint.color = palette.line
                strokePaint.strokeWidth = max(0.6f, size * 0.12f)
                strokePaint.strokeCap = Paint.Cap.ROUND
                for (i in 0..2) {
                    val a = -0.4f + i * 0.4f + rand.nextFloat() * 0.2f
                    path.reset()
                    path.moveTo(x, y)
                    path.lineTo(x + kotlin.math.sin(a) * size, y - kotlin.math.cos(a) * size * 1.2f)
                    strokePaint.color = if (i % 2 == 0) palette.accent else palette.light
                    canvas.drawPath(path, strokePaint)
                }
            }
            "patch" -> {
                fillPaint.color = if (rand.nextBoolean()) palette.accent else palette.light
                fillPaint.alpha = 102
                canvas.drawOval(RectF(x - size, y - size * 0.78f, x + size, y + size * 0.78f), fillPaint)
                fillPaint.alpha = 255
            }
            else -> {
                fillPaint.color = palette.speck
                canvas.drawCircle(x, y, size * 0.45f, fillPaint)
            }
        }
    }

    private fun resolveTilePx(settings: GroundMapSettingsData?): Int {
        val preset = settings?.presetId ?: "balanced"
        val base = when (preset) {
            "performance" -> 8
            "subtle" -> 6
            "rich", "carbot" -> 4
            else -> 5
        }
        return base
    }

    private fun intersect(l: Float, t: Float, r: Float, b: Float, vp: Viewport): RectF {
        return RectF(
            max(l, vp.minX),
            max(t, vp.minY),
            min(r, vp.maxX),
            min(b, vp.maxY),
        )
    }
}
