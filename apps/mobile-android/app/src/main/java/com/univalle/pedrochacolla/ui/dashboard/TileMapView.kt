package com.univalle.pedrochacolla.ui.dashboard

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import com.univalle.pedrochacolla.data.local.entity.MapTileEntity
import com.univalle.pedrochacolla.data.model.Location
import timber.log.Timber
import java.io.File
import kotlin.math.*

/**
 * TileMapView — Pre-rendered tile-based map renderer
 *
 * Replaces computationally heavy per-frame polygon rendering with pre-baked
 * tile images. The admin publishes tiles from the Angular editor; this view
 * loads them from local storage (synced by [MapSyncManager]).
 *
 * Architecture:
 *   Static layer  → Pre-rendered PNG tiles at zoom 0/1/2  (≤21 tiles total)
 *   Dynamic layer → Drawn on top every frame: markers, user location, fog, labels
 *
 * Performance target: ~20-30 draw calls per frame vs ~300 in [ParkMapView].
 */
class TileMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // ── Geodesic constants (same as ParkMapView) ────────────────────
    companion object {
        private const val LAT_CENTER = -16.48933421
        private const val LNG_CENTER = -68.14573989
        private const val METERS_PER_DEG_LAT = 111320.0
        private val LAT_CORRECTION = cos(LAT_CENTER * Math.PI / 180)
    }

    // ── Public data classes ─────────────────────────────────────────
    data class GeoPoint(val lat: Double, val lng: Double)
    data class ScreenPoint(val x: Float, val y: Float)

    data class TileMapMarker(
        val id: String,
        val name: String,
        val geo: GeoPoint,
        val section: String? = null,
        var bitmap: Bitmap? = null,
        var isNearby: Boolean = false,
        var isFound: Boolean = false
    )

    interface OnMarkerClickListener {
        fun onMarkerClick(marker: TileMapMarker)
    }

    // ── Configuration ───────────────────────────────────────────────
    var isDarkTheme: Boolean = false
        set(value) { field = value; invalidate() }

    var markerClickListener: OnMarkerClickListener? = null

    // ── View state ──────────────────────────────────────────────────
    private var scale = 1.5f
    private var offsetX = 0f
    private var offsetY = 0f
    private var rotation = 0f // radians

    // ── Tile data ───────────────────────────────────────────────────
    private var tileSize = 512
    private var tilesDir: File? = null
    private var tileVersion = 0
    private val tileCache = mutableMapOf<String, Bitmap?>() // "z/x_y" → bitmap
    private var maxTileZoom = 2

    // ── Bounds (matching backend PARK_BOUNDS) ───────────────────────
    private val boundsMinLat = -16.4921
    private val boundsMaxLat = -16.4866
    private val boundsMinLng = -68.1469
    private val boundsMaxLng = -68.1446

    // ── Dynamic overlays ────────────────────────────────────────────
    private var markers = listOf<TileMapMarker>()
    private var userLocation: GeoPoint? = null
    private var userHeading = 0f

    // ── Paints ──────────────────────────────────────────────────────
    private val tilePaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 28f; textAlign = Paint.Align.CENTER; isFakeBoldText = true
    }
    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val userDotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val fallbackBgPaint = Paint().apply { color = Color.parseColor("#13132a") }

    // ── Gesture detectors ───────────────────────────────────────────
    private val scaleDetector = ScaleGestureDetector(context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                val oldScale = scale
                scale *= detector.scaleFactor
                scale = scale.coerceIn(0.3f, 8f)
                val f = scale / oldScale
                val cx = width / 2f
                val cy = height / 2f
                offsetX = (1 - f) * (detector.focusX - cx) + f * offsetX
                offsetY = (1 - f) * (detector.focusY - cy) + f * offsetY
                invalidate()
                return true
            }
        })

    private val gestureDetector = GestureDetector(context,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onScroll(
                e1: MotionEvent?, e2: MotionEvent,
                distanceX: Float, distanceY: Float
            ): Boolean {
                offsetX -= distanceX
                offsetY -= distanceY
                invalidate()
                return true
            }

            override fun onSingleTapUp(e: MotionEvent): Boolean {
                handleTap(e.x, e.y)
                return true
            }

            override fun onDoubleTap(e: MotionEvent): Boolean {
                val oldScale = scale
                scale *= 1.5f
                scale = scale.coerceIn(0.3f, 8f)
                val f = scale / oldScale
                val cx = width / 2f
                val cy = height / 2f
                offsetX = (1 - f) * (e.x - cx) + f * offsetX
                offsetY = (1 - f) * (e.y - cy) + f * offsetY
                invalidate()
                return true
            }
        })

    // ── Two-finger rotation ─────────────────────────────────────────
    private var previousAngle = 0f
    private var isRotating = false

    // ══════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════

    /**
     * Point the view at a local tiles directory and version.
     * Call after [MapSyncManager.sync] succeeds.
     */
    fun setTileSource(tilesDirectory: File, version: Int, tileSizePx: Int = 512, maxZoom: Int = 2) {
        tilesDir = tilesDirectory
        tileVersion = version
        tileSize = tileSizePx
        maxTileZoom = maxZoom
        tileCache.clear()
        invalidate()
    }

    fun setMarkers(locations: List<Location>) {
        markers = locations.mapNotNull { loc ->
            if (loc.latitude == 0.0 && loc.longitude == 0.0) return@mapNotNull null
            TileMapMarker(
                id = loc.id ?: "",
                name = loc.name,
                geo = GeoPoint(loc.latitude, loc.longitude),
                section = loc.section
            )
        }
        invalidate()
    }

    fun updateMarkerBitmap(markerId: String, bitmap: Bitmap) {
        markers.find { it.id == markerId }?.bitmap = bitmap
        invalidate()
    }

    fun setUserLocation(lat: Double, lng: Double, heading: Float = 0f) {
        userLocation = GeoPoint(lat, lng)
        userHeading = heading
        invalidate()
    }

    fun clearUserLocation() {
        userLocation = null
        invalidate()
    }

    fun setMarkerFound(markerId: String, found: Boolean) {
        markers.find { it.id == markerId }?.isFound = found
        invalidate()
    }

    fun setMarkerNearby(markerId: String, nearby: Boolean) {
        markers.find { it.id == markerId }?.isNearby = nearby
        invalidate()
    }

    // ══════════════════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════════════════

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Background
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), fallbackBgPaint)

        canvas.save()
        canvas.translate(width / 2f + offsetX, height / 2f + offsetY)
        canvas.rotate(rotation * 180f / Math.PI.toFloat())
        canvas.scale(scale, scale)
        canvas.translate(-width / 2f, -height / 2f)

        // 1) Static tile layer — the big win: one drawBitmap per visible tile
        drawTiles(canvas)

        // 2) Dynamic marker layer
        drawMarkers(canvas)

        canvas.restore()

        // 3) Labels drawn without rotation (screen-space)
        drawLabels(canvas)

        // 4) User location (always on top, screen-space)
        drawUserLocation(canvas)
    }

    /**
     * Choose the best zoom level based on current scale, then draw only
     * the tiles that intersect the visible viewport.
     */
    private fun drawTiles(canvas: Canvas) {
        val dir = tilesDir ?: return
        if (tileVersion == 0) return

        // Pick zoom: higher scale → higher zoom for crisp detail
        val bestZoom = when {
            scale >= 2.5f -> min(2, maxTileZoom)
            scale >= 1.2f -> min(1, maxTileZoom)
            else -> 0
        }

        val gridSize = 1 shl bestZoom // 1, 2, or 4
        val geoWidth = boundsMaxLng - boundsMinLng
        val geoHeight = boundsMaxLat - boundsMinLat

        for (tx in 0 until gridSize) {
            for (ty in 0 until gridSize) {
                // Tile geo bounds
                val tileMinLng = boundsMinLng + geoWidth * tx / gridSize
                val tileMaxLng = boundsMinLng + geoWidth * (tx + 1) / gridSize
                val tileMaxLat = boundsMaxLat - geoHeight * ty / gridSize
                val tileMinLat = boundsMaxLat - geoHeight * (ty + 1) / gridSize

                // Convert to canvas coordinates
                val topLeft = geoToCanvas(GeoPoint(tileMaxLat, tileMinLng))
                val bottomRight = geoToCanvas(GeoPoint(tileMinLat, tileMaxLng))

                val dst = RectF(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y)

                val bitmap = loadTile(bestZoom, tx, ty)
                if (bitmap != null) {
                    canvas.drawBitmap(bitmap, null, dst, tilePaint)
                } else {
                    // Fallback: draw a colored placeholder
                    markerPaint.color = Color.parseColor("#1a1a2e")
                    markerPaint.style = Paint.Style.FILL
                    canvas.drawRect(dst, markerPaint)
                }
            }
        }
    }

    private fun loadTile(z: Int, x: Int, y: Int): Bitmap? {
        val key = "$z/${x}_$y"
        if (tileCache.containsKey(key)) return tileCache[key]

        val dir = tilesDir ?: return null
        val file = File(dir, "v$tileVersion/z$z/${x}_$y.png")
        if (!file.exists()) {
            tileCache[key] = null
            return null
        }

        return try {
            val opts = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 }
            val bmp = BitmapFactory.decodeFile(file.absolutePath, opts)
            tileCache[key] = bmp
            bmp
        } catch (e: Exception) {
            Timber.w(e, "TileMapView: failed to load tile $key")
            tileCache[key] = null
            null
        }
    }

    private fun drawMarkers(canvas: Canvas) {
        val iconRadius = 22f / scale

        for (marker in markers) {
            val p = geoToCanvas(marker.geo)

            if (marker.bitmap != null) {
                // Ring color
                val ringColor = when {
                    marker.isFound -> Color.parseColor("#00C853")
                    marker.isNearby -> Color.parseColor("#FF6D00")
                    else -> Color.parseColor("#78909C")
                }

                // Outer ring
                markerPaint.style = Paint.Style.FILL
                markerPaint.color = ringColor
                canvas.drawCircle(p.x, p.y, iconRadius * 1.15f, markerPaint)

                // Icon clipped to circle
                val clipPath = Path()
                clipPath.addCircle(p.x, p.y, iconRadius, Path.Direction.CW)
                canvas.save()
                canvas.clipPath(clipPath)
                val src = Rect(0, 0, marker.bitmap!!.width, marker.bitmap!!.height)
                val dst = RectF(
                    p.x - iconRadius, p.y - iconRadius,
                    p.x + iconRadius, p.y + iconRadius
                )
                canvas.drawBitmap(marker.bitmap!!, src, dst, tilePaint)
                canvas.restore()
            } else {
                // Fallback dot
                val color = when {
                    marker.isFound -> Color.parseColor("#00C853")
                    marker.isNearby -> Color.parseColor("#FF6D00")
                    else -> Color.parseColor("#78909C")
                }
                markerPaint.style = Paint.Style.FILL
                markerPaint.color = color
                canvas.drawCircle(p.x, p.y, iconRadius * 0.8f, markerPaint)
                markerPaint.color = Color.WHITE
                canvas.drawCircle(p.x, p.y, iconRadius * 0.35f, markerPaint)
            }
        }
    }

    private fun drawLabels(canvas: Canvas) {
        for (marker in markers) {
            val sp = geoToScreen(marker.geo)
            labelPaint.color = if (isDarkTheme) Color.WHITE else Color.DKGRAY

            val text = marker.name
            val tw = labelPaint.measureText(text)
            val pad = 10f

            labelBgPaint.color = if (isDarkTheme)
                Color.argb(190, 0, 0, 0) else Color.argb(220, 255, 255, 255)

            canvas.drawRoundRect(
                sp.x - tw / 2 - pad, sp.y - 68f,
                sp.x + tw / 2 + pad, sp.y - 32f,
                8f, 8f, labelBgPaint
            )
            canvas.drawText(text, sp.x, sp.y - 42f, labelPaint)
        }
    }

    private fun drawUserLocation(canvas: Canvas) {
        val loc = userLocation ?: return
        val sp = geoToScreen(loc)

        // Accuracy halo
        userDotPaint.color = Color.argb(40, 66, 133, 244)
        userDotPaint.style = Paint.Style.FILL
        canvas.drawCircle(sp.x, sp.y, 48f, userDotPaint)

        // Outer ring
        userDotPaint.color = Color.WHITE
        canvas.drawCircle(sp.x, sp.y, 16f, userDotPaint)

        // Inner dot
        userDotPaint.color = Color.parseColor("#4285F4")
        canvas.drawCircle(sp.x, sp.y, 12f, userDotPaint)
    }

    // ══════════════════════════════════════════════════════════════════
    // GEO ↔ SCREEN CONVERSIONS
    // ══════════════════════════════════════════════════════════════════

    private fun geoToCanvas(geo: GeoPoint): ScreenPoint {
        val w = width.toFloat()
        val h = height.toFloat()

        val geoW = boundsMaxLng - boundsMinLng
        val geoH = boundsMaxLat - boundsMinLat
        val latCorr = LAT_CORRECTION.toFloat()
        val corrW = geoW * latCorr

        val scaleX = w / corrW.toFloat()
        val scaleY = h / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f

        val cx = w / 2
        val cy = h / 2
        val midLat = (boundsMinLat + boundsMaxLat) / 2
        val midLng = (boundsMinLng + boundsMaxLng) / 2

        val relX = ((geo.lng - midLng) * latCorr * s).toFloat()
        val relY = ((midLat - geo.lat) * s).toFloat()

        return ScreenPoint(cx + relX, cy + relY)
    }

    private fun geoToScreen(geo: GeoPoint): ScreenPoint {
        val cx = width / 2f
        val cy = height / 2f
        val base = geoToCanvas(geo)
        var x = base.x - cx
        var y = base.y - cy
        x *= scale; y *= scale
        val cos = cos(rotation.toDouble()).toFloat()
        val sin = sin(rotation.toDouble()).toFloat()
        return ScreenPoint(cos * x - sin * y + cx + offsetX, sin * x + cos * y + cy + offsetY)
    }

    private fun screenToGeo(screen: ScreenPoint): GeoPoint {
        val cx = width / 2f
        val cy = height / 2f
        val x = screen.x - cx - offsetX
        val y = screen.y - cy - offsetY
        val cos = cos(-rotation.toDouble()).toFloat()
        val sin = sin(-rotation.toDouble()).toFloat()
        val rx = (cos * x - sin * y) / scale
        val ry = (sin * x + cos * y) / scale

        val geoW = boundsMaxLng - boundsMinLng
        val geoH = boundsMaxLat - boundsMinLat
        val latCorr = LAT_CORRECTION.toFloat()
        val corrW = geoW * latCorr
        val scaleX = width / corrW.toFloat()
        val scaleY = height / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f

        val midLat = (boundsMinLat + boundsMaxLat) / 2
        val midLng = (boundsMinLng + boundsMaxLng) / 2

        return GeoPoint(
            lat = midLat - ry / s,
            lng = midLng + rx / (latCorr * s)
        )
    }

    // ══════════════════════════════════════════════════════════════════
    // TOUCH
    // ══════════════════════════════════════════════════════════════════

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)

        // Two-finger rotation
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (event.pointerCount == 2) {
                    previousAngle = getAngle(event)
                    isRotating = true
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (isRotating && event.pointerCount == 2) {
                    val cur = getAngle(event)
                    var delta = cur - previousAngle
                    if (delta > Math.PI.toFloat()) delta -= (2 * Math.PI).toFloat()
                    if (delta < -Math.PI.toFloat()) delta += (2 * Math.PI).toFloat()
                    rotation += delta
                    previousAngle = cur
                    invalidate()
                }
            }
            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                isRotating = false
            }
        }
        return true
    }

    private fun getAngle(event: MotionEvent): Float {
        val dx = (event.getX(1) - event.getX(0)).toDouble()
        val dy = (event.getY(1) - event.getY(0)).toDouble()
        return atan2(dy, dx).toFloat()
    }

    private fun handleTap(x: Float, y: Float) {
        for (marker in markers) {
            val sp = geoToScreen(marker.geo)
            val dx = x - sp.x
            val dy = y - sp.y
            if (sqrt((dx * dx + dy * dy).toDouble()) < 40) {
                markerClickListener?.onMarkerClick(marker)
                return
            }
        }
    }
}
