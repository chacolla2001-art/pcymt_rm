package com.univalle.pedrochacolla.ui.dashboard

import android.content.Context
import android.view.View
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.google.android.filament.Camera as FilamentCamera
import com.google.android.filament.LightManager
import com.google.android.filament.Skybox
import io.github.sceneview.SceneView
import io.github.sceneview.node.LightNode
import io.github.sceneview.math.Direction
import io.github.sceneview.math.Position
import io.github.sceneview.math.Position2
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node
import io.github.sceneview.node.ShapeNode
import kotlinx.coroutines.launch
import timber.log.Timber
import com.univalle.pedrochacolla.data.model.Model3DPlacementData
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

/**
 * Manages the 3D scene layer that renders behind the transparent 2D ParkMapView.
 *
 * Creates a 3D ground plane from the park boundary polygon and places
 * low-poly GLB models (trees, fences, hedges, rocks, etc.) on top.
 *
 * The 3D camera syncs with ParkMapView's (scale, rotation, offset) transform
 * so both layers move together when the user pans, zooms, or rotates.
 *
 * Supports two view modes:
 * - MODE_3D (default): Orthographic top-down with optional camera tilt,
 *   2D rotation disabled. User can tilt the camera to get a 3D perspective.
 * - MODE_2D: Orthographic top-down, rotation enabled in ParkMapView, no tilt.
 *
 * Also supports day/night theming and 3D animal markers for found/not-found.
 */
class ParkMap3DManager(
    private val sceneView: SceneView,
    private val context: Context
) {
    companion object {
        private const val TAG = "ParkMap3DManager"

        // Park center — MUST match ParkMapView.LAT_CENTER / LNG_CENTER exactly
        private const val LAT_CENTER = -16.48933421
        private const val LNG_CENTER = -68.14573989
        private val LAT_CORRECTION = cos(LAT_CENTER * Math.PI / 180.0)

        // Scale: convert geo degrees → 3D scene units
        private const val SCENE_SCALE = 10000.0

        // Constant camera height for ortho (doesn't affect projection size, just near/far)
        private const val CAM_HEIGHT = 100f

        // Tilt constraints (degrees from vertical)
        private const val MIN_TILT = 0f    // straight down (top-down view)
        private const val MAX_TILT = 60f   // 60° from vertical (near horizontal)
    }

    /** View mode: 2D (rotation enabled, flat) or 3D (tilt enabled, perspective feel) */
    enum class ViewMode { MODE_2D, MODE_3D }

    /** All placed 3D nodes (decorative models) */
    private val modelNodes = mutableListOf<Node>()
    /** Animal marker nodes (found/not-found indicators) */
    private val markerNodes = mutableListOf<Node>()
    /** The ground plane mesh */
    private var groundPlaneNode: ShapeNode? = null
    /** Single parent node holding ground + models so they rotate as one unit */
    private var worldNode: Node? = null
    private var isInitialized = false
    private var lifecycleOwner: LifecycleOwner? = null

    // Current view mode
    var viewMode = ViewMode.MODE_2D
        private set

    // Camera tilt angle in degrees from vertical (0 = top-down, 60 = near horizontal)
    var cameraTilt = 0f
        private set

    // Day/night mode
    private var isDarkTheme = false

    /** Config-driven scenery placements (from admin frontend via MapConfiguration API).
     *  When non-null, replaces the hardcoded generatePlacements(). */
    private var configPlacements: List<Model3DPlacementData>? = null

    // Last-known camera params for re-sync after model loading
    private var lastScale = 1.2f
    private var lastRotation = 0f
    private var lastOffsetX = 0f
    private var lastOffsetY = 0f
    // View dimensions for pixel→3D offset conversion
    private var viewWidth = 0
    private var viewHeight = 0

    // Bounds matching ParkMapView (padding = 0.0002) — lazy to avoid init-order issue
    private val boundsMinLat by lazy { PARK_BOUNDARY.minOf { it.lat } - 0.0002 }
    private val boundsMaxLat by lazy { PARK_BOUNDARY.maxOf { it.lat } + 0.0002 }
    private val boundsMinLng by lazy { PARK_BOUNDARY.minOf { it.lng } - 0.0002 }
    private val boundsMaxLng by lazy { PARK_BOUNDARY.maxOf { it.lng } + 0.0002 }

    // Layout change listener to re-apply projection after SceneView resize
    private val layoutListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
        sceneView.post { applyProjection() }
    }

    // -----------------------------------------------------------
    // Model placement data
    // -----------------------------------------------------------

    private data class ModelPlacement(
        val assetPath: String,
        val lat: Double,
        val lng: Double,
        val scale: Float = 1.0f,
        val rotationY: Float = 0f
    )

    /** Data for a 3D animal marker */
    data class AnimalMarker3D(
        val id: String,
        val lat: Double,
        val lng: Double,
        val isFound: Boolean,
        val name: String = ""
    )

    // -----------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------

    fun initialize(lifecycleOwner: LifecycleOwner) {
        this.lifecycleOwner = lifecycleOwner
        Timber.d("$TAG: Starting initialization...")

        // Store view dimensions for offset conversion
        viewWidth = sceneView.width
        viewHeight = sceneView.height
        Timber.d("$TAG: View size: %dx%d", viewWidth, viewHeight)

        // Listen for layout changes to re-apply projection
        sceneView.addOnLayoutChangeListener(layoutListener)

        // 1. Bind lifecycle — starts Filament engine & render loop
        sceneView.lifecycle = lifecycleOwner.lifecycle
        Timber.d("$TAG: Lifecycle bound, engine=%s", sceneView.engine)

        // 2. Disable SceneView's built-in gesture handling
        //    (ParkMapView handles all gestures)
        sceneView.cameraManipulator = null
        sceneView.onGestureListener = null

        // 3. Set 3D scene background via Filament Skybox
        setupSceneBackground()

        // 4. Set up lighting
        setupLighting()

        // 5. Create world parent node — all 3D content goes here so they rotate together
        val wn = Node(sceneView.engine)
        sceneView.addChildNode(wn)
        worldNode = wn

        // 6. Create 3D ground plane matching the park boundary polygon
        createGroundPlane()

        isInitialized = true

        // 7. Set initial camera — centered on the park
        updateCamera(lastScale, lastRotation, lastOffsetX, lastOffsetY)
        Timber.d("$TAG: Initial camera set, centered on park")

        // 8. Load models asynchronously using lifecycle-aware scope
        lifecycleOwner.lifecycleScope.launch {
            placeAllModels()
            // Re-sync camera after models are placed
            updateCamera(lastScale, lastRotation, lastOffsetX, lastOffsetY)
            Timber.d("$TAG: All models placed, camera re-synced. Total nodes: %d", modelNodes.size)
        }

        Timber.d("$TAG: Initialization complete")
    }

    // -----------------------------------------------------------
    // View mode switching
    // -----------------------------------------------------------

    /**
     * Switch between 2D and 3D view modes.
     * Both modes support rotation. The only difference is tilt:
     * - 2D: top-down view (tilt = 0), no tilt capability.
     * - 3D: perspective view (tilt = 0–60°), user can tilt via slider.
     */
    fun setViewMode(mode: ViewMode) {
        viewMode = mode
        when (mode) {
            ViewMode.MODE_2D -> {
                cameraTilt = 0f
            }
            ViewMode.MODE_3D -> {
                if (cameraTilt < 5f) cameraTilt = 25f
            }
        }
        applyProjection()
        Timber.d("$TAG: View mode changed to $mode, tilt=$cameraTilt")
    }

    /**
     * Set camera tilt angle (only effective in 3D mode).
     * @param tiltDeg degrees from vertical (0 = top-down, 60 = near horizontal)
     */
    fun setCameraTilt(tiltDeg: Float) {
        cameraTilt = tiltDeg.coerceIn(MIN_TILT, MAX_TILT)
        applyProjection()
    }

    // -----------------------------------------------------------
    // Day/Night theme
    // -----------------------------------------------------------

    /**
     * Set day or night lighting/skybox.
     * @param isDark true for night mode, false for day mode
     */
    fun setDayNightMode(isDark: Boolean) {
        isDarkTheme = isDark
        if (!isInitialized) return
        setupSceneBackground()
        setupLighting()
        // Recreate ground plane with new color
        groundPlaneNode?.let { old ->
            worldNode?.removeChildNode(old)
            try { old.destroy() } catch (_: Exception) {}
        }
        groundPlaneNode = null
        createGroundPlane()
        // Re-create animal markers with updated colors
        recreateMarkers()
        applyProjection()
        Timber.d("$TAG: Day/night mode set to ${if (isDark) "night" else "day"}")
    }

    // -----------------------------------------------------------
    // Scene background (Filament skybox)
    // -----------------------------------------------------------

    private fun setupSceneBackground() {
        try {
            val color = if (isDarkTheme) {
                // Night: deep navy blue
                floatArrayOf(0.02f, 0.03f, 0.08f, 1.0f)
            } else {
                // Day: soft sky blue
                floatArrayOf(0.53f, 0.72f, 0.88f, 1.0f)
            }
            val skybox = Skybox.Builder()
                .color(color)
                .build(sceneView.engine)
            sceneView.scene.skybox = skybox
            Timber.d("$TAG: Skybox set (${if (isDarkTheme) "night" else "day"})")
        } catch (e: Exception) {
            Timber.w(e, "$TAG: Failed to set skybox")
        }
    }

    // -----------------------------------------------------------
    // Lighting — day: warm sun / night: cool moonlight
    // -----------------------------------------------------------

    private fun setupLighting() {
        try {
            if (isDarkTheme) {
                // Night: cool blue-white moonlight, bright enough to see details
                val moonLight = LightNode(
                    engine = sceneView.engine,
                    type = LightManager.Type.DIRECTIONAL,
                    apply = {
                        color(0.7f, 0.75f, 1.0f)
                        intensity(80_000f)
                        direction(0.2f, -1.0f, -0.3f)
                        castShadows(true)
                    }
                )
                sceneView.mainLightNode = moonLight

                sceneView.indirectLight?.let { ibl ->
                    ibl.intensity = 25_000f
                }
            } else {
                // Day: warm golden sunlight
                val sunLight = LightNode(
                    engine = sceneView.engine,
                    type = LightManager.Type.DIRECTIONAL,
                    apply = {
                        color(1.0f, 0.95f, 0.85f)
                        intensity(150_000f)
                        direction(-0.2f, -1.0f, -0.3f)
                        castShadows(true)
                    }
                )
                sceneView.mainLightNode = sunLight

                sceneView.indirectLight?.let { ibl ->
                    ibl.intensity = 50_000f
                }
            }
            Timber.d("$TAG: Lighting configured (${if (isDarkTheme) "moonlight" else "sunlight"})")
        } catch (e: Exception) {
            Timber.w(e, "$TAG: Failed to configure lighting")
        }
    }

    // -----------------------------------------------------------
    // 3D Ground plane — park boundary polygon as a flat mesh
    // -----------------------------------------------------------

    private fun createGroundPlane() {
        try {
            val polygonPoints = PARK_BOUNDARY.map { geo ->
                val pos = geoTo3D(geo.lat, geo.lng)
                Position2(pos.x, -pos.z)
            }

            // Natural ground color based on theme
            val groundColor = if (isDarkTheme) {
                // Night: dark grass green with slight blue tint
                android.graphics.Color.argb(255, 25, 50, 30)
            } else {
                // Day: natural grass green
                android.graphics.Color.argb(255, 76, 132, 60)
            }

            val groundMaterial = sceneView.materialLoader.createColorInstance(
                color = groundColor,
                metallic = 0.0f,
                roughness = 1.0f,
                reflectance = 0.0f
            )

            val shapeNode = ShapeNode(
                engine = sceneView.engine,
                polygonPath = polygonPoints,
                normal = Direction(z = 1.0f),
                materialInstance = groundMaterial,
                builderApply = {
                    castShadows(false)
                    receiveShadows(true)
                }
            ).apply {
                rotation = Rotation(x = -90f)
                position = Position(0f, -0.05f, 0f)
            }

            worldNode?.addChildNode(shapeNode) ?: sceneView.addChildNode(shapeNode)
            groundPlaneNode = shapeNode
            Timber.d("$TAG: Ground plane created with %d vertices", polygonPoints.size)
        } catch (e: Exception) {
            Timber.e(e, "$TAG: Failed to create ground plane")
        }
    }

    // -----------------------------------------------------------
    // 3D Animal markers (found / not-found)
    // -----------------------------------------------------------

    private var pendingMarkers: List<AnimalMarker3D> = emptyList()

    /**
     * Set 3D animal markers on the map.
     * Found animals show a green pillar with beacon, not-found show a red marker.
     */
    fun setAnimalMarkers(markers: List<AnimalMarker3D>) {
        pendingMarkers = markers
        if (!isInitialized) return
        recreateMarkers()
    }

    private fun recreateMarkers() {
        // Remove old marker nodes
        markerNodes.forEach { node ->
            worldNode?.removeChildNode(node)
            try { node.destroy() } catch (_: Exception) {}
        }
        markerNodes.clear()

        if (pendingMarkers.isEmpty()) return

        val lo = lifecycleOwner ?: return
        lo.lifecycleScope.launch {
            for (marker in pendingMarkers) {
                try {
                    createMarkerNode(marker)
                } catch (e: Exception) {
                    Timber.w(e, "$TAG: Failed to create marker for ${marker.name}")
                }
            }
            Timber.d("$TAG: Created %d animal markers", markerNodes.size)
        }
    }

    private suspend fun createMarkerNode(marker: AnimalMarker3D) {
        val pos = geoTo3D(marker.lat, marker.lng)

        if (marker.isFound) {
            // Found: load pillar-stone model as green marker
            val modelInstance = sceneView.modelLoader.loadModelInstance("map-models/pillar-stone.glb")
            if (modelInstance != null) {
                val node = ModelNode(
                    modelInstance = modelInstance,
                    autoAnimate = true,
                    scaleToUnits = 1.8f,
                    centerOrigin = Position(0f, -1.0f, 0f)
                ).apply {
                    isEditable = false
                    position = pos
                    rotation = Rotation(y = 0f)
                }
                worldNode?.addChildNode(node)
                markerNodes.add(node)

                // Add a green beacon disc on top
                val beaconMaterial = sceneView.materialLoader.createColorInstance(
                    color = android.graphics.Color.argb(255, 50, 220, 80),
                    metallic = 0.3f,
                    roughness = 0.2f,
                    reflectance = 0.8f
                )
                val beaconPoints = createCirclePolygon(0.3f, 12)
                val beaconNode = ShapeNode(
                    engine = sceneView.engine,
                    polygonPath = beaconPoints,
                    normal = Direction(z = 1.0f),
                    materialInstance = beaconMaterial,
                    builderApply = {
                        castShadows(false)
                        receiveShadows(false)
                    }
                ).apply {
                    rotation = Rotation(x = -90f)
                    position = Position(pos.x, 2.0f, pos.z)
                }
                worldNode?.addChildNode(beaconNode)
                markerNodes.add(beaconNode)
            }
        } else {
            // Not found: red marker (base disc + top disc)
            val markerColor = if (isDarkTheme) {
                android.graphics.Color.argb(255, 180, 60, 60)
            } else {
                android.graphics.Color.argb(255, 220, 50, 50)
            }

            val baseMaterial = sceneView.materialLoader.createColorInstance(
                color = markerColor,
                metallic = 0.1f,
                roughness = 0.6f,
                reflectance = 0.3f
            )
            val basePoints = createCirclePolygon(0.5f, 16)
            val baseNode = ShapeNode(
                engine = sceneView.engine,
                polygonPath = basePoints,
                normal = Direction(z = 1.0f),
                materialInstance = baseMaterial,
                builderApply = {
                    castShadows(false)
                    receiveShadows(false)
                }
            ).apply {
                rotation = Rotation(x = -90f)
                position = Position(pos.x, 0.1f, pos.z)
            }
            worldNode?.addChildNode(baseNode)
            markerNodes.add(baseNode)

            // Top indicator disc
            val topMaterial = sceneView.materialLoader.createColorInstance(
                color = markerColor,
                metallic = 0.0f,
                roughness = 0.8f,
                reflectance = 0.2f
            )
            val topPoints = createCirclePolygon(0.25f, 8)
            val topNode = ShapeNode(
                engine = sceneView.engine,
                polygonPath = topPoints,
                normal = Direction(z = 1.0f),
                materialInstance = topMaterial,
                builderApply = {
                    castShadows(false)
                    receiveShadows(false)
                }
            ).apply {
                rotation = Rotation(x = -90f)
                position = Position(pos.x, 1.5f, pos.z)
            }
            worldNode?.addChildNode(topNode)
            markerNodes.add(topNode)
        }
    }

    /** Create a circle polygon as a list of Position2 points */
    private fun createCirclePolygon(radius: Float, segments: Int): List<Position2> {
        return (0 until segments).map { i ->
            val angle = (2.0 * Math.PI * i / segments).toFloat()
            Position2(cos(angle) * radius, sin(angle) * radius)
        }
    }

    // -----------------------------------------------------------
    // Coordinate conversion  (geo → 3D scene)
    // -----------------------------------------------------------

    private fun geoTo3D(lat: Double, lng: Double): Position {
        val x = ((lng - LNG_CENTER) * LAT_CORRECTION * SCENE_SCALE).toFloat()
        val z = ((LAT_CENTER - lat) * SCENE_SCALE).toFloat()  // north = -Z
        return Position(x, 0f, z)
    }

    // -----------------------------------------------------------
    // Camera sync with ParkMapView
    // -----------------------------------------------------------

    /**
     * Update 3D camera to match ParkMapView's current transform.
     */
    fun updateCamera(viewScale: Float, viewRotation: Float, viewOffsetX: Float, viewOffsetY: Float) {
        if (!isInitialized) return

        // Store for re-sync after model loading
        lastScale = viewScale
        lastRotation = viewRotation
        lastOffsetX = viewOffsetX
        lastOffsetY = viewOffsetY

        // Update view size if available
        if (sceneView.width > 0) viewWidth = sceneView.width
        if (sceneView.height > 0) viewHeight = sceneView.height

        applyProjection()
    }

    /**
     * Apply camera projection, supporting both ortho (top-down/2D) and
     * tilted ortho (3D mode with camera tilt).
     */
    private fun applyProjection() {
        val w = viewWidth.toFloat().coerceAtLeast(1f)
        val h = viewHeight.toFloat().coerceAtLeast(1f)

        // Replicate ParkMapView.geoToCanvas internal base scale 's'
        val geoW = boundsMaxLng - boundsMinLng
        val geoH = boundsMaxLat - boundsMinLat
        val correctedGeoW = (geoW * LAT_CORRECTION).toFloat()
        val scaleX = w / correctedGeoW
        val scaleY = h / geoH.toFloat()
        val s = min(scaleX, scaleY) * 0.9f

        val viewScale = lastScale.coerceAtLeast(0.3f)

        val unitsPerPixel = (SCENE_SCALE / (s * viewScale)).toFloat()

        // Ortho half-extents in 3D scene units
        val halfW = (w / 2f * unitsPerPixel).toDouble()
        val halfH = (h / 2f * unitsPerPixel).toDouble()

        // Convert pixel offset to 3D world offset
        val camX = -lastOffsetX * unitsPerPixel
        val camZ = -lastOffsetY * unitsPerPixel

        val camNode = sceneView.cameraNode

        // Apply tilt
        val tiltRad = Math.toRadians(cameraTilt.toDouble())
        val cameraDistance = CAM_HEIGHT.toDouble()

        if (cameraTilt < 1f) {
            // Pure top-down (ortho) — standard flat view
            try {
                camNode.setProjection(
                    FilamentCamera.Projection.ORTHO,
                    -halfW, halfW,
                    -halfH, halfH,
                    0.1, 500.0
                )
            } catch (e: Exception) {
                Timber.w(e, "$TAG: Failed to set ortho projection")
            }

            camNode.position = Position(camX, CAM_HEIGHT, camZ)
            camNode.rotation = Rotation(-90f, 0f, 0f)
        } else {
            // Tilted view — orbiting camera around the target point
            val camY = (cameraDistance * cos(tiltRad)).toFloat()
            val camZOffset = (cameraDistance * sin(tiltRad)).toFloat()

            // Adjust vertical extent by cos(tilt) to prevent stretching
            val adjustedHalfH = halfH / cos(tiltRad).coerceAtLeast(0.3)
            try {
                camNode.setProjection(
                    FilamentCamera.Projection.ORTHO,
                    -halfW, halfW,
                    -adjustedHalfH, adjustedHalfH,
                    0.1, 500.0
                )
            } catch (e: Exception) {
                Timber.w(e, "$TAG: Failed to set tilted ortho projection")
            }

            camNode.position = Position(camX, camY, camZ + camZOffset)
            // Look down at -tilt angle from vertical
            val pitchDeg = -(90f - cameraTilt)
            camNode.rotation = Rotation(pitchDeg, 0f, 0f)
        }

        // Rotate the entire world (ground + models) around the world center
        // Negate rotation: canvas clockwise (+) corresponds to 3D Y counter-clockwise (-)
        val rotDeg = lastRotation * 180f / Math.PI.toFloat()
        worldNode?.rotation = Rotation(0f, -rotDeg, 0f)
    }

    // -----------------------------------------------------------
    // Model placement
    // -----------------------------------------------------------

    private suspend fun placeAllModels() {
        val placements = configFromAdmin() ?: generatePlacements()
        Timber.d("$TAG: Loading %d model placements (config=%b)...", placements.size, configPlacements != null)

        var successCount = 0
        var failCount = 0

        for ((index, placement) in placements.withIndex()) {
            try {
                val modelInstance = sceneView.modelLoader.loadModelInstance(placement.assetPath)
                if (modelInstance != null) {
                    val node = ModelNode(
                        modelInstance = modelInstance,
                        autoAnimate = true,
                        scaleToUnits = placement.scale,
                        centerOrigin = Position(0f, -1.0f, 0f)
                    ).apply {
                        isEditable = false
                        position = geoTo3D(placement.lat, placement.lng)
                        rotation = Rotation(y = placement.rotationY)
                    }
                    worldNode?.addChildNode(node) ?: sceneView.addChildNode(node)
                    modelNodes.add(node)
                    successCount++
                } else {
                    failCount++
                    Timber.w("$TAG: [%d] loadModelInstance returned null for %s", index, placement.assetPath)
                }
            } catch (e: Exception) {
                failCount++
                Timber.e(e, "$TAG: [%d] Exception loading %s", index, placement.assetPath)
            }
        }

        Timber.d("$TAG: Model loading complete — %d succeeded, %d failed", successCount, failCount)
    }

    /**
     * Convert admin-configured placements to ModelPlacement list.
     * Returns null if no config data is available (falls back to generatePlacements).
     */
    private fun configFromAdmin(): List<ModelPlacement>? {
        val placements = configPlacements ?: return null
        if (placements.isEmpty()) return null

        return placements.mapNotNull { p ->
            val key = p.modelKey ?: return@mapNotNull null
            ModelPlacement(
                assetPath = "map-models/$key.glb",
                lat = p.lat ?: 0.0,
                lng = p.lng ?: 0.0,
                scale = p.scale ?: 1.0f,
                rotationY = p.rotationY ?: 0f
            )
        }
    }

    /**
     * Set scenery from admin-configured placements (from MapConfiguration API).
     * When called before initialize(), the config data is stored and used during init.
     * When called after initialize(), replaces existing models immediately.
     */
    fun setSceneryFromConfig(placements: List<Model3DPlacementData>?) {
        this.configPlacements = placements
        Timber.d("$TAG: setSceneryFromConfig — %d placements",
            placements?.size ?: 0)

        // If already initialized, reload models
        if (isInitialized) {
            // Remove existing model nodes
            for (node in modelNodes) {
                worldNode?.removeChildNode(node) ?: sceneView.removeChildNode(node)
                node.destroy()
            }
            modelNodes.clear()

            lifecycleOwner?.lifecycleScope?.launch {
                placeAllModels()
                updateCamera(lastScale, lastRotation, lastOffsetX, lastOffsetY)
                Timber.d("$TAG: Config-driven models reloaded. Total nodes: %d", modelNodes.size)
            }
        }
    }

    /**
     * Generate all model placements.
     * Returns an empty list — scenery models are now placed exclusively from the
     * admin frontend via MapConfiguration API (configFromAdmin).
     * The hardcoded forest/decoration placements have been removed.
     */
    private fun generatePlacements(): List<ModelPlacement> {
        Timber.d("$TAG: No config placements — returning empty list (models are managed from frontend)")
        return emptyList()
    }

    /**
     * Export current config placements for saving in MapConfigData.
     * Returns null if no placements are configured.
     */
    fun getPlacementsForConfig(): List<Model3DPlacementData>? {
        val placements = configPlacements
        return if (placements.isNullOrEmpty()) null else placements
    }

    // -----------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------

    fun destroy() {
        sceneView.removeOnLayoutChangeListener(layoutListener)

        // Remove worldNode (which holds ground + models) from sceneView
        worldNode?.let { wn ->
            try {
                sceneView.removeChildNode(wn)
                wn.destroy()
            } catch (_: Exception) { }
        }
        worldNode = null
        groundPlaneNode = null
        modelNodes.clear()
        markerNodes.clear()
        isInitialized = false
        lifecycleOwner = null
        Timber.d("$TAG: Destroyed")
    }

    // -----------------------------------------------------------
    // Park boundary polygon — EXACT COPY from ParkMapView.PARK_BOUNDARY
    // These coordinates MUST be identical in both files.
    // -----------------------------------------------------------

    private data class GeoPoint(val lat: Double, val lng: Double)

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
}
