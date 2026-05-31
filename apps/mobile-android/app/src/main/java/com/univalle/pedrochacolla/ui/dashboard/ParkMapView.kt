package com.univalle.pedrochacolla.ui.dashboard

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
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
        val polygon: List<GeoPoint>
    )

    // Listener para clicks en marcadores
    interface OnMarkerClickListener {
        fun onMarkerClick(marker: MapMarker)
    }

    // Listener para clicks en POI del overlay
    interface OnPoiClickListener {
        fun onPoiClick(poi: PoiItem)
    }

    // Constantes geodésicas (centradas en La Paz, Bolivia)
    companion object {
        private const val LAT_CENTER = -16.48933421
        private const val LNG_CENTER = -68.14573989
        private const val METERS_PER_DEG_LAT = 111320.0
        private val LAT_CORRECTION = cos(LAT_CENTER * Math.PI / 180)
        private val METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * LAT_CORRECTION

        // Polígono del parque con alta precisión (100+ puntos)
        private val PARK_BOUNDARY = listOf(
            // Entrada norte
            GeoPoint(-16.48659768, -68.14596329),
            GeoPoint(-16.48665000, -68.14593000),
            GeoPoint(-16.48680000, -68.14585000),
            GeoPoint(-16.48700000, -68.14575000),
            GeoPoint(-16.48720000, -68.14567000),
            GeoPoint(-16.48740000, -68.14560000),
            GeoPoint(-16.48760000, -68.14554000),
            GeoPoint(-16.48780000, -68.14549000),
            GeoPoint(-16.48800000, -68.14545000),
            GeoPoint(-16.48822963, -68.14541751),
            GeoPoint(-16.48832000, -68.14535000),
            GeoPoint(-16.48841898, -68.14528839),
            GeoPoint(-16.48855000, -68.14523000),
            GeoPoint(-16.48870000, -68.14518000),
            GeoPoint(-16.48886235, -68.14515052),
            GeoPoint(-16.48888001, -68.14519958),
            GeoPoint(-16.48900000, -68.14510000),
            GeoPoint(-16.48920000, -68.14502000),
            GeoPoint(-16.48940000, -68.14495000),
            GeoPoint(-16.48960000, -68.14488000),
            GeoPoint(-16.48980000, -68.14481000),
            GeoPoint(-16.49000000, -68.14475000),
            GeoPoint(-16.49020000, -68.14469000),
            GeoPoint(-16.49040000, -68.14465000),
            GeoPoint(-16.49055000, -68.14463000),
            GeoPoint(-16.49068582, -68.14462362),
            GeoPoint(-16.49070782, -68.14472540),
            GeoPoint(-16.49074000, -68.14480000),
            GeoPoint(-16.49078941, -68.14487740),
            GeoPoint(-16.49082000, -68.14491000),
            GeoPoint(-16.49086051, -68.14496028),
            GeoPoint(-16.49092000, -68.14500000),
            GeoPoint(-16.49099475, -68.14505184),
            GeoPoint(-16.49105000, -68.14508000),
            GeoPoint(-16.49110403, -68.14510370),
            GeoPoint(-16.49115000, -68.14511500),
            GeoPoint(-16.49120474, -68.14512204),
            GeoPoint(-16.49127000, -68.14513000),
            GeoPoint(-16.49133294, -68.14513233),
            GeoPoint(-16.49138000, -68.14513000),
            GeoPoint(-16.49142827, -68.14512204),
            GeoPoint(-16.49149000, -68.14510500),
            GeoPoint(-16.49156435, -68.14508133),
            GeoPoint(-16.49161000, -68.14506000),
            GeoPoint(-16.49166074, -68.14502906),
            GeoPoint(-16.49171000, -68.14498000),
            GeoPoint(-16.49176942, -68.14491858),
            // Curva sureste
            GeoPoint(-16.49185000, -68.14500000),
            GeoPoint(-16.49195000, -68.14510000),
            GeoPoint(-16.49207074, -68.14524457),
            GeoPoint(-16.49202000, -68.14524500),
            GeoPoint(-16.49197133, -68.14524635),
            GeoPoint(-16.49185000, -68.14528000),
            GeoPoint(-16.49170000, -68.14532000),
            GeoPoint(-16.49155000, -68.14535000),
            GeoPoint(-16.49139718, -68.14538138),
            GeoPoint(-16.49125000, -68.14540000),
            GeoPoint(-16.49110000, -68.14541500),
            GeoPoint(-16.49095112, -68.14542437),
            GeoPoint(-16.49080000, -68.14544000),
            GeoPoint(-16.49065000, -68.14546000),
            GeoPoint(-16.49050000, -68.14548000),
            GeoPoint(-16.49033610, -68.14550804),
            GeoPoint(-16.49027000, -68.14557000),
            GeoPoint(-16.49022058, -68.14564895),
            GeoPoint(-16.49000000, -68.14562000),
            GeoPoint(-16.48975000, -68.14559000),
            GeoPoint(-16.48950180, -68.14556667),
            GeoPoint(-16.48938000, -68.14557500),
            GeoPoint(-16.48926133, -68.14558171),
            GeoPoint(-16.48918000, -68.14557800),
            GeoPoint(-16.48910599, -68.14557360),
            GeoPoint(-16.48912299, -68.14561761),
            GeoPoint(-16.48904000, -68.14560500),
            GeoPoint(-16.48896332, -68.14559755),
            GeoPoint(-16.48886000, -68.14560500),
            GeoPoint(-16.48876984, -68.14561738),
            GeoPoint(-16.48865000, -68.14565000),
            GeoPoint(-16.48855000, -68.14569000),
            GeoPoint(-16.48844095, -68.14573936),
            // Lado oeste
            GeoPoint(-16.48849000, -68.14590000),
            GeoPoint(-16.48854573, -68.14608713),
            GeoPoint(-16.48860000, -68.14607000),
            GeoPoint(-16.48866891, -68.14604836),
            GeoPoint(-16.48869000, -68.14620000),
            GeoPoint(-16.48871507, -68.14636503),
            GeoPoint(-16.48860000, -68.14645000),
            GeoPoint(-16.48845000, -68.14658000),
            GeoPoint(-16.48830000, -68.14668000),
            GeoPoint(-16.48820410, -68.14673619),
            GeoPoint(-16.48812000, -68.14677000),
            GeoPoint(-16.48803366, -68.14679585),
            GeoPoint(-16.48790000, -68.14683000),
            GeoPoint(-16.48776299, -68.14685615),
            GeoPoint(-16.48762000, -68.14684000),
            GeoPoint(-16.48748103, -68.14680104),
            GeoPoint(-16.48746000, -68.14674000),
            GeoPoint(-16.48744563, -68.14667352),
            GeoPoint(-16.48742500, -68.14664000),
            GeoPoint(-16.48740845, -68.14661360),
            GeoPoint(-16.48737000, -68.14657000),
            GeoPoint(-16.48734035, -68.14654090),
            // Regreso al norte
            GeoPoint(-16.48728000, -68.14635000),
            GeoPoint(-16.48722000, -68.14615000),
            GeoPoint(-16.48714337, -68.14591061),
            GeoPoint(-16.48700000, -68.14595000),
            GeoPoint(-16.48685000, -68.14600000),
            GeoPoint(-16.48671717, -68.14603711),
            GeoPoint(-16.48668000, -68.14602500),
            GeoPoint(-16.48664566, -68.14600784),
            GeoPoint(-16.48662000, -68.14598500),
            GeoPoint(-16.48659707, -68.14596340),
            GeoPoint(-16.48659768, -68.14596329)
        )

        // Secciones del parque - tessellating polygons covering full park area
        // Junction points on boundary: B15, B25, B62, B72, B104
        // Divider TA-ML: B15 → internal → B104 (separates Tierras Altas from Mitos y Leyendas)
        // Divider TM-ML: B15 → B72 (separates Tierras Medias from Mitos y Leyendas)
        // Divider TM-TB: B25 → B62 (separates Tierras Medias from Tierras Bajas)
        private val PARK_SECTIONS = listOf(
            ParkSection(
                name = "Tierras Altas",
                color = Color.argb(90, 56, 142, 60),   // verde bosque intenso
                colorLight = Color.argb(70, 56, 142, 60),
                polygon = listOf(
                    // N boundary: entrance (B0) → NE (B15)
                    GeoPoint(-16.48659768, -68.14596329),
                    GeoPoint(-16.48665000, -68.14593000),
                    GeoPoint(-16.48680000, -68.14585000),
                    GeoPoint(-16.48700000, -68.14575000),
                    GeoPoint(-16.48720000, -68.14567000),
                    GeoPoint(-16.48740000, -68.14560000),
                    GeoPoint(-16.48760000, -68.14554000),
                    GeoPoint(-16.48780000, -68.14549000),
                    GeoPoint(-16.48800000, -68.14545000),
                    GeoPoint(-16.48822963, -68.14541751),
                    GeoPoint(-16.48832000, -68.14535000),
                    GeoPoint(-16.48841898, -68.14528839),
                    GeoPoint(-16.48855000, -68.14523000),
                    GeoPoint(-16.48870000, -68.14518000),
                    GeoPoint(-16.48886235, -68.14515052),
                    GeoPoint(-16.48888001, -68.14519958),
                    // Divider TA-ML: B15 → internal → B104
                    GeoPoint(-16.48870000, -68.14560000),
                    GeoPoint(-16.48820000, -68.14570000),
                    GeoPoint(-16.48760000, -68.14580000),
                    GeoPoint(-16.48714337, -68.14591061),
                    // NW boundary: B104 → entrance (B0)
                    GeoPoint(-16.48700000, -68.14595000),
                    GeoPoint(-16.48685000, -68.14600000),
                    GeoPoint(-16.48671717, -68.14603711),
                    GeoPoint(-16.48668000, -68.14602500),
                    GeoPoint(-16.48664566, -68.14600784),
                    GeoPoint(-16.48662000, -68.14598500),
                    GeoPoint(-16.48659707, -68.14596340)
                )
            ),
            ParkSection(
                name = "Tierras Medias",
                color = Color.argb(80, 158, 158, 158), // gris medio
                colorLight = Color.argb(60, 158, 158, 158),
                polygon = listOf(
                    // NE boundary: B15 → B25
                    GeoPoint(-16.48888001, -68.14519958),
                    GeoPoint(-16.48900000, -68.14510000),
                    GeoPoint(-16.48920000, -68.14502000),
                    GeoPoint(-16.48940000, -68.14495000),
                    GeoPoint(-16.48960000, -68.14488000),
                    GeoPoint(-16.48980000, -68.14481000),
                    GeoPoint(-16.49000000, -68.14475000),
                    GeoPoint(-16.49020000, -68.14469000),
                    GeoPoint(-16.49040000, -68.14465000),
                    GeoPoint(-16.49055000, -68.14463000),
                    GeoPoint(-16.49068582, -68.14462362),
                    // Divider TM-TB: B25 → B62
                    GeoPoint(-16.49033610, -68.14550804),
                    // S boundary: B62 → B72
                    GeoPoint(-16.49027000, -68.14557000),
                    GeoPoint(-16.49022058, -68.14564895),
                    GeoPoint(-16.49000000, -68.14562000),
                    GeoPoint(-16.48975000, -68.14559000),
                    GeoPoint(-16.48950180, -68.14556667),
                    GeoPoint(-16.48938000, -68.14557500),
                    GeoPoint(-16.48926133, -68.14558171),
                    GeoPoint(-16.48918000, -68.14557800),
                    GeoPoint(-16.48910599, -68.14557360),
                    GeoPoint(-16.48912299, -68.14561761),
                    // Divider TM-ML: B72 → B15
                    GeoPoint(-16.48888001, -68.14519958)
                )
            ),
            ParkSection(
                name = "Tierras Bajas",
                color = Color.argb(80, 255, 152, 0),   // naranja intenso
                colorLight = Color.argb(60, 255, 152, 0),
                polygon = listOf(
                    // SE peninsula: B25 → around tip → B62
                    GeoPoint(-16.49068582, -68.14462362),
                    GeoPoint(-16.49070782, -68.14472540),
                    GeoPoint(-16.49074000, -68.14480000),
                    GeoPoint(-16.49078941, -68.14487740),
                    GeoPoint(-16.49082000, -68.14491000),
                    GeoPoint(-16.49086051, -68.14496028),
                    GeoPoint(-16.49092000, -68.14500000),
                    GeoPoint(-16.49099475, -68.14505184),
                    GeoPoint(-16.49105000, -68.14508000),
                    GeoPoint(-16.49110403, -68.14510370),
                    GeoPoint(-16.49115000, -68.14511500),
                    GeoPoint(-16.49120474, -68.14512204),
                    GeoPoint(-16.49127000, -68.14513000),
                    GeoPoint(-16.49133294, -68.14513233),
                    GeoPoint(-16.49138000, -68.14513000),
                    GeoPoint(-16.49142827, -68.14512204),
                    GeoPoint(-16.49149000, -68.14510500),
                    GeoPoint(-16.49156435, -68.14508133),
                    GeoPoint(-16.49161000, -68.14506000),
                    GeoPoint(-16.49166074, -68.14502906),
                    GeoPoint(-16.49171000, -68.14498000),
                    GeoPoint(-16.49176942, -68.14491858),
                    GeoPoint(-16.49185000, -68.14500000),
                    GeoPoint(-16.49195000, -68.14510000),
                    GeoPoint(-16.49207074, -68.14524457),
                    GeoPoint(-16.49202000, -68.14524500),
                    GeoPoint(-16.49197133, -68.14524635),
                    GeoPoint(-16.49185000, -68.14528000),
                    GeoPoint(-16.49170000, -68.14532000),
                    GeoPoint(-16.49155000, -68.14535000),
                    GeoPoint(-16.49139718, -68.14538138),
                    GeoPoint(-16.49125000, -68.14540000),
                    GeoPoint(-16.49110000, -68.14541500),
                    GeoPoint(-16.49095112, -68.14542437),
                    GeoPoint(-16.49080000, -68.14544000),
                    GeoPoint(-16.49065000, -68.14546000),
                    GeoPoint(-16.49050000, -68.14548000),
                    GeoPoint(-16.49033610, -68.14550804),
                    // Divider TM-TB: B62 → B25
                    GeoPoint(-16.49068582, -68.14462362)
                )
            ),
            ParkSection(
                name = "Mitos y Leyendas",
                color = Color.argb(90, 88, 189, 94),   // verde tropical intenso
                colorLight = Color.argb(70, 88, 189, 94),
                polygon = listOf(
                    // Divider TM-ML: B72 → B15
                    GeoPoint(-16.48912299, -68.14561761),
                    GeoPoint(-16.48888001, -68.14519958),
                    // Divider TA-ML reversed: B15 → internal → B104
                    GeoPoint(-16.48870000, -68.14560000),
                    GeoPoint(-16.48820000, -68.14570000),
                    GeoPoint(-16.48760000, -68.14580000),
                    GeoPoint(-16.48714337, -68.14591061),
                    // W boundary: B104 → SW arm → B72
                    GeoPoint(-16.48722000, -68.14615000),
                    GeoPoint(-16.48728000, -68.14635000),
                    GeoPoint(-16.48734035, -68.14654090),
                    GeoPoint(-16.48737000, -68.14657000),
                    GeoPoint(-16.48740845, -68.14661360),
                    GeoPoint(-16.48742500, -68.14664000),
                    GeoPoint(-16.48744563, -68.14667352),
                    GeoPoint(-16.48746000, -68.14674000),
                    GeoPoint(-16.48748103, -68.14680104),
                    GeoPoint(-16.48762000, -68.14684000),
                    GeoPoint(-16.48776299, -68.14685615),
                    GeoPoint(-16.48790000, -68.14683000),
                    GeoPoint(-16.48803366, -68.14679585),
                    GeoPoint(-16.48812000, -68.14677000),
                    GeoPoint(-16.48820410, -68.14673619),
                    GeoPoint(-16.48830000, -68.14668000),
                    GeoPoint(-16.48845000, -68.14658000),
                    GeoPoint(-16.48860000, -68.14645000),
                    GeoPoint(-16.48871507, -68.14636503),
                    GeoPoint(-16.48869000, -68.14620000),
                    GeoPoint(-16.48866891, -68.14604836),
                    GeoPoint(-16.48860000, -68.14607000),
                    GeoPoint(-16.48854573, -68.14608713),
                    GeoPoint(-16.48849000, -68.14590000),
                    GeoPoint(-16.48844095, -68.14573936),
                    GeoPoint(-16.48855000, -68.14569000),
                    GeoPoint(-16.48865000, -68.14565000),
                    GeoPoint(-16.48876984, -68.14561738),
                    GeoPoint(-16.48886000, -68.14560500),
                    GeoPoint(-16.48896332, -68.14559755),
                    GeoPoint(-16.48904000, -68.14560500),
                    GeoPoint(-16.48912299, -68.14561761)
                )
            )
        )


        // Marker size constants
        const val MARKER_RADIUS = 34f
        const val MARKER_INNER_RADIUS = 11f
        const val MARKER_WARNING_RADIUS = 56f
        /** Radius of the circular icon drawn in Modo Explorador (screen-size-invariant). */
        const val MARKER_ICON_RADIUS = 52f
    }

    // Colores de tema
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
    var showLabels = true
    var showBoundary = true

    /** When false, the scale bar at the bottom-right is hidden */
    var showScaleBar = true

    /** When false, ALL 2D drawing is skipped — only the transparent punch-through remains */
    var show2DOverlay = true

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
    private val bounds = calculateBounds(PARK_BOUNDARY, 0.00035)

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
            val computedScale = (scaleBarWidth * boundsWidth * METERS_PER_DEG_LNG) / (w * targetScaleBarMeters)
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
        if (polygon.isEmpty()) {
            // Default bounds centered at park center if polygon is empty
            return Bounds(
                minLat = LAT_CENTER - 0.002,
                maxLat = LAT_CENTER + 0.002,
                minLng = LNG_CENTER - 0.002,
                maxLng = LNG_CENTER + 0.002
            )
        }
        val lats = polygon.map { it.lat }
        val lngs = polygon.map { it.lng }
        return Bounds(
            minLat = (lats.minOrNull() ?: LAT_CENTER) - padding,
            maxLat = (lats.maxOrNull() ?: LAT_CENTER) + padding,
            minLng = (lngs.minOrNull() ?: LNG_CENTER) - padding,
            maxLng = (lngs.maxOrNull() ?: LNG_CENTER) + padding
        )
    }

    /** Clamp pan offsets so the park stays within the visible viewport. */
    private fun clampOffsets() {
        if (isAdminMode) return  // Admin: free pan beyond park limits
        if (width == 0 || height == 0) return
        if (PARK_BOUNDARY.isEmpty()) return

        val cx = width / 2f
        val cy = height / 2f
        val cosr = cos(rotation.toDouble()).toFloat()
        val sinr = sin(rotation.toDouble()).toFloat()

        var minX = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY

        for (p in PARK_BOUNDARY) {
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

    // Verificar si un punto está dentro del polígono
    private fun isPointInPolygon(point: GeoPoint, polygon: List<GeoPoint>): Boolean {
        var inside = false
        var j = polygon.size - 1
        for (i in polygon.indices) {
            val xi = polygon[i].lng
            val yi = polygon[i].lat
            val xj = polygon[j].lng
            val yj = polygon[j].lat

            if (((yi > point.lat) != (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
                inside = !inside
            }
            j = i
        }
        return inside
    }

    // Conversión de coordenadas geo a canvas (sin transformaciones)
    private fun geoToCanvas(geo: GeoPoint): ScreenPoint {
        val w = width.toFloat()
        val h = height.toFloat()

        val geoW = bounds.maxLng - bounds.minLng
        val geoH = bounds.maxLat - bounds.minLat
        val latCorrectionFactor = LAT_CORRECTION.toFloat()
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
        val latCorrectionFactor = LAT_CORRECTION.toFloat()
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

        // Dibujar capas (el orden importa)
        if (showGrid) drawGrid(canvas)
        if (showSections) drawSections(canvas)
        if (showBoundary) drawBoundary(canvas)
        drawMarkerDots(canvas)

        canvas.restore()

        // Dibujar labels sin rotación
        if (showLabels) drawMarkerLabels(canvas)
        if (showScaleBar) drawScale(canvas)

        // Draw POI overlay (without map rotation, uses geoToScreen which already handles transforms)
        poiOverlayManager?.drawOverlay(canvas, ::geoToScreenPublic, scale)

        // Draw sticker overlay (only non-tree stickers follow map rotation)
        stickerOverlayManager?.drawOverlay(canvas, ::geoToScreenPublic, scale, rotation)

        // Draw rotation degree indicator
        drawRotationIndicator(canvas)

        // ⚠️ User location + navigation drawn LAST so they are ALWAYS on top of every other layer
        if (isNavigating) drawNavigationArrow(canvas)
        drawUserLocation(canvas)
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
        for (section in PARK_SECTIONS) {
            if (section.polygon.size < 3) continue

            val path = Path()
            val firstPoint = geoToCanvas(section.polygon[0])
            path.moveTo(firstPoint.x, firstPoint.y)

            for (i in 1 until section.polygon.size) {
                val p = geoToCanvas(section.polygon[i])
                path.lineTo(p.x, p.y)
            }
            path.close()

            sectionPaint.color = if (isDarkTheme) section.color else section.colorLight
            canvas.drawPath(path, sectionPaint)
        }
    }

    private fun drawBoundary(canvas: Canvas) {
        if (PARK_BOUNDARY.size < 3) return

        val path = Path()
        val firstPoint = geoToCanvas(PARK_BOUNDARY[0])
        path.moveTo(firstPoint.x, firstPoint.y)

        for (i in 1 until PARK_BOUNDARY.size) {
            val p = geoToCanvas(PARK_BOUNDARY[i])
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
        for (p in PARK_BOUNDARY) {
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
            val screenPos = geoToScreen(marker.geo)

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
        val metersPerPixel = degreesPerPixel * METERS_PER_DEG_LNG
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
                isInside = isPointInPolygon(geo, PARK_BOUNDARY)
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
            val computedScale = (scaleBarWidth * boundsWidth * METERS_PER_DEG_LNG) / (width * targetScaleBarMeters)
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

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        locationAnimator?.cancel()
        headingAnimator?.cancel()
        pulseAnimator?.cancel()
        userSonarAnimator?.cancel()
    }

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
}
