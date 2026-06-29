package com.univalle.pedrochacolla.ui.dashboard

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.Choreographer
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import com.univalle.pedrochacolla.utils.map.ParkSectionResolver
import com.univalle.pedrochacolla.utils.map.MapGroundRenderer
import com.univalle.pedrochacolla.utils.map.MapTreesRenderer
import com.univalle.pedrochacolla.utils.map.AmbientScenarioTints
import com.univalle.pedrochacolla.utils.map.AmbientTickOptions
import com.univalle.pedrochacolla.utils.map.AmbientWind
import com.univalle.pedrochacolla.utils.map.MapAmbientZone
import com.univalle.pedrochacolla.utils.map.MapPlaneBounds
import com.univalle.pedrochacolla.utils.map.PublishedParkMapper
import com.univalle.pedrochacolla.data.model.AmbientSceneData
import com.univalle.pedrochacolla.data.model.AmbientTreeSlotData
import com.univalle.pedrochacolla.data.model.LayerOffsetsData
import com.univalle.pedrochacolla.data.model.ParkSectionRecordData
import com.univalle.pedrochacolla.data.model.GroundMapSettingsData
import com.univalle.pedrochacolla.data.model.ZoneGroundStyleData
import com.univalle.pedrochacolla.data.local.ParkDataLoader
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.R
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * MAPA PERSONALIZADO v1.0 - Parque de las Culturas y de la Madre Tierra
 *
 * Vista de Canvas personalizada que renderiza el mapa del parque con:
 * - Polígono de límites del parque (100+ puntos)
 * - Secciones del parque con colores
 * - Marcadores de ubicación
 * - Zoom con gestos de pellizco
 * - Pan/arrastre para mover el mapa
 * - Rotación bidireccional
 * - Soporte de tema oscuro/claro
 * - Escala dinámica
 */
class ParkMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    init {
        // Use software layer so PorterDuff.Mode.CLEAR works correctly with transparent canvas
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }

    private val parkData by lazy { ParkDataLoader.load(context) }
    private val parkBoundary: List<GeoPoint> get() = parkData.boundary
    private var publishedSectionsOverride: List<ParkSection>? = null
    private val parkSections: List<ParkSection>
        get() = publishedSectionsOverride ?: parkData.sections
    private val bounds by lazy { calculateBounds(parkBoundary, 0.00035) }

    private fun latCorrectionFactor(): Double {
        val midLat = (bounds.minLat + bounds.maxLat) / 2.0
        return cos(midLat * Math.PI / 180.0)
    }

    // Punto geográfico
    data class GeoPoint(val lat: Double, val lng: Double)

    // Punto de pantalla
    data class ScreenPoint(val x: Float, val y: Float)

    // Marcador en el mapa
    data class MapMarker(
        val id: String,
        val name: String,
        val geo: GeoPoint,
        val section: String? = null,
        var isInside: Boolean = true,
        /** Icono del animal cargado desde la API (sustituye el punto rojo). */
        var bitmap: Bitmap? = null,
        /** true cuando el animal está dentro del radio de encuentro (pulso animado). */
        var isNearby: Boolean = false,
        /** true cuando el usuario ya guardó este animal. */
        var isFound: Boolean = false
    )

    // Sección del parque
    data class ParkSection(
        val name: String,
        val color: Int,
        val colorLight: Int,
        val chartColor: Int,
        val fillOpacity: Float,
        val fillOpacityLight: Float,
        val educationSummary: String,
        val referenceImageUrl: String?,
        val polygon: List<GeoPoint>
    )

    fun interface OnSectionClickListener {
        fun onSectionClick(section: ParkSection, index: Int)
    }

    // Listener para clicks en marcadores
    interface OnMarkerClickListener {
        fun onMarkerClick(marker: MapMarker)
    }

    // Listener para clicks en POI del overlay
    interface OnPoiClickListener {
        fun onPoiClick(poi: PoiItem)
    }

    // Constantes geodésicas — centroide derivado del polígono OSM en shared/data
    companion object {
        private const val METERS_PER_DEG_LAT = 111320.0

        private fun metersPerDegLng(midLat: Double): Double =
            METERS_PER_DEG_LAT * cos(midLat * Math.PI / 180.0)

        const val MARKER_RADIUS = 34f
        const val MARKER_INNER_RADIUS = 11f
        const val MARKER_WARNING_RADIUS = 56f
        /** Radius for animal icon bitmap on map markers (px at scale=1). */
        const val MARKER_ICON_RADIUS = 52f

    private object ThemeColors {
        val darkBackground = Color.parseColor("#1a1a2e")
        val darkGrid = Color.argb(128, 50, 50, 80)
        val darkBoundary = Color.parseColor("#4caf50")
        val darkBoundaryFill = Color.argb(51, 76, 175, 80)
        val darkText = Color.WHITE
        val darkMarkerInside = Color.parseColor("#4caf50")
        val darkMarkerOutside = Color.parseColor("#f44336")
        val lightBackground = Color.parseColor("#f5f5f5")
        val lightGrid = Color.argb(77, 100, 100, 120)
        val lightBoundary = Color.parseColor("#2e7d32")
        val lightBoundaryFill = Color.argb(38, 76, 175, 80)
        val lightText = Color.parseColor("#212121")
        val lightMarkerInside = Color.parseColor("#2e7d32")
        val lightMarkerOutside = Color.parseColor("#c62828")

        // Fondo fuera de los limites del parque (tono beige del mapa ilustrado)
        val mapOutside = Color.parseColor("#E8DFC9")
    }
    }

    // ── Background illustration ───────────────────────────────────────────────
    /** Bitmap loaded from res/drawable-nodpi/map_background_illustrated.jpg */
    private var backgroundBitmap: Bitmap? = null
    /** When true, draws the illustrated background image instead of transparent clear. */
    var showBackgroundImage: Boolean = false
    /** Paint for background image rendering. */
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    // ── Explorer icon markers ─────────────────────────────────────────────────
    /** Reusable clip path for circular icon rendering (avoids allocation in onDraw). */
    private val iconClipPath = Path()
    /** Paint used to draw Bitmap icons on markers. */
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    /** ValueAnimator driving the pulsing ring alpha around "nearby" markers. */
    private var pulseAnimator: ValueAnimator? = null
    /** Current alpha value for the pulsing ring (0-255). Updated by pulseAnimator. */
    private var pulseAlpha: Int = 100


    // Estado del mapa
    private var scale = 1.2f
    private var rotation = 0f
    private var offsetX = 0f
    private var offsetY = 0f
    private var isDarkTheme = true
    private var initialScaleSet = false

    /** When false, two-finger rotation is disabled (used in 3D mode). */
    var rotationEnabled = true

    // Target scale bar distance in meters
    private val targetScaleBarMeters = 75.0

    // Opciones de visualización
    var showGrid = true
    var showSections = true
    var showSectionLabels = true
    var showMapLegend = true
    var showLabels = true
    var showBoundary = true

    /** Suelo procedural publicado desde web-admin (fase 1 sync). */
    var showGroundTextures = false
        set(value) {
            field = value
            invalidate()
        }

    private var showPublishedTrees = false
    private var publishedTrees: List<AmbientTreeSlotData> = emptyList()
    private var publishedGroundStyle: Map<Int, ZoneGroundStyleData> = emptyMap()
    private var publishedGroundSettings: GroundMapSettingsData? = null
    private var publishedTreesSizeMul = 1f

    private data class LayerOffset(val x: Float = 0f, val y: Float = 0f)
    private var layerOffsetBoundary = LayerOffset()
    private var layerOffsetSections = LayerOffset()
    private var layerOffsetMarkers = LayerOffset()

    /** When false, the scale bar at the bottom-right is hidden */
    var showScaleBar = true

    /** When false, ALL 2D drawing is skipped — only the transparent punch-through remains */
    var show2DOverlay = true

    /** Lluvia — capa ambiental separada de referencias espaciales. */
    var showRainEffect = false
    var rainIntensity = 0.45f
        set(value) {
            field = value.coerceIn(0f, 1f)
            mapRainEffect.intensity = field
            invalidate()
        }
    var rainSize = 1f
        set(value) {
            field = value.coerceIn(0.08f, 2.5f)
            mapRainEffect.sizeMul = field
            invalidate()
        }
    /** -1 = todo el parque; 0..n = índice de sección. */
    var rainSectionIndex = -1
        set(value) {
            if (field == value) return
            field = value
            clearAmbientEffectParticles()
            invalidate()
        }
    var spatialAnimSpeed = 1f
        set(value) { field = value.coerceIn(0.2f, 2f) }

    private var spatialRefsPhase = 0f
    private val mapRainEffect = MapRainEffect()
    private val mapFogEffect = MapFogEffect()
    private val mapMotesEffect = MapMotesEffect()
    private val mapCloudShadowEffect = MapCloudShadowEffect()
    private val mapLeavesEffect = MapLeavesEffect().also { effect ->
        effect.setSectionAt { bx, by ->
            val geo = canvasToGeo(bx, by)
            parkSections.indexOfFirst { section -> isPointInPolygon(geo, section.polygon) }
        }
    }
    private val mapLightningEffect = MapLightningEffect()
    private val mapNightMistEffect = MapNightMistEffect()
    private var scenarioTint: com.univalle.pedrochacolla.utils.map.AmbientScenarioTint? = null
    private val scenarioTintPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var ambientWindDeg = 245f
    private var ambientWindStrength = 0.45f
    var showFogEffect = false
    var showMotesEffect = false
    var showCloudShadows = false
    var showLeavesEffect = false
    var showLightningEffect = false
    var showNightMistEffect = false
    var fogIntensity = 0.35f
    var fogSize = 1f
    var motesIntensity = 0.4f
    var motesSize = 1f
    var cloudShadowIntensity = 0.4f
    var cloudShadowSize = 1f
    var leavesIntensity = 0.45f
    var leavesSize = 1f
    var nightMistIntensity = 0.35f
    private var sceneFrameCallback: Choreographer.FrameCallback? = null
    private val parkClipPath = Path()

    /** When true (admin), pan is not clamped to the park polygon — allows free map navigation. */
    var isAdminMode = false

    /** Coordinate inspector mode — when true, taps show GPS coords instead of panning */
    var coordinateInspectorEnabled = false

    /** Callback when user taps in coordinate inspector mode. (lat, lng) */
    var onCoordinateTapped: ((lat: Double, lng: Double) -> Unit)? = null

    // Datos
    private val markers = mutableListOf<MapMarker>()
    private var markerClickListener: OnMarkerClickListener? = null

    // User location
    /** Last accepted (Kalman-filtered) GPS position. */
    private var userLocation: GeoPoint? = null
    /** Smoothly-animated position used for rendering — interpolates to userLocation. */
    private var displayedUserLocation: GeoPoint? = null
    private var locationAnimator: ValueAnimator? = null
    private var viewFocusAnimator: ValueAnimator? = null

    private var userHeading: Float = 0f // compass heading in degrees
    /** Smoothly-animated heading used for rendering. */
    private var displayedHeading: Float = 0f
    private var headingAnimator: ValueAnimator? = null

    private var isNavigating = false
    private var navigationTarget: GeoPoint? = null

    // Paint for user location
    private val userLocationPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
        color = Color.parseColor("#4285F4") // Google blue
    }
    private val userLocationStrokePaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
        color = Color.WHITE
        strokeWidth = 3f
    }
    private val userLocationRadiusPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
        color = Color.argb(40, 66, 133, 244)
    }
    private val navigationPathPaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
        color = Color.parseColor("#4285F4")
        strokeWidth = 6f
        pathEffect = DashPathEffect(floatArrayOf(20f, 12f), 0f)
        strokeCap = Paint.Cap.ROUND
    }
    private val headingPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
        color = Color.argb(100, 66, 133, 244)
    }

    // Pre-allocated paints for drawUserLocation — avoids GC pressure at 60 fps
    private val pointerShadowPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
        color = Color.argb(45, 0, 0, 0)
        maskFilter = BlurMaskFilter(6f, BlurMaskFilter.Blur.NORMAL)
    }
    private val pointerBorderPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
        color = Color.WHITE
    }
    private val pointerFillPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
    }
    private val pointerInnerDotPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
        color = Color.WHITE
    }
    private val pointerSpecPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
        color = Color.argb(100, 255, 255, 255)
    }
    // RadialGradient is re-created once (it's immutable); pointer Paths are reused between frames
    private val pointerGradient = RadialGradient(
        0f, -3f, 30f,
        Color.parseColor("#5B9EF4"),
        Color.parseColor("#1A73E8"),
        Shader.TileMode.CLAMP
    ).also { pointerFillPaint.shader = it }
    private val shadowPointerPath  = createNavigationPointerPath(0f, 3f, 1.05f)
    private val borderPointerPath  = createNavigationPointerPath(0f, 0f, 1.12f)
    private val fillPointerPath    = createNavigationPointerPath(0f, 0f, 1.0f)

    // User location sonar pulse ring
    private var userSonarFraction: Float = 0f
    private var userSonarAlpha: Int = 0
    private var userSonarAnimator: ValueAnimator? = null
    private val userLocationSonarPaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
        color = Color.parseColor("#4285F4")
        strokeWidth = 3f
    }

    // Badge paint for found-marker checkmark
    private val badgePaint = Paint().apply {
        isAntiAlias = true
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = 22f
        isFakeBoldText = true
    }

    // Bounds del parque
    // Slightly expanded bounds to give more breathing room around the park

    // Paints
    private val gridPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f
        isAntiAlias = true
    }

    private val boundaryPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        isAntiAlias = true
    }

    private val boundaryFillPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val sectionPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val sectionStrokePaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    /** Sección resaltada (tap o botón) — efecto botón en el mapa. */
    var highlightedSectionIndex: Int = -1
        set(value) {
            field = value
            invalidate()
        }

    private var sectionClickListener: OnSectionClickListener? = null

    fun setOnSectionClickListener(listener: OnSectionClickListener?) {
        sectionClickListener = listener
    }

    private val markerPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val labelPaint = Paint().apply {
        textSize = 32f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }

    private val labelBgPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val scalePaint = Paint().apply {
        textSize = 28f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }

    // Paint for rotation degree indicator
    private val rotationDegreePaint = Paint().apply {
        textSize = 30f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
        isFakeBoldText = true
    }
    private val rotationDegreeBgPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (!initialScaleSet && w > 0) {
            // Calculate scale so the 200px scale bar shows ~75m
            val boundsWidth = bounds.maxLng - bounds.minLng
            val scaleBarWidth = 200.0
            // scale = scaleBarWidth * boundsWidth * METERS_PER_DEG_LNG / (w * targetMeters)
            val computedScale = (scaleBarWidth * boundsWidth * metersPerDegLng((bounds.minLat + bounds.maxLat) / 2)) / (w * targetScaleBarMeters)
            scale = computedScale.toFloat().coerceIn(0.3f, 15f)
            initialScaleSet = true
        }
    }

    // Detectores de gestos
    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val oldScale = scale
            scale *= detector.scaleFactor
            scale = scale.coerceIn(0.3f, 15f)
            // Adjust offset so the pinch focus point stays fixed on screen
            val f = scale / oldScale
            val cx = width / 2f
            val cy = height / 2f
            offsetX = (1 - f) * (detector.focusX - cx) + f * offsetX
            offsetY = (1 - f) * (detector.focusY - cy) + f * offsetY
            clampOffsets()
            invalidate()
            return true
        }
    })

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onScroll(
            e1: MotionEvent?,
            e2: MotionEvent,
            distanceX: Float,
            distanceY: Float
        ): Boolean {
            offsetX -= distanceX
            offsetY -= distanceY
            clampOffsets()
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
            scale = scale.coerceIn(0.3f, 15f)
            // Zoom centered on the tap location
            val f = scale / oldScale
            val cx = width / 2f
            val cy = height / 2f
            offsetX = (1 - f) * (e.x - cx) + f * offsetX
            offsetY = (1 - f) * (e.y - cy) + f * offsetY
            clampOffsets()
            invalidate()
            return true
        }
    })

    // Cálculo de bounds del polígono
    private data class Bounds(val minLat: Double, val maxLat: Double, val minLng: Double, val maxLng: Double)

    private fun calculateBounds(polygon: List<GeoPoint>, padding: Double): Bounds {
        // ponytail: fallback = OSM bbox way/641677241
        val defaultLat = -16.489311
        val defaultLng = -68.145316
        if (polygon.isEmpty()) {
            return Bounds(
                minLat = -16.4919539,
                maxLat = -16.4866356,
                minLng = -68.146852,
                maxLng = -68.1446378
            )
        }
        val lats = polygon.map { it.lat }
        val lngs = polygon.map { it.lng }
        return Bounds(
            minLat = (lats.minOrNull() ?: defaultLat) - padding,
            maxLat = (lats.maxOrNull() ?: defaultLat) + padding,
            minLng = (lngs.minOrNull() ?: defaultLng) - padding,
            maxLng = (lngs.maxOrNull() ?: defaultLng) + padding
        )
    }

    /** Clamp pan offsets so the park stays within the visible viewport. */
    private fun clampOffsets() {
        if (isAdminMode) return  // Admin: free pan beyond park limits
        if (width == 0 || height == 0) return
        if (parkBoundary.isEmpty()) return

        val cx = width / 2f
        val cy = height / 2f
        val cosr = cos(rotation.toDouble()).toFloat()
        val sinr = sin(rotation.toDouble()).toFloat()

        var minX = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY

        for (p in parkBoundary) {
            val base = geoToCanvas(p)
            var x = base.x - cx
            var y = base.y - cy
            x *= scale
            y *= scale
            val rx = cosr * x - sinr * y
            val ry = sinr * x + cosr * y
            val sx = rx + cx + offsetX
            val sy = ry + cy + offsetY
            minX = min(minX, sx)
            maxX = max(maxX, sx)
            minY = min(minY, sy)
            maxY = max(maxY, sy)
        }

        val padding = 32f
        val viewW = width.toFloat()
        val viewH = height.toFloat()
        val boxW = maxX - minX
        val boxH = maxY - minY
        val availW = viewW - 2 * padding
        val availH = viewH - 2 * padding

        var dx = 0f
        var dy = 0f

        if (boxW <= availW) {
            val centerX = (minX + maxX) / 2f
            dx = (viewW / 2f) - centerX
        } else {
            if (minX > padding) dx = padding - minX
            if (maxX < viewW - padding) dx = (viewW - padding) - maxX
        }

        if (boxH <= availH) {
            val centerY = (minY + maxY) / 2f
            dy = (viewH / 2f) - centerY
        } else {
            if (minY > padding) dy = padding - minY
            if (maxY < viewH - padding) dy = (viewH - padding) - maxY
        }

        offsetX += dx
        offsetY += dy
    }

    /**
     * Acerca y centra el polígono de una sección para que ocupe la mayor parte de la pantalla.
     */
    fun focusOnSection(sectionIndex: Int, fill: Float = 0.88f) {
        val section = parkSections.getOrNull(sectionIndex) ?: return
        if (section.polygon.size < 3 || width == 0 || height == 0) return

        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f

        val basePoints = section.polygon.map { geoToCanvas(it) }
        val bcx = basePoints.map { it.x }.average().toFloat()
        val bcy = basePoints.map { it.y }.average().toFloat()

        val cosr = cos(rotation.toDouble()).toFloat()
        val sinr = sin(rotation.toDouble()).toFloat()
        val centroidRelX = (bcx - cx) * cosr - (bcy - cy) * sinr
        val centroidRelY = (bcx - cx) * sinr + (bcy - cy) * cosr

        var minDx = Float.POSITIVE_INFINITY
        var maxDx = Float.NEGATIVE_INFINITY
        var minDy = Float.POSITIVE_INFINITY
        var maxDy = Float.NEGATIVE_INFINITY
        for (p in basePoints) {
            val rdx = (p.x - cx) * cosr - (p.y - cy) * sinr - centroidRelX
            val rdy = (p.x - cx) * sinr + (p.y - cy) * cosr - centroidRelY
            minDx = min(minDx, rdx)
            maxDx = max(maxDx, rdx)
            minDy = min(minDy, rdy)
            maxDy = max(maxDy, rdy)
        }

        val baseW = (maxDx - minDx).coerceAtLeast(1f)
        val baseH = (maxDy - minDy).coerceAtLeast(1f)
        val margin = (1f - fill) / 2f
        val availW = w * (1f - 2f * margin)
        val availH = h * (1f - 2f * margin)

        val newScale = min(availW / baseW, availH / baseH).coerceIn(0.3f, 15f)

        val dx0 = (bcx - cx) * newScale
        val dy0 = (bcy - cy) * newScale
        val rx = cosr * dx0 - sinr * dy0
        val ry = sinr * dx0 + cosr * dy0
        val newOffX = w / 2f - cx - rx
        val newOffY = h / 2f - cy - ry

        val startScale = scale
        val startOffX = offsetX
        val startOffY = offsetY

        viewFocusAnimator?.cancel()
        viewFocusAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 450
            interpolator = DecelerateInterpolator()
            addUpdateListener { anim ->
                val t = anim.animatedValue as Float
                scale = startScale + (newScale - startScale) * t
                offsetX = startOffX + (newOffX - startOffX) * t
                offsetY = startOffY + (newOffY - startOffY) * t
                invalidate()
            }
            start()
        }
    }

    private fun isPointInPolygon(point: GeoPoint, polygon: List<GeoPoint>): Boolean =
        ParkSectionResolver.isPointInPolygon(point, polygon)

    // Conversión de coordenadas geo a canvas (sin transformaciones)
    private fun geoToCanvas(geo: GeoPoint): ScreenPoint {
        val w = width.toFloat()
        val h = height.toFloat()

        val geoW = bounds.maxLng - bounds.minLng
        val geoH = bounds.maxLat - bounds.minLat
        val latCorrectionFactor = latCorrectionFactor().toFloat()
        val correctedGeoW = geoW * latCorrectionFactor

        val scaleX = w / correctedGeoW.toFloat()
        val scaleY = h / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f

        val cx = w / 2
        val cy = h / 2
        val geoMidLat = (bounds.minLat + bounds.maxLat) / 2
        val geoMidLng = (bounds.minLng + bounds.maxLng) / 2

        val relX = ((geo.lng - geoMidLng) * latCorrectionFactor * s).toFloat()
        val relY = ((geoMidLat - geo.lat) * s).toFloat()

        return ScreenPoint(cx + relX, cy + relY)
    }

    // Conversión de coordenadas geo a pantalla (con zoom, rotación y offset)
    private fun geoToScreen(geo: GeoPoint): ScreenPoint {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2
        val cy = h / 2

        val basePoint = geoToCanvas(geo)
        var x = basePoint.x - cx
        var y = basePoint.y - cy

        x *= scale
        y *= scale

        val cos = cos(rotation.toDouble()).toFloat()
        val sin = kotlin.math.sin(rotation.toDouble()).toFloat()
        val rx = cos * x - sin * y
        val ry = sin * x + cos * y

        return ScreenPoint(rx + cx + offsetX, ry + cy + offsetY)
    }

    // Conversión de pantalla a geo
    private fun screenToGeo(screen: ScreenPoint): GeoPoint {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2
        val cy = h / 2

        // Correct inverse: subtract offset → un-rotate → un-scale
        val x = screen.x - cx - offsetX
        val y = screen.y - cy - offsetY

        val cos = cos(-rotation.toDouble()).toFloat()
        val sin = kotlin.math.sin(-rotation.toDouble()).toFloat()
        val rx = (cos * x - sin * y) / scale
        val ry = (sin * x + cos * y) / scale

        val geoW = bounds.maxLng - bounds.minLng
        val geoH = bounds.maxLat - bounds.minLat
        val latCorrectionFactor = latCorrectionFactor().toFloat()
        val correctedGeoW = geoW * latCorrectionFactor

        val scaleX = w / correctedGeoW.toFloat()
        val scaleY = h / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f

        val geoMidLat = (bounds.minLat + bounds.maxLat) / 2
        val geoMidLng = (bounds.minLng + bounds.maxLng) / 2

        return GeoPoint(
            lat = geoMidLat - ry / s,
            lng = geoMidLng + rx / (latCorrectionFactor * s)
        )
    }

    // Two-finger rotation tracking
    private var previousAngle = 0f
    private var isRotating = false

    // ── POI drag (edit mode only) ───────────────────────────────────────
    private var isDraggingPoi = false
    private var dragPoiItem: PoiItem? = null
    private var lastTouchX = 0f
    private var lastTouchY = 0f

    private fun getRotationAngle(event: MotionEvent): Float {
        val dx = (event.getX(1) - event.getX(0)).toDouble()
        val dy = (event.getY(1) - event.getY(0)).toDouble()
        return atan2(dy, dx).toFloat()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // ── Coordinate inspector mode — single tap returns geo coordinates ──
        if (coordinateInspectorEnabled) {
            if (event.actionMasked == MotionEvent.ACTION_UP && event.pointerCount == 1) {
                val geo = screenToGeo(ScreenPoint(event.x, event.y))
                onCoordinateTapped?.invoke(geo.lat, geo.lng)
            }
            // Swallow all touch events to prevent pan/zoom/rotate
            return true
        }

        // ── POI drag (admin edit mode) ──
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (poiOverlayManager?.isOverlayVisible == true) {
                    val poiHit = poiOverlayManager?.hitTestForEdit(event.x, event.y, ::geoToScreenPublic, scale)
                    if (poiHit != null) {
                        isDraggingPoi = true
                        dragPoiItem = poiHit
                        lastTouchX = event.x
                        lastTouchY = event.y
                        invalidate()
                        return true
                    }
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (isDraggingPoi && event.pointerCount == 1) {
                    val poi = dragPoiItem ?: return true
                    val (curLat, curLng) = poiOverlayManager?.getPoiPosition(poi.id) ?: Pair(poi.lat, poi.lng)
                    val (sx, sy) = geoToScreenPublic(curLat, curLng)
                    val dx = event.x - lastTouchX
                    val dy = event.y - lastTouchY
                    val newGeo = screenToGeo(ScreenPoint(sx + dx, sy + dy))
                    poiOverlayManager?.setPoiPosition(poi.id, newGeo.lat, newGeo.lng)
                    lastTouchX = event.x
                    lastTouchY = event.y
                    invalidate()
                    return true
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isDraggingPoi) {
                    isDraggingPoi = false
                    dragPoiItem = null
                    return true
                }
            }
        }

        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)

        // Two-finger rotation gesture (disabled when rotationEnabled == false)
        if (rotationEnabled) {
            when (event.actionMasked) {
                MotionEvent.ACTION_POINTER_DOWN -> {
                    if (event.pointerCount == 2) {
                        previousAngle = getRotationAngle(event)
                        isRotating = true
                    }
                }
                MotionEvent.ACTION_MOVE -> {
                    if (isRotating && event.pointerCount == 2) {
                        val currentAngle = getRotationAngle(event)
                        var delta = currentAngle - previousAngle
                        if (delta > Math.PI.toFloat()) delta -= (2 * Math.PI).toFloat()
                        if (delta < -Math.PI.toFloat()) delta += (2 * Math.PI).toFloat()
                        val midX = (event.getX(0) + event.getX(1)) / 2f
                        val midY = (event.getY(0) + event.getY(1)) / 2f
                        val cx = width / 2f
                        val cy = height / 2f
                        val dx = midX - cx - offsetX
                        val dy = midY - cy - offsetY
                        val cosd = cos(delta.toDouble()).toFloat()
                        val sind = kotlin.math.sin(delta.toDouble()).toFloat()
                        offsetX = midX - cx - (cosd * dx - sind * dy)
                        offsetY = midY - cy - (sind * dx + cosd * dy)
                        rotation += delta
                        previousAngle = currentAngle
                        clampOffsets()
                        invalidate()
                    }
                }
                MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    isRotating = false
                }
            }
        } else {
            // Still track pointer up/cancel to reset rotation state
            if (event.actionMasked in listOf(MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL)) {
                isRotating = false
            }
        }

        // (3D camera sync removed)

        return true
    }

    /** POI overlay manager — set from Fragment to enable POI layer */
    var poiOverlayManager: PoiOverlayManager? = null
    /** Sticker overlay — renders stickers from saved config layered over the map */
    var stickerOverlayManager: StickerOverlayManager? = null

    /** Listener for POI overlay taps */
    var poiClickListener: OnPoiClickListener? = null

    /** Expose geoToScreen for the overlay manager */
    fun geoToScreenPublic(lat: Double, lng: Double): Pair<Float, Float> {
        val sp = geoToScreen(GeoPoint(lat, lng))
        return Pair(sp.x, sp.y)
    }

    private fun handleTap(x: Float, y: Float) {
        // Zonas del parque (tap = botón)
        if (showSections) {
            val geo = screenToGeo(ScreenPoint(x, y))
            for (i in parkSections.indices.reversed()) {
                val section = parkSections[i]
                if (isPointInPolygon(geo, section.polygon)) {
                    highlightedSectionIndex = i
                    sectionClickListener?.onSectionClick(section, i)
                    return
                }
            }
        }

        // Check POI overlay hits
        poiOverlayManager?.let { overlay ->
            val poi = overlay.hitTest(x, y, ::geoToScreenPublic, scale)
            if (poi != null) {
                poiClickListener?.onPoiClick(poi)
                return
            }
        }

        // Buscar si algún marcador fue tocado
        for (marker in markers) {
            val mp = geoToScreen(marker.geo)
            val dx = x - mp.x
            val dy = y - mp.y
            val tapRadius = if (marker.bitmap != null) {
                MARKER_ICON_RADIUS + 16f
            } else {
                MARKER_RADIUS + 10f
            }
            if (sqrt((dx * dx + dy * dy).toDouble()) < tapRadius) {
                markerClickListener?.onMarkerClick(marker)
                return
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Background: if enabled, lazily load the illustrated image (stored in drawable-nodpi)
        if (showBackgroundImage && backgroundBitmap == null) {
            val opts = android.graphics.BitmapFactory.Options().apply { inScaled = false }
            backgroundBitmap = runCatching {
                val resId = context.resources.getIdentifier("map_background_illustrated", "drawable", context.packageName)
                if (resId != 0) android.graphics.BitmapFactory.decodeResource(context.resources, resId, opts) else null
            }.getOrNull()
        }

        // Draw illustrated image if available, otherwise fill outside with beige
        if (!showGroundTextures) {
            if (showBackgroundImage && backgroundBitmap != null) {
                canvas.drawBitmap(
                    backgroundBitmap!!,
                    null,
                    RectF(0f, 0f, width.toFloat(), height.toFloat()),
                    backgroundPaint
                )
            } else {
                canvas.drawColor(ThemeColors.mapOutside)
            }
        } else {
            canvas.drawColor(if (isDarkTheme) ThemeColors.darkBackground else ThemeColors.lightBackground)
        }

        // If 2D overlay is hidden, draw only user location and navigation on top and return.
        if (!show2DOverlay) {
            if (isNavigating) drawNavigationArrow(canvas)
            drawUserLocation(canvas)
            return
        }

        // Guardar estado y aplicar transformaciones
        canvas.save()
        canvas.translate(width / 2f + offsetX, height / 2f + offsetY)
        canvas.rotate(rotation * 180f / Math.PI.toFloat())
        canvas.scale(scale, scale)
        canvas.translate(-width / 2f, -height / 2f)

        val groundVp = getPublishedGroundViewport(width.toFloat(), height.toFloat())
        if (showGroundTextures) {
            canvas.save()
            canvas.translate(layerOffsetSections.x, layerOffsetSections.y)
            drawPublishedGround(canvas, width.toFloat(), height.toFloat(), groundVp)
            if (showPublishedTrees) {
                drawPublishedBackdropAndBaseTrees(canvas, groundVp)
            }
            canvas.restore()
        }

        // Dibujar capas (el orden importa)
        if (showGrid) drawGrid(canvas)
        if (showSections) {
            canvas.save()
            canvas.translate(layerOffsetSections.x, layerOffsetSections.y)
            drawSections(canvas)
            canvas.restore()
        }
        if (showBoundary) {
            canvas.save()
            canvas.translate(layerOffsetBoundary.x, layerOffsetBoundary.y)
            drawBoundary(canvas)
            canvas.restore()
        }
        canvas.save()
        canvas.translate(layerOffsetMarkers.x, layerOffsetMarkers.y)
        drawMarkerDots(canvas)
        canvas.restore()

        if (showPublishedTrees) {
            canvas.save()
            canvas.translate(layerOffsetSections.x, layerOffsetSections.y)
            drawPublishedZoneTrees(canvas, groundVp)
            canvas.restore()
        }

        canvas.restore()

        // Dibujar labels sin rotación
        if (showSectionLabels && showSections) drawSectionLabels(canvas)
        if (showLabels) drawMarkerLabels(canvas)
        if (showMapLegend) drawMapLegend(canvas)
        if (showScaleBar) drawScale(canvas)

        // Capa ambiental (bajo referencias espaciales)
        drawAmbientEffects(canvas)

        poiOverlayManager?.drawOverlay(canvas, ::geoToScreenPublic, scale, spatialRefsPhase)

        // Draw sticker overlay (only non-tree stickers follow map rotation)
        stickerOverlayManager?.drawOverlay(canvas, ::geoToScreenPublic, scale, rotation)

        // Draw rotation degree indicator
        drawRotationIndicator(canvas)

        // ⚠️ User location + navigation drawn LAST so they are ALWAYS on top of every other layer
        if (isNavigating) drawNavigationArrow(canvas)
        drawUserLocation(canvas)
    }

    private fun hasActiveAmbientEffects(): Boolean =
        showRainEffect || showFogEffect || showMotesEffect || showCloudShadows
            || showLeavesEffect || showLightningEffect
            || (showNightMistEffect && isDarkTheme)

    private fun needsSceneAnimation(): Boolean =
        hasActiveAmbientEffects() || (poiOverlayManager?.isOverlayVisible == true)

    private fun ambientWind(): AmbientWind = AmbientWind(ambientWindDeg, ambientWindStrength)

    private fun getAmbientPlaneBounds(): MapPlaneBounds {
        val b = getRainPlaneBounds()
        return MapPlaneBounds(b.minX, b.maxX, b.minY, b.maxY)
    }

    private fun getAmbientTickOptions(): AmbientTickOptions =
        AmbientTickOptions(
            bounds = getAmbientPlaneBounds(),
            containsPoint = getRainContainsPoint(),
            wind = ambientWind(),
        )

    private fun buildAmbientClipPath(): Path? {
        parkClipPath.reset()
        val clipPts = rainClipPolygon().map { geoToScreen(it) }
        if (clipPts.size < 3) return null
        parkClipPath.moveTo(clipPts[0].x, clipPts[0].y)
        for (i in 1 until clipPts.size) {
            parkClipPath.lineTo(clipPts[i].x, clipPts[i].y)
        }
        parkClipPath.close()
        return parkClipPath
    }

    private fun clearAmbientEffectParticles() {
        mapRainEffect.clear()
        mapFogEffect.clear()
        mapMotesEffect.clear()
        mapCloudShadowEffect.clear()
        mapLeavesEffect.clear()
        mapNightMistEffect.clear()
        val contains = getRainContainsPoint()
        mapRainEffect.setContainsPoint(contains)
        mapFogEffect.setContainsPoint(contains)
        mapMotesEffect.setContainsPoint(contains)
        mapCloudShadowEffect.setContainsPoint(contains)
        mapLeavesEffect.setContainsPoint(contains)
        mapNightMistEffect.setContainsPoint(contains)
    }

    private fun drawScenarioTint(canvas: Canvas, clipPath: Path?, w: Float, h: Float) {
        val tint = scenarioTint ?: return
        if (tint.alpha <= 0f) return
        val alpha = (tint.alpha * 255).toInt().coerceIn(0, 255)
        canvas.save()
        clipPath?.let { canvas.clipPath(it) }
        scenarioTintPaint.shader = LinearGradient(
            0f, 0f, 0f, h,
            intArrayOf(
                Color.argb(alpha, Color.red(tint.topColor), Color.green(tint.topColor), Color.blue(tint.topColor)),
                Color.argb(alpha, Color.red(tint.bottomColor), Color.green(tint.bottomColor), Color.blue(tint.bottomColor)),
            ),
            floatArrayOf(0f, 1f),
            Shader.TileMode.CLAMP,
        )
        canvas.drawRect(0f, 0f, w, h, scenarioTintPaint)
        scenarioTintPaint.shader = null
        canvas.restore()
    }

    private fun drawAmbientEffects(canvas: Canvas) {
        if (!hasActiveAmbientEffects() && scenarioTint == null) return
        val clipPath = buildAmbientClipPath()
        val toScreen = { bx: Float, by: Float -> baseCanvasToScreen(bx, by) }
        val w = width.toFloat()
        val h = height.toFloat()
        if (showCloudShadows) {
            mapCloudShadowEffect.intensity = cloudShadowIntensity
            mapCloudShadowEffect.sizeMul = cloudShadowSize
            mapCloudShadowEffect.draw(canvas, clipPath, toScreen, scale)
        }
        if (showFogEffect) {
            mapFogEffect.intensity = fogIntensity
            mapFogEffect.sizeMul = fogSize
            mapFogEffect.draw(canvas, clipPath, toScreen, scale)
        }
        if (showNightMistEffect) {
            mapNightMistEffect.intensity = nightMistIntensity
            mapNightMistEffect.draw(canvas, clipPath, toScreen, scale, isDarkTheme, w, h)
        }
        if (showRainEffect) {
            mapRainEffect.intensity = rainIntensity
            mapRainEffect.sizeMul = rainSize
            mapRainEffect.draw(canvas, clipPath, toScreen, scale)
        }
        if (showMotesEffect) {
            mapMotesEffect.intensity = motesIntensity
            mapMotesEffect.sizeMul = motesSize
            mapMotesEffect.draw(canvas, clipPath, toScreen, scale)
        }
        if (showLeavesEffect) {
            mapLeavesEffect.intensity = leavesIntensity
            mapLeavesEffect.sizeMul = leavesSize
            mapLeavesEffect.draw(canvas, clipPath, toScreen, scale)
        }
        if (showLightningEffect) {
            mapLightningEffect.draw(canvas, clipPath, w, h)
        }
        drawScenarioTint(canvas, clipPath, w, h)
    }

    private fun tickAmbientEffects() {
        if (width <= 0 || height <= 0) return
        val options = getAmbientTickOptions()
        if (showCloudShadows) {
            mapCloudShadowEffect.intensity = cloudShadowIntensity
            mapCloudShadowEffect.sizeMul = cloudShadowSize
            mapCloudShadowEffect.tick(options)
        }
        if (showFogEffect) {
            mapFogEffect.intensity = fogIntensity
            mapFogEffect.sizeMul = fogSize
            mapFogEffect.tick(options)
        }
        if (showNightMistEffect && isDarkTheme) {
            mapNightMistEffect.intensity = nightMistIntensity
            mapNightMistEffect.tick(options)
        }
        if (showRainEffect) {
            mapRainEffect.intensity = rainIntensity
            mapRainEffect.sizeMul = rainSize
            mapRainEffect.tick(getRainEffectOptions())
        }
        if (showMotesEffect) {
            mapMotesEffect.intensity = motesIntensity
            mapMotesEffect.sizeMul = motesSize
            mapMotesEffect.tick(options)
        }
        if (showLeavesEffect) {
            mapLeavesEffect.intensity = leavesIntensity
            mapLeavesEffect.sizeMul = leavesSize
            mapLeavesEffect.tick(options)
        }
        if (showLightningEffect) {
            mapLightningEffect.setRainIntensity(rainIntensity)
            mapLightningEffect.tick(showRainEffect)
        }
    }

    private fun updateSceneAnimationLoop() {
        if (needsSceneAnimation()) startSceneAnimationLoop() else stopSceneAnimationLoop()
    }

    private fun startSceneAnimationLoop() {
        if (sceneFrameCallback != null) return
        val choreographer = Choreographer.getInstance()
        sceneFrameCallback = Choreographer.FrameCallback {
            if (poiOverlayManager?.isOverlayVisible == true) {
                spatialRefsPhase += 0.018f * spatialAnimSpeed
            }
            if (hasActiveAmbientEffects()) {
                tickAmbientEffects()
            }
            invalidate()
            if (needsSceneAnimation()) {
                choreographer.postFrameCallback(sceneFrameCallback!!)
            } else {
                sceneFrameCallback = null
            }
        }
        choreographer.postFrameCallback(sceneFrameCallback!!)
    }

    private fun stopSceneAnimationLoop() {
        sceneFrameCallback = null
    }

    fun setRainEffectEnabled(enabled: Boolean) {
        showRainEffect = enabled
        if (!enabled) mapRainEffect.clear()
        updateSceneAnimationLoop()
        invalidate()
    }

    fun notifySceneOptionsChanged() {
        updateSceneAnimationLoop()
        invalidate()
    }

    private fun getParkMapPlaneBounds(): MapRainEffect.MapPlaneBounds {
        val pts = parkBoundary.map { geoToCanvas(GeoPoint(it.lat, it.lng)) }
        var minX = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY
        for (p in pts) {
            minX = min(minX, p.x)
            maxX = max(maxX, p.x)
            minY = min(minY, p.y)
            maxY = max(maxY, p.y)
        }
        return MapRainEffect.MapPlaneBounds(minX, maxX, minY, maxY)
    }

    private fun getRainEffectOptions(): MapRainEffect.RainTickOptions =
        MapRainEffect.RainTickOptions(
            bounds = getRainPlaneBounds(),
            containsPoint = getRainContainsPoint(),
        )

    private fun getRainPlaneBounds(): MapRainEffect.MapPlaneBounds {
        if (rainSectionIndex < 0) return getParkMapPlaneBounds()
        val polygon = parkSections.getOrNull(rainSectionIndex)?.polygon ?: return getParkMapPlaneBounds()
        if (polygon.size < 3) return getParkMapPlaneBounds()
        val pts = polygon.map { geoToCanvas(it) }
        var minX = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY
        for (p in pts) {
            minX = min(minX, p.x)
            maxX = max(maxX, p.x)
            minY = min(minY, p.y)
            maxY = max(maxY, p.y)
        }
        return MapRainEffect.MapPlaneBounds(minX, maxX, minY, maxY)
    }

    private fun getRainContainsPoint(): ((Float, Float) -> Boolean)? {
        if (rainSectionIndex < 0) return null
        val polygon = parkSections.getOrNull(rainSectionIndex)?.polygon ?: return null
        if (polygon.size < 3) return null
        return { bx, by ->
            isPointInPolygon(canvasToGeo(bx, by), polygon)
        }
    }

    private fun rainClipPolygon(): List<GeoPoint> {
        if (rainSectionIndex < 0) {
            return parkBoundary.map { GeoPoint(it.lat, it.lng) }
        }
        return parkSections.getOrNull(rainSectionIndex)?.polygon
            ?: parkBoundary.map { GeoPoint(it.lat, it.lng) }
    }

    private fun canvasToGeo(bx: Float, by: Float): GeoPoint {
        val w = width.toFloat()
        val h = height.toFloat()
        val geoW = bounds.maxLng - bounds.minLng
        val geoH = bounds.maxLat - bounds.minLat
        val latCorrectionFactor = latCorrectionFactor().toFloat()
        val correctedGeoW = geoW * latCorrectionFactor
        val scaleX = w / correctedGeoW.toFloat()
        val scaleY = h / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f
        val cx = w / 2f
        val cy = h / 2f
        val geoMidLat = (bounds.minLat + bounds.maxLat) / 2
        val geoMidLng = (bounds.minLng + bounds.maxLng) / 2
        val relX = bx - cx
        val relY = by - cy
        val lng = geoMidLng + relX / (latCorrectionFactor * s)
        val lat = geoMidLat - relY / s
        return GeoPoint(lat, lng)
    }

    private fun baseCanvasToScreen(bx: Float, by: Float): Pair<Float, Float> {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        var x = bx - cx
        var y = by - cy
        x *= scale
        y *= scale
        val cosr = cos(rotation.toDouble()).toFloat()
        val sinr = sin(rotation.toDouble()).toFloat()
        val rx = cosr * x - sinr * y
        val ry = sinr * x + cosr * y
        return Pair(rx + cx + offsetX, ry + cy + offsetY)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        updateSceneAnimationLoop()
    }

    override fun onDetachedFromWindow() {
        stopSceneAnimationLoop()
        locationAnimator?.cancel()
        headingAnimator?.cancel()
        pulseAnimator?.cancel()
        userSonarAnimator?.cancel()
        super.onDetachedFromWindow()
    }

    private fun drawGrid(canvas: Canvas) {
        gridPaint.color = if (isDarkTheme) ThemeColors.darkGrid else ThemeColors.lightGrid
        gridPaint.strokeWidth = 1f / scale

        val interval = 0.0005
        var lat = (bounds.minLat / interval).toLong() * interval
        while (lat <= bounds.maxLat) {
            val p1 = geoToCanvas(GeoPoint(lat, bounds.minLng))
            val p2 = geoToCanvas(GeoPoint(lat, bounds.maxLng))
            canvas.drawLine(p1.x, p1.y, p2.x, p2.y, gridPaint)
            lat += interval
        }

        var lng = (bounds.minLng / interval).toLong() * interval
        while (lng <= bounds.maxLng) {
            val p1 = geoToCanvas(GeoPoint(bounds.minLat, lng))
            val p2 = geoToCanvas(GeoPoint(bounds.maxLat, lng))
            canvas.drawLine(p1.x, p1.y, p2.x, p2.y, gridPaint)
            lng += interval
        }
    }


    private fun drawSections(canvas: Canvas) {
        for ((index, section) in parkSections.withIndex()) {
            if (section.polygon.size < 3) continue

            val path = Path()
            val firstPoint = geoToCanvas(section.polygon[0])
            path.moveTo(firstPoint.x, firstPoint.y)

            for (i in 1 until section.polygon.size) {
                val p = geoToCanvas(section.polygon[i])
                path.lineTo(p.x, p.y)
            }
            path.close()

            val highlight = index == highlightedSectionIndex
            val baseOpacity = if (isDarkTheme) section.fillOpacity else section.fillOpacityLight
            val drawOpacity = if (highlight) minOf(baseOpacity + 0.12f, 1f) else baseOpacity

            if (drawOpacity > 0f) {
                sectionPaint.color = Color.argb(
                    (drawOpacity * 255).toInt(),
                    Color.red(section.chartColor),
                    Color.green(section.chartColor),
                    Color.blue(section.chartColor),
                )
                canvas.drawPath(path, sectionPaint)
            }

            sectionStrokePaint.color = section.chartColor
            sectionStrokePaint.strokeWidth = (if (highlight) 5.5f else 4f) / scale
            canvas.drawPath(path, sectionStrokePaint)
        }
    }

    /** Etiquetas de ecosistema (P0) — espacio pantalla, sin rotar con el mapa. */
    private fun geoToScreenWithLayerOffset(geo: GeoPoint, offset: LayerOffset): ScreenPoint {
        val base = geoToCanvas(geo)
        val cx = width / 2f
        val cy = height / 2f
        var x = base.x + offset.x - cx
        var y = base.y + offset.y - cy
        x *= scale
        y *= scale
        val cosr = cos(rotation.toDouble()).toFloat()
        val sinr = sin(rotation.toDouble()).toFloat()
        val rx = cosr * x - sinr * y
        val ry = sinr * x + cosr * y
        return ScreenPoint(rx + cx + offsetX, ry + cy + offsetY)
    }

    private fun drawSectionLabels(canvas: Canvas) {
        for (section in parkSections) {
            if (section.polygon.size < 3) continue
            val centroid = ParkSectionResolver.polygonCentroid(section.polygon)
            val screenPos = geoToScreenWithLayerOffset(centroid, layerOffsetSections)

            labelPaint.textSize = 30f
            labelPaint.typeface = Typeface.DEFAULT_BOLD
            val textWidth = labelPaint.measureText(section.name)
            val padH = 14f
            val boxH = 36f
            val rect = RectF(
                screenPos.x - (textWidth + padH * 2) / 2f,
                screenPos.y - boxH / 2f,
                screenPos.x + (textWidth + padH * 2) / 2f,
                screenPos.y + boxH / 2f,
            )
            labelBgPaint.color = if (isDarkTheme) Color.argb(200, 0, 0, 0) else Color.argb(235, 255, 255, 255)
            canvas.drawRoundRect(rect, 10f, 10f, labelBgPaint)
            labelPaint.color = if (isDarkTheme) Color.WHITE else Color.parseColor("#212121")
            canvas.drawText(section.name, screenPos.x, screenPos.y + 10f, labelPaint)
        }
    }

    /** Leyenda 3 zonas + punto GPS (P0). */
    private fun drawMapLegend(canvas: Canvas) {
        val left = 16f
        var top = height - 24f - (parkSections.size + 1) * 22f
        val legendBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isDarkTheme) Color.argb(210, 20, 20, 30) else Color.argb(230, 255, 255, 255)
            style = Paint.Style.FILL
        }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 22f
            color = if (isDarkTheme) Color.WHITE else Color.parseColor("#333333")
        }
        val titlePaint = Paint(textPaint).apply {
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            color = if (isDarkTheme) Color.LTGRAY else Color.DKGRAY
        }
        val boxW = 200f
        val boxH = 24f + (parkSections.size + 1) * 22f + 12f
        canvas.drawRoundRect(RectF(left, top - 8f, left + boxW, top + boxH), 12f, 12f, legendBg)
        canvas.drawText("ZONAS", left + 12f, top + 14f, titlePaint)
        top += 28f
        for (section in parkSections) {
            val swatch = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = section.chartColor
                style = Paint.Style.FILL
            }
            canvas.drawRoundRect(RectF(left + 12f, top, left + 28f, top + 14f), 3f, 3f, swatch)
            canvas.drawText(section.name, left + 36f, top + 12f, textPaint)
            top += 22f
        }
        val youPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#1E88E5")
            style = Paint.Style.FILL
        }
        canvas.drawCircle(left + 20f, top + 7f, 7f, youPaint)
        canvas.drawText("Tú (GPS)", left + 36f, top + 12f, textPaint)
    }

    private fun drawBoundary(canvas: Canvas) {
        if (parkBoundary.size < 3) return

        val path = Path()
        val firstPoint = geoToCanvas(parkBoundary[0])
        path.moveTo(firstPoint.x, firstPoint.y)

        for (i in 1 until parkBoundary.size) {
            val p = geoToCanvas(parkBoundary[i])
            path.lineTo(p.x, p.y)
        }
        path.close()

        // Interior kept transparent so the 3D ground plane shows through

        // Contorno
        boundaryPaint.color = if (isDarkTheme) ThemeColors.darkBoundary else ThemeColors.lightBoundary
        boundaryPaint.strokeWidth = 4f / scale
        canvas.drawPath(path, boundaryPaint)

        // Vértices
        markerPaint.color = if (isDarkTheme) ThemeColors.darkText else ThemeColors.lightText
        val vertexRadius = 3f / scale
        for (p in parkBoundary) {
            val sp = geoToCanvas(p)
            canvas.drawCircle(sp.x, sp.y, vertexRadius, markerPaint)
        }
    }


    private fun drawMarkerDots(canvas: Canvas) {
        val markerRadius = MARKER_RADIUS / scale
        val innerRadius = MARKER_INNER_RADIUS / scale
        val warningRadius = MARKER_WARNING_RADIUS / scale
        val iconRadius = MARKER_ICON_RADIUS / scale

        for (marker in markers) {
            val p = geoToCanvas(marker.geo)

            // ── Modo Explorador: icono circular del animal ─────────────────
            if (marker.bitmap != null) {
                // Anillo de pulso rojo para animales en rango que aún no se capturaron
                if (marker.isNearby && !marker.isFound) {
                    markerPaint.style = Paint.Style.FILL
                    markerPaint.color = Color.argb(pulseAlpha, 229, 57, 53) // rojo #E53935
                    canvas.drawCircle(p.x, p.y, iconRadius * 1.65f, markerPaint)
                }

                // Anillo coloreado por estado
                //   verde brillante  = ya encontrado y guardado
                //   rojo pulsante    = al alcance (no encontrado todavía)
                if (marker.isFound) {
                    // Halo exterior verde semitransparente (efecto glow)
                    markerPaint.style = Paint.Style.FILL
                    markerPaint.color = Color.argb(150, 105, 240, 174) // #69F0AE translúcido
                    canvas.drawCircle(p.x, p.y, iconRadius * 1.50f, markerPaint)
                    // Anillo sólido verde brillante
                    markerPaint.color = Color.parseColor("#00C853")
                    canvas.drawCircle(p.x, p.y, iconRadius * 1.24f, markerPaint)
                } else {
                    markerPaint.style = Paint.Style.FILL
                    markerPaint.color = Color.parseColor("#F44336") // rojo
                    canvas.drawCircle(p.x, p.y, iconRadius * 1.12f, markerPaint)
                }

                // Icono recortado en círculo
                iconClipPath.reset()
                iconClipPath.addCircle(p.x, p.y, iconRadius, Path.Direction.CW)
                canvas.save()
                canvas.clipPath(iconClipPath)
                val bmp = marker.bitmap!!
                val src = Rect(0, 0, bmp.width, bmp.height)
                val dst = RectF(p.x - iconRadius, p.y - iconRadius, p.x + iconRadius, p.y + iconRadius)
                // Dim icon slightly if not found and not nearby (undiscovered animal)
                if (!marker.isFound && !marker.isNearby) {
                    bitmapPaint.colorFilter = android.graphics.ColorMatrixColorFilter(
                        android.graphics.ColorMatrix().apply { setSaturation(0.35f) }
                    )
                } else {
                    bitmapPaint.colorFilter = null
                }
                canvas.drawBitmap(bmp, src, dst, bitmapPaint)
                canvas.restore()

                continue
            }

            // ── Marcador clásico rediseñado (game-pin) ───────────────────────
            // Fallback cuando el bitmap del ícono aún no cargó (Glide pendiente)

            // Paleta de colores según estado
            val colBase = when {
                marker.isFound  -> Color.parseColor("#00C853")  // verde brillante
                marker.isNearby -> Color.parseColor("#FF6D00")  // naranja
                else            -> Color.parseColor("#78909C")  // gris azulado (admin/desconocido)
            }
            val colDark = when {
                marker.isFound  -> Color.parseColor("#1B5E20")
                marker.isNearby -> Color.parseColor("#BF360C")
                else            -> Color.parseColor("#37474F")
            }
            val colLight = when {
                marker.isFound  -> Color.parseColor("#69F0AE")
                marker.isNearby -> Color.parseColor("#FFCC80")
                else            -> Color.parseColor("#B0BEC5")
            }

            // 0. Pulso expandido para animales en rango no capturados
            if (marker.isNearby && !marker.isFound) {
                markerPaint.style = Paint.Style.FILL
                markerPaint.color = Color.argb(pulseAlpha, 255, 109, 0)
                canvas.drawCircle(p.x, p.y, warningRadius * 1.35f, markerPaint)
            }

            // 1. Sombra desplazada (efecto elevación)
            markerPaint.style = Paint.Style.FILL
            markerPaint.color = Color.argb(80,
                Color.red(colDark), Color.green(colDark), Color.blue(colDark))
            canvas.drawCircle(p.x, p.y + markerRadius * 0.22f, markerRadius * 1.35f, markerPaint)

            // 2. Anillo exterior oscuro
            markerPaint.color = colDark
            canvas.drawCircle(p.x, p.y, markerRadius * 1.18f, markerPaint)

            // 3. Relleno principal
            markerPaint.color = colBase
            canvas.drawCircle(p.x, p.y, markerRadius, markerPaint)

            // 4. Reflejo interior (gradiente simulado)
            markerPaint.color = colLight
            canvas.drawCircle(p.x, p.y - markerRadius * 0.12f, markerRadius * 0.58f, markerPaint)

            // 5. Brillo central (especular)
            markerPaint.color = Color.WHITE
            canvas.drawCircle(p.x - markerRadius * 0.12f, p.y - markerRadius * 0.2f,
                markerRadius * 0.25f, markerPaint)

            // 6. Punto blanco central sólido
            markerPaint.color = Color.WHITE
            canvas.drawCircle(p.x, p.y, innerRadius * 0.9f, markerPaint)
        }
    }

    private fun drawMarkerLabels(canvas: Canvas) {
        for (marker in markers) {
            val screenPos = geoToScreenWithLayerOffset(marker.geo, layerOffsetMarkers)

            labelPaint.color = if (isDarkTheme) ThemeColors.darkText else ThemeColors.lightText
            val textWidth = labelPaint.measureText(marker.name)
            val padding = 12f
            val boxWidth = textWidth + padding * 2
            val boxHeight = 40f

            // Fondo del label
            labelBgPaint.color = if (marker.isInside) {
                if (isDarkTheme) Color.argb(200, 0, 0, 0) else Color.argb(230, 255, 255, 255)
            } else {
                Color.argb(230, 80, 0, 0)
            }

            val rect = RectF(
                screenPos.x - boxWidth / 2,
                screenPos.y - 75f,
                screenPos.x + boxWidth / 2,
                screenPos.y - 75f + boxHeight
            )
            canvas.drawRoundRect(rect, 8f, 8f, labelBgPaint)

            // Texto
            labelPaint.color = if (marker.isInside) {
                if (isDarkTheme) ThemeColors.darkText else ThemeColors.lightText
            } else {
                Color.parseColor("#ffcccc")
            }
            canvas.drawText(marker.name, screenPos.x, screenPos.y - 48f, labelPaint)

            // Advertencia si está fuera
            if (!marker.isInside) {
                labelPaint.textSize = 24f
                labelPaint.color = Color.parseColor("#ff6666")
                canvas.drawText("⚠ FUERA", screenPos.x, screenPos.y + 50f, labelPaint)
                labelPaint.textSize = 32f
            }
        }
    }

    private fun drawScale(canvas: Canvas) {
        val scaleBarWidth = 200f
        val x = width - scaleBarWidth - 40f
        val y = height - 60f

        val degreesPerPixel = (bounds.maxLng - bounds.minLng) / width / scale
        val metersPerPixel = degreesPerPixel * metersPerDegLng((bounds.minLat + bounds.maxLat) / 2)
        val meters = (scaleBarWidth * metersPerPixel).toInt()

        // Fondo
        labelBgPaint.color = if (isDarkTheme) Color.argb(180, 0, 0, 0) else Color.argb(230, 255, 255, 255)
        canvas.drawRect(x - 10, y - 40, x + scaleBarWidth + 10, y + 15, labelBgPaint)

        // Barra
        scalePaint.color = if (isDarkTheme) ThemeColors.darkBoundary else ThemeColors.lightBoundary
        scalePaint.style = Paint.Style.FILL
        canvas.drawRect(x, y, x + scaleBarWidth, y + 8, scalePaint)

        // Texto
        scalePaint.color = if (isDarkTheme) ThemeColors.darkText else ThemeColors.lightText
        canvas.drawText("${meters}m", x + scaleBarWidth / 2, y - 12, scalePaint)
    }

    private fun drawRotationIndicator(canvas: Canvas) {
        // Convert rotation from radians to degrees and normalize to 0-360
        var degrees = (rotation * 180f / Math.PI.toFloat())
        degrees = ((degrees % 360f) + 360f) % 360f

        val text = "${degrees.toInt()}°"
        val cx = width / 2f
        val cy = 65f

        // Background pill
        rotationDegreePaint.color = if (isDarkTheme) ThemeColors.darkText else ThemeColors.lightText
        val textWidth = rotationDegreePaint.measureText(text)
        val paddingH = 24f
        val paddingV = 10f
        rotationDegreeBgPaint.color = if (isDarkTheme) Color.argb(180, 0, 0, 0) else Color.argb(200, 255, 255, 255)
        canvas.drawRoundRect(
            cx - textWidth / 2 - paddingH,
            cy - 25f - paddingV,
            cx + textWidth / 2 + paddingH,
            cy + 8f + paddingV,
            16f, 16f,
            rotationDegreeBgPaint
        )

        // Compass indicator arrow (small triangle pointing up = north)
        val arrowPaint = Paint().apply {
            color = Color.RED
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        val arrowSize = 8f
        val arrowY = cy - 25f - paddingV + 6f
        val arrowPath = Path()
        arrowPath.moveTo(cx, arrowY)
        arrowPath.lineTo(cx - arrowSize, arrowY + arrowSize * 1.5f)
        arrowPath.lineTo(cx + arrowSize, arrowY + arrowSize * 1.5f)
        arrowPath.close()
        canvas.drawPath(arrowPath, arrowPaint)

        // Degree text
        canvas.drawText(text, cx, cy + 5f, rotationDegreePaint)
    }

    // ===== User location drawing =====

    /**
     * Draw a Google Maps-style navigation pointer: a rounded chevron/teardrop
     * that rotates to show heading direction, with a soft shadow underneath,
     * an accuracy fan, and a pulsing sonar ring.
     */
    private fun drawUserLocation(canvas: Canvas) {
        val loc = displayedUserLocation ?: return
        val screenPos = geoToScreen(loc)
        val cx = screenPos.x
        val cy = screenPos.y

        // Combined heading: compass heading + map rotation
        val headingRad = Math.toRadians(
            displayedHeading.toDouble() + rotation * 180.0 / Math.PI
        ).toFloat()

        // ── 1. Sonar ring (pulsating outward) ──────────────────────
        if (userSonarAlpha > 0) {
            val sonarRadius = 30f + userSonarFraction * 65f
            userLocationSonarPaint.alpha = userSonarAlpha
            canvas.drawCircle(cx, cy, sonarRadius, userLocationSonarPaint)
        }

        // ── 2. Accuracy halo (static semi-transparent circle) ──────
        canvas.drawCircle(cx, cy, 48f, userLocationRadiusPaint)

        // ── 3. Heading fan / cone (Google Maps-style) ──────────────
        // A wider, shorter, more transparent fan than before
        val fanPath = Path()
        val fanLength = 62f
        val fanHalfAngle = Math.toRadians(32.0).toFloat()
        fanPath.moveTo(cx, cy)
        fanPath.lineTo(
            cx + fanLength * sin((headingRad - fanHalfAngle).toDouble()).toFloat(),
            cy - fanLength * cos((headingRad - fanHalfAngle).toDouble()).toFloat()
        )
        // Curved outer edge
        val fanBounds = RectF(
            cx - fanLength, cy - fanLength,
            cx + fanLength, cy + fanLength
        )
        val startAngleDeg = Math.toDegrees((headingRad - fanHalfAngle - Math.PI / 2).toDouble()).toFloat()
        val sweepAngleDeg = Math.toDegrees(2.0 * fanHalfAngle.toDouble()).toFloat()
        fanPath.arcTo(fanBounds, startAngleDeg, sweepAngleDeg, false)
        fanPath.close()
        headingPaint.color = Color.argb(60, 66, 133, 244)
        canvas.drawPath(fanPath, headingPaint)
        headingPaint.color = Color.argb(100, 66, 133, 244) // restore

        // ── 4. Drop shadow  ────────────────────────────────────────
        canvas.save()
        canvas.translate(cx, cy)
        canvas.rotate(Math.toDegrees(headingRad.toDouble()).toFloat())
        canvas.drawPath(shadowPointerPath, pointerShadowPaint)

        // ── 5. Main pointer: white border + blue gradient fill ─────
        canvas.drawPath(borderPointerPath, pointerBorderPaint)
        canvas.drawPath(fillPointerPath, pointerFillPaint)

        // ── 6. Inner white dot ─────────────────────────────────────
        canvas.drawCircle(0f, 3f, 7.5f, pointerInnerDotPaint)

        // ── 7. Specular highlight ──────────────────────────────────
        canvas.drawCircle(-4f, -4f, 5.5f, pointerSpecPaint)

        canvas.restore()
    }

    /**
     * Creates a Google Maps-style navigation pointer path:
     * a rounded teardrop/chevron shape pointing UP (north) in local coords.
     * The tip points upward (negative Y) and the base is a rounded bottom.
     *
     * @param cx center X offset
     * @param cy center Y offset
     * @param scale size multiplier (1.0 = default ~42px tall)
     */
    private fun createNavigationPointerPath(cx: Float, cy: Float, scale: Float): Path {
        val s = scale
        val path = Path()
        // Tip of the pointer (pointing up / north)
        path.moveTo(cx, cy - 25f * s)
        // Right side curve to the widest point
        path.cubicTo(
            cx + 8f * s, cy - 20f * s,    // control point 1
            cx + 19f * s, cy - 6f * s,    // control point 2
            cx + 18f * s, cy + 5f * s     // widest point right
        )
        // Right side curve down to bottom
        path.cubicTo(
            cx + 16f * s, cy + 14f * s,   // control 1
            cx + 10f * s, cy + 20f * s,   // control 2
            cx, cy + 18f * s              // bottom center
        )
        // Left side curve up from bottom
        path.cubicTo(
            cx - 10f * s, cy + 20f * s,   // control 2 mirrored
            cx - 16f * s, cy + 14f * s,   // control 1 mirrored
            cx - 18f * s, cy + 5f * s     // widest point left
        )
        // Left side curve back to tip
        path.cubicTo(
            cx - 19f * s, cy - 6f * s,    // control 2
            cx - 8f * s, cy - 20f * s,    // control 1
            cx, cy - 25f * s              // tip
        )
        path.close()
        return path
    }

    private fun drawNavigationArrow(canvas: Canvas) {
        val userLoc = displayedUserLocation ?: userLocation ?: return
        val target = navigationTarget ?: return

        val userScreen = geoToScreen(userLoc)
        val targetScreen = geoToScreen(target)

        // Calculate direction from user to target in screen space
        val dx = targetScreen.x - userScreen.x
        val dy = targetScreen.y - userScreen.y
        val dist = sqrt((dx * dx + dy * dy).toDouble()).toFloat()
        if (dist < 1f) return

        val dirX = dx / dist
        val dirY = dy / dist

        // Arrow shaft: from user dot edge toward target (max 120px length)
        val shaftStart = 20f // start outside user dot radius
        val shaftLength = minOf(dist - 24f, 120f).coerceAtLeast(30f)
        val startX = userScreen.x + dirX * shaftStart
        val startY = userScreen.y + dirY * shaftStart
        val endX = userScreen.x + dirX * (shaftStart + shaftLength)
        val endY = userScreen.y + dirY * (shaftStart + shaftLength)

        // Draw arrow shaft
        navigationPathPaint.pathEffect = null
        navigationPathPaint.strokeWidth = 8f
        navigationPathPaint.style = Paint.Style.STROKE
        navigationPathPaint.strokeCap = Paint.Cap.ROUND
        canvas.drawLine(startX, startY, endX, endY, navigationPathPaint)

        // Arrowhead
        val headLength = 24f
        val headAngle = Math.toRadians(25.0)
        val ax1 = endX - headLength * (dirX * cos(headAngle) - dirY * sin(headAngle)).toFloat()
        val ay1 = endY - headLength * (dirY * cos(headAngle) + dirX * sin(headAngle)).toFloat()
        val ax2 = endX - headLength * (dirX * cos(headAngle) + dirY * sin(headAngle)).toFloat()
        val ay2 = endY - headLength * (dirY * cos(headAngle) - dirX * sin(headAngle)).toFloat()

        val arrowPaint = Paint().apply {
            style = Paint.Style.FILL
            isAntiAlias = true
            color = Color.parseColor("#4285F4")
        }
        val arrowPath = Path()
        arrowPath.moveTo(endX, endY)
        arrowPath.lineTo(ax1, ay1)
        arrowPath.lineTo(ax2, ay2)
        arrowPath.close()
        canvas.drawPath(arrowPath, arrowPaint)

        // Draw target circle
        val targetStrokePaint = Paint().apply {
            style = Paint.Style.STROKE
            isAntiAlias = true
            color = Color.parseColor("#EA4335")
            strokeWidth = 4f
        }
        canvas.drawCircle(targetScreen.x, targetScreen.y, 20f, targetStrokePaint)
        val targetFillPaint = Paint().apply {
            style = Paint.Style.FILL
            isAntiAlias = true
            color = Color.argb(60, 234, 67, 53)
        }
        canvas.drawCircle(targetScreen.x, targetScreen.y, 20f, targetFillPaint)

        // Distance text below user dot
        val distMeters = calculateDistance(userLoc, target)
        val distText = if (distMeters >= 1000) {
            String.format("%.1f km", distMeters / 1000)
        } else {
            String.format("%.0f m", distMeters)
        }
        val distPaint = Paint().apply {
            textSize = 32f
            textAlign = Paint.Align.CENTER
            isAntiAlias = true
            color = Color.WHITE
            isFakeBoldText = true
            setShadowLayer(4f, 0f, 2f, Color.BLACK)
        }
        canvas.drawText(distText, userScreen.x, userScreen.y + 40f, distPaint)
    }

    /**
     * Calculate geodesic distance between two GeoPoints using Haversine formula
     * @return distance in meters
     */
    private fun calculateDistance(from: GeoPoint, to: GeoPoint): Double {
        val R = 6371000.0 // Earth radius in meters
        val lat1 = Math.toRadians(from.lat)
        val lat2 = Math.toRadians(to.lat)
        val dLat = Math.toRadians(to.lat - from.lat)
        val dLng = Math.toRadians(to.lng - from.lng)
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    // ===== API pública =====

    fun setMarkerClickListener(listener: OnMarkerClickListener?) {
        markerClickListener = listener
    }

    fun setLocations(locations: List<Location>) {
        markers.clear()
        for (loc in locations) {
            val geo = GeoPoint(loc.latitude, loc.longitude)
            markers.add(MapMarker(
                id = loc.id ?: "",
                name = loc.name,
                geo = geo,
                section = loc.section,
                isInside = isPointInPolygon(geo, parkBoundary)
            ))
        }
        invalidate()
    }

    // ── Explorer marker helpers ─────────────────────────────────────────────

    /**
     * Sets (or clears) the icon bitmap for an animal marker.
     * The bitmap is drawn as a circular icon replacing the default red dot.
     * Call this after loading the icon with Glide from the animal's [iconUrl].
     */
    fun setMarkerBitmap(id: String, bitmap: Bitmap?) {
        markers.find { it.id == id }?.let {
            it.bitmap = bitmap
            invalidate()
        }
    }

    /**
     * Marks a marker as "nearby" (within encounter radius).
     * Triggers a pulsing orange ring around the icon.
     */
    fun setMarkerNearby(id: String, nearby: Boolean) {
        markers.find { it.id == id }?.let {
            it.isNearby = nearby
        }
        val anyNearby = markers.any { it.isNearby }
        if (anyNearby) startPulseAnimation() else stopPulseAnimation()
        invalidate()
    }

    /**
     * Marks a marker as "found" (encounter saved by the user).
     * Found markers show a green ring instead of the section color.
     */
    fun setMarkerFound(id: String, found: Boolean) {
        markers.find { it.id == id }?.let {
            it.isFound = found
            invalidate()
        }
    }

    /** Starts the continuous pulse animation for nearby markers. */
    private fun startPulseAnimation() {
        if (pulseAnimator?.isRunning == true) return
        pulseAnimator = ValueAnimator.ofInt(40, 180).apply {
            duration = 900L
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener { anim ->
                if (isAttachedToWindow) {
                    pulseAlpha = anim.animatedValue as Int
                    invalidate()
                }
            }
            start()
        }
    }

    /** Stops the pulse animation and resets alpha. */
    private fun stopPulseAnimation() {
        pulseAnimator?.cancel()
        pulseAnimator = null
        pulseAlpha = 100
    }

    /** Starts the continuous sonar-ping animation on the user location dot. */
    private fun startUserLocationSonar() {
        if (userSonarAnimator?.isRunning == true) return
        userSonarAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1800L
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener { anim ->
                if (isAttachedToWindow) {
                    userSonarFraction = anim.animatedValue as Float
                    userSonarAlpha = ((1f - userSonarFraction) * 210).toInt()
                    invalidate()
                }
            }
            start()
        }
    }

    fun setDarkTheme(dark: Boolean) {
        isDarkTheme = dark
        invalidate()
    }

    fun zoomIn() {
        scale *= 1.4f
        scale = scale.coerceIn(0.3f, 15f)
        clampOffsets()
        invalidate()
    }

    fun zoomOut() {
        scale /= 1.4f
        scale = scale.coerceIn(0.3f, 15f)
        clampOffsets()
        invalidate()
    }

    fun rotateLeft() {
        rotation -= (Math.PI / 48).toFloat()
        clampOffsets()
        invalidate()
    }

    fun rotateRight() {
        rotation += (Math.PI / 48).toFloat()
        clampOffsets()
        invalidate()
    }

    fun resetView() {
        // Recalculate scale for 75m if view has dimensions
        if (width > 0) {
            val boundsWidth = bounds.maxLng - bounds.minLng
            val scaleBarWidth = 200.0
            val computedScale = (scaleBarWidth * boundsWidth * metersPerDegLng((bounds.minLat + bounds.maxLat) / 2)) / (width * targetScaleBarMeters)
            scale = computedScale.toFloat().coerceIn(0.3f, 15f)
        } else {
            scale = 1.2f
        }
        rotation = 0f
        offsetX = 0f
        offsetY = 0f
        clampOffsets()
        invalidate()
    }

    fun centerOnMarker(markerId: String) {
        val marker = markers.find { it.id == markerId } ?: return
        val screenPoint = geoToScreen(marker.geo)
        offsetX = width / 2f - screenPoint.x + offsetX
        offsetY = height / 2f - screenPoint.y + offsetY
        scale = 3f
        clampOffsets()
        invalidate()
    }

    /**
     * Update the user's location on the map.
     *
     * @param animDurationMs  How long to animate the dot to the new position.
     *   - Pass 0 for direct set from the 60 fps render loop (most common path).
     *   - Pass 800 ms for one-off GPS fixes needing visual transition.
     *   Uses smooth-step (ease-in-out cubic) interpolation so the dot
     *   decelerates into position instead of abruptly stopping.
     */
    fun setUserLocation(lat: Double, lng: Double, animDurationMs: Long = 800L) {
        val newTarget = GeoPoint(lat, lng)
        userLocation = newTarget // keep raw target for navigation distance

        val current = displayedUserLocation
        if (current == null) {
            // First fix: display immediately and start sonar
            displayedUserLocation = newTarget
            startUserLocationSonar()
            invalidate()
            return
        }

        // Skip animation for sub-metre movements (avoids micro-jitter animation)
        // ~0.000009 deg ≈ 1 m at Bolivia's latitude
        val dLat = newTarget.lat - current.lat
        val dLng = newTarget.lng - current.lng
        if (animDurationMs <= 0L ||
            (Math.abs(dLat) < 0.000009 && Math.abs(dLng) < 0.000009))
        {
            // Direct set — but apply exponential smoothing to avoid pixel-level
            // jitter that makes the dot appear to vibrate in place.
            // Lower alpha = smoother/slower convergence (~0.5 s at 60 fps).
            val alpha = if (animDurationMs <= 0L) 0.15 else 1.0
            locationAnimator?.cancel()
            displayedUserLocation = GeoPoint(
                lat = current.lat + (newTarget.lat - current.lat) * alpha,
                lng = current.lng + (newTarget.lng - current.lng) * alpha
            )
            invalidate()
            return
        }

        // Animate the dot with smooth-step (ease-in-out) curve so it
        // decelerates into the target instead of stopping abruptly.
        locationAnimator?.cancel()
        val fromLat = current.lat
        val fromLng = current.lng
        locationAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = animDurationMs
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { anim ->
                val t = anim.animatedValue as Float
                // Smooth-step: 3t² - 2t³ (smoother than linear, no overshoot)
                val s = t * t * (3f - 2f * t)
                displayedUserLocation = GeoPoint(
                    lat = fromLat + s * (newTarget.lat - fromLat),
                    lng = fromLng + s * (newTarget.lng - fromLng)
                )
                invalidate()
            }
            start()
        }
    }

    fun setUserHeading(degrees: Float) {
        userHeading = degrees

        // Interpolate heading via the shortest angular path to avoid spinning
        headingAnimator?.cancel()
        val from = displayedHeading
        var delta = degrees - from
        if (delta > 180f)  delta -= 360f
        if (delta < -180f) delta += 360f

        // Skip animation for very small changes — immediate update reduces visual lag
        if (Math.abs(delta) < 2f) {
            displayedHeading = degrees
            invalidate()
            return
        }

        // Fast 80 ms linear animation — at 200 Hz sensor rate the next heading
        // arrives in ~5 ms, so the animation barely runs before being replaced.
        // This gives Google Maps-like instant heading response.
        headingAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 80L
            interpolator = LinearInterpolator()
            addUpdateListener { anim ->
                val t = anim.animatedValue as Float
                var h = from + t * delta
                if (h > 180f)  h -= 360f
                if (h < -180f) h += 360f
                displayedHeading = h
                invalidate()
            }
            start()
        }
    }

    fun centerOnUserLocation() {
        val loc = displayedUserLocation ?: userLocation ?: return
        val screenPoint = geoToScreen(loc)
        offsetX = width / 2f - screenPoint.x + offsetX
        offsetY = height / 2f - screenPoint.y + offsetY
        scale = 4f
        clampOffsets()
        invalidate()
    }

    /**
     * Returns true if [lat]/[lng] falls within the park geographic bounding box.
     * Used to show an "out of bounds" alert when the user is far from the park.
     */
    fun isInsideParkBounds(lat: Double, lng: Double): Boolean {
        return lat >= bounds.minLat && lat <= bounds.maxLat &&
               lng >= bounds.minLng && lng <= bounds.maxLng
    }
    fun startNavigationToMarker(targetMarkerId: String) {
        val marker = markers.find { it.id == targetMarkerId } ?: return
        navigationTarget = marker.geo
        isNavigating = true
        invalidate()
    }

    fun stopNavigation() {
        isNavigating = false
        navigationTarget = null
        invalidate()
    }

    fun isNavigating(): Boolean = isNavigating

    // ═══════════════════════════════════════════════════════════════
    // MAP STATE — Capture/restore map configuration for layers
    // ═══════════════════════════════════════════════════════════════

    data class MapState(
        val scale: Float,
        val rotation: Float,
        val offsetX: Float,
        val offsetY: Float,
        val showGrid: Boolean,
        val showBoundary: Boolean,
        val showSections: Boolean,
        val showLabels: Boolean
    )

    fun getMapState(): MapState = MapState(
        scale = scale,
        rotation = rotation,
        offsetX = offsetX,
        offsetY = offsetY,
        showGrid = showGrid,
        showBoundary = showBoundary,
        showSections = showSections,
        showLabels = showLabels
    )

    fun setMapState(state: MapState) {
        scale = state.scale
        rotation = state.rotation
        offsetX = state.offsetX
        offsetY = state.offsetY
        showGrid = state.showGrid
        showBoundary = state.showBoundary
        showSections = state.showSections
        showLabels = state.showLabels
        invalidate()
    }

    fun applyPublishedSections(records: List<ParkSectionRecordData>?) {
        publishedSectionsOverride = records
            ?.takeIf { it.isNotEmpty() }
            ?.let { PublishedParkMapper.toParkSections(it) }
        invalidate()
    }

    fun applyPublishedLayerOffsets(offsets: LayerOffsetsData?) {
        layerOffsetBoundary = LayerOffset(
            offsets?.boundary?.x?.toFloat() ?: 0f,
            offsets?.boundary?.y?.toFloat() ?: 0f,
        )
        layerOffsetSections = LayerOffset(
            offsets?.sections?.x?.toFloat() ?: 0f,
            offsets?.sections?.y?.toFloat() ?: 0f,
        )
        layerOffsetMarkers = LayerOffset(
            offsets?.markers?.x?.toFloat() ?: 0f,
            offsets?.markers?.y?.toFloat() ?: 0f,
        )
        invalidate()
    }

    /** Escena ambiental publicada (efectos + escenario + viento). */
    fun applyPublishedAmbientScene(scene: AmbientSceneData) {
        scenarioTint = AmbientScenarioTints.tintForScenario(scene.activeScenarioId)
        scene.ambientWindDeg?.let { ambientWindDeg = it.toFloat() }
        scene.ambientWindStrength?.let { ambientWindStrength = it.toFloat().coerceIn(0f, 1f) }
        scene.spatialAnimSpeed?.let { spatialAnimSpeed = it.toFloat() }

        scene.rainSectionIndex?.let { rainSectionIndex = it }
        scene.rainIntensity?.let { rainIntensity = it.toFloat().coerceIn(0f, 1f) }
        scene.rainSize?.let { rainSize = it.toFloat().coerceIn(0.08f, 2.5f) }
        showRainEffect = scene.showRainEffect == true
        if (!showRainEffect) mapRainEffect.clear()

        scene.fogIntensity?.let { fogIntensity = it.toFloat().coerceIn(0f, 1f) }
        scene.fogSize?.let { fogSize = it.toFloat().coerceIn(0.08f, 2.5f) }
        showFogEffect = scene.showFogEffect == true
        if (!showFogEffect) mapFogEffect.clear()

        scene.motesIntensity?.let { motesIntensity = it.toFloat().coerceIn(0f, 1f) }
        scene.motesSize?.let { motesSize = it.toFloat().coerceIn(0.08f, 2.5f) }
        showMotesEffect = scene.showMotesEffect == true
        if (!showMotesEffect) mapMotesEffect.clear()

        scene.cloudShadowIntensity?.let { cloudShadowIntensity = it.toFloat().coerceIn(0f, 1f) }
        scene.cloudShadowSize?.let { cloudShadowSize = it.toFloat().coerceIn(0.08f, 2.5f) }
        showCloudShadows = scene.showCloudShadows == true
        if (!showCloudShadows) mapCloudShadowEffect.clear()

        scene.leavesIntensity?.let { leavesIntensity = it.toFloat().coerceIn(0f, 1f) }
        scene.leavesSize?.let { leavesSize = it.toFloat().coerceIn(0.08f, 2.5f) }
        showLeavesEffect = scene.showLeavesEffect == true
        if (!showLeavesEffect) mapLeavesEffect.clear()

        showLightningEffect = scene.showLightningEffect == true
        mapLightningEffect.setEnabled(showLightningEffect)
        if (!showLightningEffect) mapLightningEffect.clear()

        scene.nightMistIntensity?.let { nightMistIntensity = it.toFloat().coerceIn(0f, 1f) }
        showNightMistEffect = scene.showNightMistEffect == true
        if (!showNightMistEffect) mapNightMistEffect.clear()

        val contains = getRainContainsPoint()
        mapRainEffect.setContainsPoint(contains)
        mapFogEffect.setContainsPoint(contains)
        mapMotesEffect.setContainsPoint(contains)
        mapCloudShadowEffect.setContainsPoint(contains)
        mapLeavesEffect.setContainsPoint(contains)
        mapNightMistEffect.setContainsPoint(contains)
        updateSceneAnimationLoop()
        invalidate()
    }

    /** Contenido visual publicado (suelo + árboles) — solo lectura visitante. */
    fun setPublishedMapVisuals(
        showGroundTextures: Boolean,
        showPublishedTrees: Boolean,
        groundStyle: Map<Int, ZoneGroundStyleData>,
        groundSettings: GroundMapSettingsData?,
        ambientTrees: List<AmbientTreeSlotData>,
        treesSizeMul: Float,
    ) {
        this.showGroundTextures = showGroundTextures
        this.showPublishedTrees = showPublishedTrees
        this.publishedGroundStyle = groundStyle
        this.publishedGroundSettings = groundSettings
        this.publishedTrees = ambientTrees
        this.publishedTreesSizeMul = treesSizeMul.coerceIn(0.08f, 2.5f)
        invalidate()
    }

    private fun getPublishedGroundViewport(w: Float, h: Float): MapGroundRenderer.Viewport {
        val pts = parkBoundary.map { geoToCanvas(GeoPoint(it.lat, it.lng)) }
        var minX = 0f
        var maxX = w
        var minY = 0f
        var maxY = h
        if (pts.isNotEmpty()) {
            minX = pts.minOf { it.x } - 80f
            maxX = pts.maxOf { it.x } + 80f
            minY = pts.minOf { it.y } - 80f
            maxY = pts.maxOf { it.y } + 80f
        }
        return MapGroundRenderer.Viewport(minX, minY, maxX, maxY)
    }

    private fun drawPublishedGround(canvas: Canvas, w: Float, h: Float, vp: MapGroundRenderer.Viewport) {
        MapGroundRenderer.drawMapBackdrop(
            canvas, w, h, isDarkTheme, scale,
            publishedGroundStyle, publishedGroundSettings, vp,
        )
        val boundaryPts = parkBoundary.map { geoToCanvas(GeoPoint(it.lat, it.lng)) }
        if (boundaryPts.size >= 3) {
            MapGroundRenderer.drawPolygonLayer(
                canvas, boundaryPts, -1, isDarkTheme, scale,
                publishedGroundStyle, publishedGroundSettings, vp,
            )
        }
        for ((index, section) in parkSections.withIndex()) {
            if (section.polygon.size < 3) continue
            val pts = section.polygon.map { geoToCanvas(GeoPoint(it.lat, it.lng)) }
            MapGroundRenderer.drawPolygonLayer(
                canvas, pts, index, isDarkTheme, scale,
                publishedGroundStyle, publishedGroundSettings, vp,
            )
        }
    }

    private fun drawPublishedBackdropAndBaseTrees(canvas: Canvas, vp: MapGroundRenderer.Viewport) {
        val treeVp = MapTreesRenderer.Viewport(vp.minX, vp.minY, vp.maxX, vp.maxY)
        val geoFn: (GeoPoint) -> ScreenPoint = { geoToCanvas(it) }
        MapTreesRenderer.drawBackdrop(
            canvas, publishedTrees, geoFn, parkBoundary, isDarkTheme, publishedTreesSizeMul, treeVp,
        )
        MapTreesRenderer.drawBasePark(
            canvas, publishedTrees, geoFn, parkBoundary, isDarkTheme, publishedTreesSizeMul, treeVp,
        )
    }

    private fun drawPublishedZoneTrees(canvas: Canvas, vp: MapGroundRenderer.Viewport) {
        val sectionPolygons = parkSections.map { it.polygon }
        val treeVp = MapTreesRenderer.Viewport(vp.minX, vp.minY, vp.maxX, vp.maxY)
        MapTreesRenderer.drawWorld(
            canvas,
            publishedTrees,
            { geoToCanvas(it) },
            sectionPolygons,
            parkBoundary,
            isDarkTheme,
            publishedTreesSizeMul,
            treeVp,
        )
    }
}
