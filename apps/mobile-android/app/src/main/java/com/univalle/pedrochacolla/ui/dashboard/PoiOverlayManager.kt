package com.univalle.pedrochacolla.ui.dashboard

import android.content.Context
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import androidx.core.content.ContextCompat
import com.univalle.pedrochacolla.R

/**
 * Manages the Point of Interest (POI) overlay layer on the park map.
 * POIs represent fixed landmarks in the park (Ingreso, Boleterías, Chiwiña, etc.)
 * The overlay can be toggled on/off by the user.
 */
class PoiOverlayManager(private val context: Context) {

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



    /** Cached bitmaps for POI icons (64x64 dp equivalent) */
    private val iconBitmaps = mutableMapOf<Int, Bitmap>()

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
        scale: Float
    ) {
        if (!isOverlayVisible) return

        // Clamp icon size for readability
        val iconSize = (48f * scale.coerceIn(0.8f, 3f)).toInt()

        for (poi in poiItems) {
            val (lat, lng) = getPoiPosition(poi.id)
            val (sx, sy) = geoToScreen(lat, lng)

            // Get or create cached bitmap
            val bitmap = getIconBitmap(poi.drawableRes, iconSize)

            // Draw shadow
            canvas.drawCircle(sx + 2f, sy + 2f, iconSize / 2f, shadowPaint)

            // Draw icon
            canvas.drawBitmap(
                bitmap,
                sx - iconSize / 2f,
                sy - iconSize / 2f,
                null
            )

            // Draw label below the icon
            val labelY = sy + iconSize / 2f + 24f
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

    private fun getIconBitmap(drawableRes: Int, size: Int): Bitmap {
        val key = drawableRes * 10000 + size
        iconBitmaps[key]?.let { return it }

        val drawable = ContextCompat.getDrawable(context, drawableRes)
            ?: return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        iconBitmaps[key] = bitmap
        return bitmap
    }

    /** Clear cached bitmaps (call on configuration changes) */
    fun clearCache() {
        iconBitmaps.values.forEach { it.recycle() }
        iconBitmaps.clear()
    }

    companion object {
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
                PoiItem(id = id, name = name, lat = 0.0, lng = 0.0, drawableRes = resId, color = "#CCCCCC")
            }
        }
    }
}

/**
 * Data class representing a Point of Interest in the park
 */
data class PoiItem(
    val id: Int,
    val name: String,
    val lat: Double,
    val lng: Double,
    val drawableRes: Int,
    val color: String
)
