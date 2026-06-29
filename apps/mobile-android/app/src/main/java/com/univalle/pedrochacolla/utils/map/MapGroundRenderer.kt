package com.univalle.pedrochacolla.utils.map

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.univalle.pedrochacolla.data.model.GroundElementSpecData
import com.univalle.pedrochacolla.data.model.GroundMapSettingsData
import com.univalle.pedrochacolla.data.model.ZoneGroundStyleData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/** Suelo procedural simplificado — port de `draw-ground-texture.ts`. */
object MapGroundRenderer {
    data class Viewport(val minX: Float, val minY: Float, val maxX: Float, val maxY: Float)

    private data class GroundPalette(val base: Int, val accent: Int, val speck: Int, val line: Int, val light: Int)

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val path = Path()
    private val clipPath = Path()
    private val rect = RectF()

    fun parseGroundStyle(raw: Map<String, ZoneGroundStyleData>?): Map<Int, ZoneGroundStyleData> {
        if (raw.isNullOrEmpty()) return emptyMap()
        return raw.mapNotNull { (k, v) -> k.toIntOrNull()?.let { it to v } }.toMap()
    }

    /** Fondo mapa (-2): solo fuera del plano cuadrado. */
    fun drawMapBackdrop(
        canvas: Canvas,
        w: Float,
        h: Float,
        isDark: Boolean,
        mapScale: Float,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
        platePoints: List<ParkMapView.ScreenPoint>,
    ) {
        val pad = max(w, h) * 2f
        val palette = mapBackdropPalette(isDark)
        canvas.save()
        clipOutsideMapSquare(canvas, platePoints)
        fillPaint.color = palette.base
        canvas.drawRect(-pad, -pad, w + pad, h + pad, fillPaint)
        val style = groundStyle[-2] ?: emptyZoneStyle()
        scatterInRect(
            canvas, palette, style, -2, -pad, -pad, w + pad, h + pad,
            mapScale, settings, viewport,
        )
        canvas.restore()
    }

    /** Verde interior del contorno (bajo las zonas; no es la capa «Base parque»). */
    fun drawParkInteriorMatte(
        canvas: Canvas,
        boundaryPoints: List<ParkMapView.ScreenPoint>,
        isDark: Boolean,
    ) {
        if (boundaryPoints.size < 3) return
        val palette = parkInteriorGroundPalette(isDark)
        buildPolygonPath(boundaryPoints)
        fillPaint.color = palette.base
        canvas.drawPath(path, fillPaint)
    }

    /** Anillo base (-1): plano cuadrado menos contorno del parque. */
    fun drawParkGroundBase(
        canvas: Canvas,
        platePoints: List<ParkMapView.ScreenPoint>,
        boundaryPoints: List<ParkMapView.ScreenPoint>,
        isDark: Boolean,
        mapScale: Float,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
    ) {
        if (platePoints.size < 3 || boundaryPoints.size < 3) return
        canvas.save()
        clipParkBaseFrame(canvas, platePoints, boundaryPoints)
        val palette = paletteForSection(-1, isDark)
        fillPaint.color = palette.base
        buildPolygonPath(platePoints)
        canvas.drawPath(path, fillPaint)
        val bounds = polygonBounds(platePoints)
        val style = groundStyle[-1] ?: emptyZoneStyle()
        scatterInRect(
            canvas, palette, style, -1, bounds.left, bounds.top, bounds.right, bounds.bottom,
            mapScale, settings, viewport, skipElements = true,
        )
        canvas.restore()
    }

    /** Elementos de la base (-1) en el anillo plano−contorno. */
    fun drawParkGroundElements(
        canvas: Canvas,
        platePoints: List<ParkMapView.ScreenPoint>,
        boundaryPoints: List<ParkMapView.ScreenPoint>,
        isDark: Boolean,
        mapScale: Float,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
    ) {
        if (platePoints.size < 3 || boundaryPoints.size < 3) return
        val style = groundStyle[-1] ?: emptyZoneStyle()
        if (style.elements.orEmpty().none { it.density > 0.01 }) return
        val bounds = polygonBounds(platePoints)
        val pad = 3f
        canvas.save()
        clipParkBaseFrame(canvas, platePoints, boundaryPoints)
        val palette = paletteForSection(-1, isDark)
        scatterInRect(
            canvas, palette, style, -1,
            bounds.left - pad, bounds.top - pad, bounds.right + pad, bounds.bottom + pad,
            mapScale, settings, viewport,
        )
        canvas.restore()
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
        buildPolygonPath(points)
        val palette = paletteForSection(sectionIndex, isDark)
        canvas.save()
        canvas.clipPath(path)
        fillPaint.color = palette.base
        canvas.drawPath(path, fillPaint)
        val bounds = polygonBounds(points)
        val style = groundStyle[sectionIndex] ?: emptyZoneStyle()
        scatterInRect(
            canvas, palette, style, sectionIndex,
            bounds.left, bounds.top, bounds.right, bounds.bottom,
            mapScale, settings, viewport,
        )
        canvas.restore()
    }

    /** Recorta a todo lo que queda fuera del marco cuadrado del mapa (fondo, capa -2). */
    fun clipOutsideMapSquare(
        canvas: Canvas,
        squarePoints: List<ParkMapView.ScreenPoint>,
        margin: Float = 12000f,
    ) {
        clipPath.reset()
        clipPath.fillType = Path.FillType.EVEN_ODD
        clipPath.addRect(-margin, -margin, margin * 2, margin * 2, Path.Direction.CW)
        appendPolygonReversed(clipPath, squarePoints)
        canvas.clipPath(clipPath)
    }

    /** Recorta al anillo: cuadrado del mapa menos contorno irregular del parque. */
    fun clipParkBaseFrame(
        canvas: Canvas,
        squarePoints: List<ParkMapView.ScreenPoint>,
        parkContourPoints: List<ParkMapView.ScreenPoint>,
    ) {
        clipPath.reset()
        clipPath.fillType = Path.FillType.EVEN_ODD
        appendPolygon(clipPath, squarePoints)
        appendPolygonReversed(clipPath, parkContourPoints)
        canvas.clipPath(clipPath)
    }

    private fun buildPolygonPath(points: List<ParkMapView.ScreenPoint>) {
        path.reset()
        path.moveTo(points[0].x, points[0].y)
        for (i in 1 until points.size) path.lineTo(points[i].x, points[i].y)
        path.close()
    }

    private fun appendPolygon(target: Path, points: List<ParkMapView.ScreenPoint>) {
        if (points.isEmpty()) return
        target.moveTo(points[0].x, points[0].y)
        for (i in 1 until points.size) target.lineTo(points[i].x, points[i].y)
        target.close()
    }

    private fun appendPolygonReversed(target: Path, points: List<ParkMapView.ScreenPoint>) {
        if (points.isEmpty()) return
        val last = points.lastIndex
        target.moveTo(points[last].x, points[last].y)
        for (i in last - 1 downTo 0) target.lineTo(points[i].x, points[i].y)
        target.close()
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

    private fun parkInteriorGroundPalette(isDark: Boolean) = parkBasePalette(isDark)

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
        -2, -1 -> mapBackdropPalette(isDark)
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
        sectionIndex: Int,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        mapScale: Float,
        settings: GroundMapSettingsData?,
        viewport: Viewport,
        skipElements: Boolean = false,
    ) {
        if (skipElements) return
        val elements = style.elements.orEmpty().filter { it.density > 0.01 }
        if (elements.isEmpty()) return
        val lodTier = MapLod.effectiveGroundLodTier(mapScale, settings)
        if (lodTier == MapLod.Tier.MINIMAL) return
        val quality = ((settings?.qualityPercent ?: 85.0) / 100.0).coerceIn(0.25, 1.0)
        val scalePct = ((settings?.scalePercent ?: 100.0) / 100.0).coerceIn(0.5, 2.0)
        val unit = resolveTilePx(settings).toFloat() * scalePct.toFloat()
        val region = intersect(left, top, right, bottom, viewport)
        if (region.width() <= 0f || region.height() <= 0f) return
        val cell = max(5f, unit * 1.2f)
        var cy = region.top
        var row = 0
        while (cy <= region.bottom) {
            var cx = region.left + (row % 2) * cell * 0.5f
            while (cx <= region.right) {
                for (el in elements) {
                    if (!MapLod.elementVisibleAtLod(el.type, lodTier)) continue
                    val budget = (el.density * quality * 0.35).toInt().coerceAtLeast(0)
                    if (budget == 0) continue
                    val seed = (cx * 12.9898f + cy * 78.233f + el.type.hashCode() + sectionIndex).toLong()
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
        return when (preset) {
            "performance" -> 8
            "subtle" -> 6
            "rich", "carbot" -> 4
            else -> 5
        }
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
