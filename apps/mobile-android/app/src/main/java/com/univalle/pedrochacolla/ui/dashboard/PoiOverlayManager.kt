package com.univalle.pedrochacolla.ui.dashboard

import android.content.Context
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import com.univalle.pedrochacolla.R

/**
 * Capa de referencias espaciales en el mapa del parque (ingreso, servicios, cultura, paisaje).
 * El overlay puede activarse/desactivarse desde el panel de escena.
 */
class PoiOverlayManager(private val context: Context) {

    /** POI ids destacados (Ingreso, Boleterías). */
    var highlightedPoiIds: Set<Int> = setOf(1, 2)

    /** Whether the POI overlay is currently visible */
    var isOverlayVisible = false
        private set

    /** Dynamic position overrides (poi.id → lat/lng). Used when admin drags a POI. */
    private val dynamicPositions = mutableMapOf<Int, Pair<Double, Double>>()

    /** Get effective position of a POI (dynamic override or default) */
    fun getPoiPosition(id: Int): Pair<Double, Double> {
        dynamicPositions[id]?.let { return it }
        return poiItems.find { it.id == id }?.let { Pair(it.lat, it.lng) }
            ?: Pair(0.0, 0.0)
    }

    fun setPoiPosition(id: Int, lat: Double, lng: Double) {
        dynamicPositions[id] = Pair(lat, lng)
    }

    fun getDynamicPositions(): Map<Int, Pair<Double, Double>> = dynamicPositions.toMap()

    fun loadDynamicPositions(positions: Map<Int, Pair<Double, Double>>) {
        dynamicPositions.clear()
        dynamicPositions.putAll(positions)
    }

    fun resetPositions() {
        dynamicPositions.clear()
    }

    /** POI items — assigned from the fragment after building with [createDefaultItems]. Empty until populated. */
    var poiItems: List<PoiItem> = emptyList()

    private val assetBitmapCache = mutableMapOf<String, Bitmap>()
    private val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val srcRect = Rect()
    private val dstRect = RectF()

    // Paint objects for drawing
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF333333.toInt()
        textSize = 28f
        typeface = Typeface.DEFAULT_BOLD
        textAlign = Paint.Align.CENTER
    }

    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xDDFFFFFF.toInt()
        style = Paint.Style.FILL
    }

    private val labelBgStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x33000000.toInt()
        style = Paint.Style.STROKE
        strokeWidth = 1f
    }

    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x44000000.toInt()
        style = Paint.Style.FILL
    }

    private val highlightRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF2E7D32.toInt()
        style = Paint.Style.STROKE
        strokeWidth = 4f
    }

    private val categoryFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val badgeStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }

    private val ripplePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
    }

    private val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        textSize = 28f
        typeface = Typeface.DEFAULT_BOLD
        textAlign = Paint.Align.CENTER
    }

    fun toggleOverlay(): Boolean {
        isOverlayVisible = !isOverlayVisible
        return isOverlayVisible
    }

    fun setOverlayVisible(visible: Boolean) {
        isOverlayVisible = visible
    }

    /**
     * Draw all POI markers on the canvas at their geo positions.
     * @param canvas The canvas to draw on
     * @param geoToScreen Function to convert (lat, lng) to screen (x, y)
     * @param scale Current map zoom scale (for size adjustment)
     */
    fun drawOverlay(
        canvas: Canvas,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        scale: Float,
        animPhase: Float = 0f,
    ) {
        if (!isOverlayVisible) return

        for ((index, poi) in poiItems.withIndex()) {
            if (!poi.visible) continue
            val (lat, lng) = getPoiPosition(poi.id)
            val (sx, sy) = geoToScreen(lat, lng)
            val anim = spatialAnimOffset(poi.animation, animPhase, index)
            val isHighlight = poi.id in highlightedPoiIds

            val drawY = sy + anim.dy
            val displaySize = (poi.displaySize * anim.scale * scale.coerceIn(0.8f, 3f)).toInt().coerceAtLeast(24)

            val bitmap = resolveFrameBitmap(poi, animPhase)
            if (bitmap != null) {
                drawImageMarker(canvas, bitmap.bitmap, sx, drawY, displaySize, poi, isHighlight, bitmap.srcRect)
            } else {
                drawBadgeMarker(canvas, poi, sx, drawY, displaySize, anim, isHighlight)
            }

            val labelY = drawY + displaySize / 2f + 24f
            val textWidth = labelPaint.measureText(poi.name)
            val labelRect = RectF(
                sx - textWidth / 2f - 8f,
                labelY - 22f,
                sx + textWidth / 2f + 8f,
                labelY + 8f
            )
            canvas.drawRoundRect(labelRect, 8f, 8f, labelBgPaint)
            canvas.drawRoundRect(labelRect, 8f, 8f, labelBgStrokePaint)
            canvas.drawText(poi.name, sx, labelY, labelPaint)
        }
    }

    private data class FrameSlice(val bitmap: Bitmap, val srcRect: Rect?)

    private fun resolveFrameBitmap(poi: PoiItem, animPhase: Float): FrameSlice? {
        val sheet = poi.spriteSheet
        val assetPath = poi.imageAsset ?: sheet?.assetPath ?: return null
        val full = loadAssetBitmap(assetPath) ?: return null
        if (sheet == null || sheet.frameCount <= 1) return FrameSlice(full, null)

        val cols = sheet.columns ?: sheet.frameCount
        val frame = (animPhase * sheet.fps).toInt() % sheet.frameCount
        val col = frame % cols
        val row = frame / cols
        srcRect.set(
            col * sheet.frameWidth,
            row * sheet.frameHeight,
            col * sheet.frameWidth + sheet.frameWidth,
            row * sheet.frameHeight + sheet.frameHeight,
        )
        return FrameSlice(full, Rect(srcRect))
    }

    private fun loadAssetBitmap(path: String): Bitmap? {
        assetBitmapCache[path]?.let { return it }
        return runCatching {
            context.assets.open(path).use { BitmapFactory.decodeStream(it) }
        }.getOrNull()?.also { assetBitmapCache[path] = it }
    }

    private fun drawImageMarker(
        canvas: Canvas,
        bitmap: Bitmap,
        sx: Float,
        sy: Float,
        size: Int,
        poi: PoiItem,
        isHighlight: Boolean,
        src: Rect? = null,
    ) {
        val aspect = bitmap.width.toFloat() / bitmap.height
        val drawW = if (aspect >= 1f) size.toFloat() else size * aspect
        val drawH = if (aspect >= 1f) size / aspect else size.toFloat()

        canvas.drawOval(
            sx + 2f - drawW * 0.2f,
            sy + drawH * 0.38f,
            sx + 2f + drawW * 0.2f,
            sy + drawH * 0.38f + drawH * 0.12f,
            shadowPaint,
        )

        if (isHighlight) {
            highlightRingPaint.strokeWidth = 4f
            canvas.drawCircle(sx, sy, drawW / 2f + 6f, highlightRingPaint)
        }

        dstRect.set(sx - drawW / 2f, sy - drawH / 2f, sx + drawW / 2f, sy + drawH / 2f)
        if (src != null) {
            canvas.drawBitmap(bitmap, src, dstRect, imagePaint)
        } else {
            canvas.drawBitmap(bitmap, null, dstRect, imagePaint)
        }
    }

    private fun drawBadgeMarker(
        canvas: Canvas,
        poi: PoiItem,
        sx: Float,
        drawY: Float,
        iconSize: Int,
        anim: AnimOffset,
        isHighlight: Boolean,
    ) {
        if (anim.ripple > 0f) {
            ripplePaint.color = (0x40 shl 24) or 0x64B4FF
            ripplePaint.alpha = (64 + anim.ripple * 120).toInt().coerceIn(0, 255)
            canvas.drawCircle(sx, drawY + iconSize * 0.35f, iconSize / 2f + anim.ripple * 14f, ripplePaint)
        }

        if (isHighlight) {
            highlightRingPaint.strokeWidth = 4f
            canvas.drawCircle(sx, drawY, iconSize / 2f + 6f, highlightRingPaint)
        }

        canvas.drawCircle(sx + 2f, drawY + iconSize * 0.42f, iconSize * 0.22f, shadowPaint)

        categoryFillPaint.color = categoryColor(poi.category)
        canvas.drawCircle(sx, drawY, iconSize / 2f, categoryFillPaint)
        badgeStrokePaint.strokeWidth = 2.5f
        canvas.drawCircle(sx, drawY, iconSize / 2f, badgeStrokePaint)

        val glyph = poi.name.firstOrNull()?.uppercaseChar()?.toString() ?: "•"
        canvas.drawText(glyph, sx, drawY + iconSize * 0.1f, glyphPaint)
    }

    /**
     * Check if a screen tap hits any POI marker.
     * @return The tapped POI, or null if no hit
     */
    fun hitTest(
        screenX: Float,
        screenY: Float,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        scale: Float
    ): PoiItem? {
        if (!isOverlayVisible) return null
        val hitRadius = 30f * scale.coerceIn(0.8f, 3f)
        for (poi in poiItems) {
            val (lat, lng) = getPoiPosition(poi.id)
            val (sx, sy) = geoToScreen(lat, lng)
            val dx = screenX - sx
            val dy = screenY - sy
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return poi
            }
        }
        return null
    }

    /**
     * Hit-test for edit mode: works even when overlay is visible (no visibility check).
     */
    fun hitTestForEdit(
        screenX: Float,
        screenY: Float,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        scale: Float
    ): PoiItem? {
        val hitRadius = 36f * scale.coerceIn(0.8f, 3f)
        for (poi in poiItems) {
            val (lat, lng) = getPoiPosition(poi.id)
            val (sx, sy) = geoToScreen(lat, lng)
            val dx = screenX - sx
            val dy = screenY - sy
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return poi
            }
        }
        return null
    }

    /** Clear cached state (call on configuration changes) */
    fun clearCache() {
        // ponytail: badges are drawn procedurally; nothing to recycle
    }

    companion object {
        private fun categoryColor(category: String): Int = when (category) {
            "acceso" -> 0xFF2E7D32.toInt()
            "servicio" -> 0xFFFF9E67.toInt()
            "cultura" -> 0xFF7E57C2.toInt()
            else -> 0xFF43A047.toInt()
        }

        private data class AnimOffset(val dy: Float, val scale: Float, val ripple: Float)

        private fun spatialAnimOffset(animation: String, phase: Float, index: Int): AnimOffset {
            val t = phase + index * 0.7f
            return when (animation) {
                "bob" -> AnimOffset(kotlin.math.sin(t * 2.2f) * 5f, 1f, 0f)
                "pulse" -> AnimOffset(0f, 1f + kotlin.math.sin(t * 3f) * 0.06f, 0f)
                "ripple" -> AnimOffset(0f, 1f, (kotlin.math.sin(t * 2.5f) + 1f) * 0.5f)
                else -> AnimOffset(0f, 1f, 0f)
            }
        }

        /**
         * Build the default list of POI metadata using local drawable resources.
         * Positions default to (0, 0) and may be overridden at runtime via
         * [loadDynamicPositions] once the global map config is fetched.
         */
        fun createDefaultItems(resources: Resources, packageName: String): List<PoiItem> {
            val entries = listOf(
                Triple(1,  "Ingreso",           "ic_poi_ingreso"),
                Triple(2,  "Boleterías",        "ic_poi_boleterias"),
                Triple(3,  "Chiwiña",           "ic_poi_chiwina"),
                Triple(4,  "Cafetería",         "ic_poi_cafeteria"),
                Triple(5,  "Teatro Galpón",     "ic_poi_teatro"),
                Triple(6,  "Aguas Danzantes",   "ic_poi_aguas"),
                Triple(7,  "Mirador",           "ic_poi_mirador"),
                Triple(8,  "Escenario Principal","ic_poi_escenario"),
                Triple(9,  "Anfiteatro",        "ic_poi_anfiteatro"),
                Triple(10, "Parrillero",        "ic_poi_parrillero"),
                Triple(11, "Área de Picnik",    "ic_poi_picnik")
            )
            return entries.map { (id, name, resName) ->
                val resId = resources.getIdentifier(resName, "drawable", packageName)
                    .takeIf { it != 0 } ?: R.drawable.ic_launcher_foreground
                PoiItem(
                    id = id,
                    refId = resName.removePrefix("ic_poi_"),
                    name = name,
                    lat = 0.0,
                    lng = 0.0,
                    drawableRes = resId,
                    color = "#CCCCCC",
                )
            }
        }
    }
}

data class PoiSpriteSheet(
    val assetPath: String,
    val frameWidth: Int,
    val frameHeight: Int,
    val frameCount: Int,
    val fps: Int = 8,
    val columns: Int? = null,
)

/**
 * Referencia espacial georreferenciada en el mapa del parque.
 */
data class PoiItem(
    val id: Int,
    val refId: String = "",
    val name: String,
    val lat: Double,
    val lng: Double,
    val drawableRes: Int,
    val color: String,
    val category: String = "paisaje",
    val animation: String = "none",
    val summary: String = "",
    val visible: Boolean = true,
    /** PNG en assets (p. ej. spatial-refs/ingress.png). */
    val imageAsset: String? = null,
    val spriteSheet: PoiSpriteSheet? = null,
    val displaySize: Float = 48f,
)
