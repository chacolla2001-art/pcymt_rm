package com.univalle.pedrochacolla.ui.dashboard

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.google.android.material.snackbar.Snackbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSnapHelper
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.transition.Transition
import com.google.android.gms.location.*
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.MapConfigData
import com.univalle.pedrochacolla.data.model.MapConfiguration
import com.univalle.pedrochacolla.data.model.PoiPositionSave
import com.univalle.pedrochacolla.data.repository.MapConfigurationRepository
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.location.GameReadinessChecker
import com.univalle.pedrochacolla.utils.location.GpsKalmanFilter
import com.univalle.pedrochacolla.utils.session.UserSession
import kotlinx.coroutines.launch

/**
 * Dashboard Fragment with custom ParkMapView (no Google Maps dependency)
 * Includes user location tracking, compass heading, and dotted-path navigation.
 */
class DashboardFragment : Fragment(), SensorEventListener {

    private val viewModel: MapViewModel by viewModels { MapViewModel.Factory() }

    private lateinit var parkMapView: ParkMapView
    private lateinit var carouselAdapter: IconCarouselAdapter
    private lateinit var poiOverlayManager: PoiOverlayManager
    private lateinit var stickerManager: StickerManager
    private lateinit var stickerOverlayManager: StickerOverlayManager
    private var selectedLocation: Location? = null
    private var selectedAnchorId: String? = null
    private var mapReady = false
    private var pendingState: MapUiState? = null
    private val locationMap = mutableMapOf<String, Location>()
    /** Prevents loading the public config more than once per fragment lifecycle */
    // globalConfigLoaded removed — config is now loaded directly from onViewCreated
    /** True after the map has been auto-centered on the user once */
    private var hasAutocentered = false
    // Location services
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    // GPS Kalman filter — smooths raw GPS readings with multi-fix accumulation,
    // heading-constrained velocity, and adaptive noise. Lower base processNoise
    // (0.30) with adaptive scaling gives tighter stationary lock and smoother walk.
    private val gpsKalmanFilter = GpsKalmanFilter(processNoiseMetersPerSecond = 0.30)

    // Reject GPS fixes with horizontal accuracy worse than this (metres)
    private val MAX_ACCEPTABLE_ACCURACY_M = 20f

    // ── Smooth rendering loop ──────────────────────────────────────
    // Instead of two competing callers (GPS callback + DR ticker) each
    // triggering animations on the dot, we use a SINGLE render loop.
    // GPS callbacks ONLY feed the Kalman filter. The render loop calls
    // predict() every tick and sets the dot position directly (no animation),
    // producing the same butter-smooth movement as Google Maps / Uber.
    private val renderHandler = Handler(Looper.getMainLooper())
    private var lastGpsFixMs = 0L
    private val RENDER_INTERVAL_MS = 16L  // ~60 fps
    private val renderRunnable: Runnable = object : Runnable {
        override fun run() {
            if (!gpsKalmanFilter.isInitialized) {
                renderHandler.postDelayed(this, RENDER_INTERVAL_MS)
                return
            }
            val now = System.currentTimeMillis()
            // Predict where the user is right now based on filter state
            val predicted = gpsKalmanFilter.predict(now)
            if (predicted != null) {
                // Direct set — no animation, the 60 fps cadence IS the smoothing
                parkMapView.setUserLocation(predicted.first, predicted.second, animDurationMs = 0L)
            }
            renderHandler.postDelayed(this, RENDER_INTERVAL_MS)
        }
    }

    // GPS loading state
    private var isWaitingForLocation = false
    private var gpsFab: com.google.android.material.floatingactionbutton.FloatingActionButton? = null
    private var gpsProgress: ProgressBar? = null

    // Compass sensors
    private lateinit var sensorManager: SensorManager
    // TYPE_ROTATION_VECTOR = hardware-fused (accel + gyro + mag) — same sensor
    // used by Google Maps. Dramatically better heading than raw accel+mag.
    private var rotationVectorSensor: Sensor? = null
    private var useRotationVector = false
    // Step detector sensor — feeds the Kalman filter to maintain velocity
    // between GPS fixes, giving smoother dead-reckoning on small-area maps.
    private var stepDetectorSensor: Sensor? = null

    // Fallback sensors (phones without gyroscope)
    private var accelerometerSensor: Sensor? = null
    private var magnetometerSensor: Sensor? = null
    private val gravity = FloatArray(3)
    private val geomagnetic = FloatArray(3)
    private var hasGravity = false
    private var hasMagnetic = false

    // Exponential moving average for compass heading.
    // At SENSOR_DELAY_FASTEST (~200 Hz) α=0.18 gives ~25 ms effective lag:
    // very responsive to turns (like Google Maps), with minimal jitter
    // thanks to the hardware-fused rotation vector sensor.
    private val COMPASS_EMA_ALPHA = 0.18f
    private var smoothedHeading = Float.NaN  // NaN = not initialised

    // Last GPS bearing + speed — used to blend GPS direction of travel
    // into the compass heading when the user is walking fast.
    private var lastGpsBearing = 0f
    private var lastGpsSpeed  = 0f

    // Flag to avoid showing the readiness dialog more than once per fragment lifecycle
    private var hasShownReadinessDialog = false

    // GPS settings resolution launcher
    private val gpsSettingsLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        // Re-check after user returns from GPS settings
        checkGameReadiness()
    }

    // Permission launcher
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            startLocationUpdates()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        selectedAnchorId = arguments?.getString("selectedAnchorId")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
        sensorManager = requireContext().getSystemService(Context.SENSOR_SERVICE) as SensorManager
        // Prefer TYPE_ROTATION_VECTOR (hardware-fused accel+gyro+mag).
        // Fall back to TYPE_GAME_ROTATION_VECTOR (gyro-only, no mag drift).
        // Only use raw accel+mag if gyroscope is absent (rare on modern phones).
        rotationVectorSensor =
            sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
                ?: sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        useRotationVector = rotationVectorSensor != null
        if (!useRotationVector) {
            accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            magnetometerSensor  = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        }
        // Step detector for Kalman velocity assist (available on most modern phones)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.fragment_dashboard, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Initialize ParkMapView
        parkMapView = view.findViewById(R.id.park_map_view)

        // Apply current theme to map
        val isDarkTheme = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        parkMapView.setDarkTheme(isDarkTheme)
        parkMapView.showBoundary = false
        parkMapView.showGrid = false
        parkMapView.showSections = true
        parkMapView.showLabels = false   // Only icons, no text labels
        parkMapView.show2DOverlay = true
        parkMapView.showBackgroundImage = true  // Illustrated park background

        // Map for viewing captured animals only — no click interaction
        parkMapView.setMarkerClickListener(null)

        // Initialize carousel
        val recyclerView = view.findViewById<RecyclerView>(R.id.icon_carousel)
        recyclerView.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        LinearSnapHelper().attachToRecyclerView(recyclerView)

        // Top card click to dismiss
        val topCard = view.findViewById<View>(R.id.top_card)
        topCard.setOnClickListener {
            topCard.animate()
                .translationY(-topCard.height.toFloat())
                .setDuration(300)
                .withEndAction { topCard.visibility = View.GONE }
                .start()
        }

        // Navigate button - starts dotted path navigation
        val navigateButton = view.findViewById<Button>(R.id.btn_navigate_to_anchor)
        navigateButton.setOnClickListener {
            handleNavigate()
        }

        // My location button
        gpsFab = view.findViewById(R.id.btn_my_location)
        gpsProgress = view.findViewById(R.id.progress_gps)
        gpsFab?.setOnClickListener {
            setGpsLoading(true)
            centerOnUserLocation()
        }

        // Zoom controls
        view.findViewById<View>(R.id.btn_zoom_in)?.setOnClickListener {
            parkMapView.zoomIn()
        }
        view.findViewById<View>(R.id.btn_zoom_out)?.setOnClickListener {
            parkMapView.zoomOut()
        }

        // Back navigation
        view.findViewById<View>(R.id.btn_back_home)?.setOnClickListener {
            findNavController().popBackStack()
        }

        // Play / Explorar button — carries user to the Explorer mode (ArMapFragment)
        view.findViewById<View>(R.id.btn_play_explorer)?.setOnClickListener {
            findNavController().navigate(R.id.navigation_ar_map)
        }

        // Cancel navigation button
        view.findViewById<View>(R.id.btn_cancel_navigation)?.setOnClickListener {
            cancelNavigation()
        }

        // POI Overlay — toggle button and manager
        poiOverlayManager = PoiOverlayManager(requireContext())
        parkMapView.poiOverlayManager = poiOverlayManager
        // Initialize POI metadata so the overlay has items to render/hit-test.
        // Positions are later overridden by `loadGlobalConfig()` via dynamic positions.
        poiOverlayManager.poiItems = createDefaultPoiItems()

        // Sticker overlay — renders stickers from saved config onto the map
        stickerManager = StickerManager(requireContext())
        stickerOverlayManager = StickerOverlayManager(stickerManager)
        parkMapView.stickerOverlayManager = stickerOverlayManager

        val btnTogglePoi = view.findViewById<com.google.android.material.floatingactionbutton.FloatingActionButton>(R.id.btn_toggle_poi)
        btnTogglePoi.setOnClickListener {
            val isVisible = poiOverlayManager.toggleOverlay()
            // Update FAB tint to indicate active state
            btnTogglePoi.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (isVisible) ContextCompat.getColor(requireContext(), com.google.android.material.R.color.design_default_color_primary)
                else 0xFFFFFFFF.toInt()
            )
            btnTogglePoi.imageTintList = android.content.res.ColorStateList.valueOf(
                if (isVisible) 0xFFFFFFFF.toInt() else 0xFF666666.toInt()
            )
            parkMapView.invalidate()
            val msg = if (isVisible) "Puntos de interés activados" else "Puntos de interés desactivados"
            Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
        }

        // POI click listener — show info toast
        parkMapView.poiClickListener = object : ParkMapView.OnPoiClickListener {
            override fun onPoiClick(poi: PoiItem) {
                Toast.makeText(requireContext(), "${poi.id}. ${poi.name}", Toast.LENGTH_SHORT).show()
            }
        }

        // Map layers FAB — save/load map configurations
        view.findViewById<View>(R.id.btn_map_layers)?.setOnClickListener {
            showMapLayerPanel()
        }

        // Coordinate inspector button — hidden in visitor mode (kept for admin toolbar)
        val btnCoordInspector = view.findViewById<com.google.android.material.floatingactionbutton.FloatingActionButton?>(R.id.btn_coord_inspector)
        btnCoordInspector?.visibility = View.GONE

        // Role-based button visibility
        val isAdmin = UserSession.currentUser?.role == "admin"
        parkMapView.isAdminMode = isAdmin
        if (!isAdmin) {
            btnTogglePoi.visibility = View.GONE
            view.findViewById<View>(R.id.btn_map_layers)?.visibility = View.GONE
        } else {
            // Admin banner: inform the user they are seeing ALL animals
            val adminBanner = view.findViewById<android.widget.TextView?>(R.id.banner_out_of_bounds)
            if (adminBanner != null) {
                adminBanner.text = "🔐 Modo Admin — Viendo todos los animales del parque"
                adminBanner.setBackgroundColor(android.graphics.Color.parseColor("#CC1565C0"))
                adminBanner.tag = "admin_mode"
                adminBanner.visibility = View.VISIBLE
            }
        }

        mapReady = true
        observeState()
        viewModel.loadMapData()

        // Load global map config (stickers, POI positions) from the backend.
        loadGlobalConfig()
    }

    /**
     * Delegates to companion factory so all fragments share the same POI definition.
     */
    private fun createDefaultPoiItems(): List<PoiItem> =
        PoiOverlayManager.createDefaultItems(resources, requireContext().packageName)

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    if (state.isLoading) return@collect

                    state.error?.let {
                        Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
                        return@collect
                    }

                    // Use allLocations (not just undiscovered `locations`) so markers
                    // render even when the user has already found all the animals.
                    if (state.allLocations.isNotEmpty()) {
                        renderMapData(state)
                    }
                }
            }
        }
    }

    private fun renderMapData(state: MapUiState) {
        val loading = LoadingDialogFragment.newInstance().also {
            it.show(parentFragmentManager, "loading")
        }

        try {
            locationMap.clear()
            state.allLocations.forEach { location ->
                location.id?.let { id -> locationMap[id] = location }
            }

            val isAdmin = UserSession.currentUser?.role == "admin"

            // Admin sees ALL animals; visitors see only captured ones
            val locationsToShow = if (isAdmin) {
                state.allLocations
            } else {
                state.allLocations.filter { state.interactedIds.contains(it.id) }
            }
            parkMapView.setLocations(locationsToShow)

            // Mark found/unfound state for each shown animal
            locationsToShow.forEach { loc ->
                val id = loc.id ?: return@forEach
                val found = state.interactedIds.contains(loc.id)
                parkMapView.setMarkerFound(id, found)
            }

            // Load icon bitmaps for all shown markers (admin: all; visitor: found only)
            loadMarkerIcons(state, locationsToShow)

            // Auto-select marker from navigation argument
            selectedAnchorId?.let { id ->
                onLocationSelected(id)
                parkMapView.centerOnMarker(id)
            }

            // Build carousel items from ALL locations (found + not found), mark captured ones
            val items = state.allLocations.mapNotNull { location ->
                location.virtualAssetId?.let { assetId ->
                    state.assetMap[assetId]?.let { asset ->
                        CarouselItem(
                            iconUrl   = ImageUrlHelper.buildUrl(asset.iconUrl ?: "") ?: "",
                            name      = asset.name ?: "",
                            latitude  = location.latitude,
                            longitude = location.longitude,
                            anchorId  = location.id ?: "",
                            isFound   = state.interactedIds.contains(location.id)
                        )
                    }
                }
            }

            // Setup carousel adapter — display-only, no click action
            val recyclerView = requireView().findViewById<RecyclerView>(R.id.icon_carousel)
            carouselAdapter = IconCarouselAdapter()
            recyclerView.adapter = carouselAdapter
            carouselAdapter.submitList(items)

            // Global config is loaded once from onViewCreated. No duplicate call needed here.

        } finally {
            loading.dismiss()
        }
    }

    /**
     * Loads each location's animal icon from the backend and passes it to [ParkMapView]
     * so circular icons replace the default red dots on the map.
     */
    private fun loadMarkerIcons(state: MapUiState, locationsToLoad: List<Location>) {
        locationsToLoad.forEach { location ->
            val locationId = location.id ?: return@forEach
            val assetId    = location.virtualAssetId ?: return@forEach
            val iconUrl    = state.assetMap[assetId]?.iconUrl ?: return@forEach
            val fullUrl    = ImageUrlHelper.buildUrl(iconUrl) ?: return@forEach

            Glide.with(this)
                .asBitmap()
                .load(fullUrl)
                .into(object : CustomTarget<Bitmap>() {
                    override fun onResourceReady(
                        resource: Bitmap,
                        transition: Transition<in Bitmap>?
                    ) {
                        if (isAdded) parkMapView.setMarkerBitmap(locationId, resource)
                    }
                    override fun onLoadCleared(placeholder: Drawable?) {
                        if (isAdded) parkMapView.setMarkerBitmap(locationId, null)
                    }
                })
        }
    }

    /**
     * Loads the public/global map configuration from the backend.
     * Restores map state, sticker layers and POI positions.
     */
    private fun loadGlobalConfig() {
        val configRepo = MapConfigurationRepository()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    configRepo.getGlobal()
                }
                result.onSuccess { config ->
                    val data = config.configData

                    // Apply map state (zoom, rotation, etc.)
                    parkMapView.setMapState(ParkMapView.MapState(
                        scale    = data.effectiveScale,
                        rotation = data.effectiveRotation,
                        offsetX  = data.effectiveOffsetX,
                        offsetY  = data.effectiveOffsetY,
                        showGrid     = data.effectiveShowGrid,
                        showBoundary = false,   // Nunca mostrar límites en vista visitante
                        showSections = data.effectiveShowSections,
                        showLabels   = data.effectiveShowLabels
                    ))

                    // Always sync sticker state from server — null or empty list clears the map,
                    // populated list renders the admin's layout. Never rely on local cache.
                    if (::stickerManager.isInitialized) {
                        val stickerLayers = data.stickers ?: emptyList()
                        stickerManager.loadFromConfigData(stickerLayers)
                        // Preload bitmaps so they render immediately
                        for (layer in stickerLayers) {
                            layer.stickers?.forEach { s ->
                                s.stickerKey?.let { stickerManager.ensureBitmapLoaded(it) }
                            }
                        }
                        parkMapView.invalidate()
                        timber.log.Timber.d("DashboardFragment: Synced ${stickerLayers.sumOf { it.stickers?.size ?: 0 }} stickers from global config")
                    }

                    // Apply POI positions if available
                    if (::poiOverlayManager.isInitialized) {
                        data.poiPositions?.let { positions ->
                            poiOverlayManager.loadDynamicPositions(
                                positions.associate { it.id to Pair(it.lat, it.lng) }
                            )
                        }
                    }

                    parkMapView.invalidate()
                }
                result.onFailure { e ->
                    timber.log.Timber.w(e, "DashboardFragment: Failed to load global config")
                }
            } catch (e: Exception) {
                timber.log.Timber.w(e, "DashboardFragment: Error loading global config")
            }
        }
    }

    private fun onLocationSelected(anchorId: String) {
        selectedLocation = locationMap[anchorId]
        selectedAnchorId = anchorId

        showTopCard(anchorId)
        parkMapView.centerOnMarker(anchorId)
    }

    private fun handleNavigate() {
        selectedLocation?.let { location ->
            val anchorId = location.id ?: return@let
            // Start dotted-path navigation on the map
            parkMapView.startNavigationToMarker(anchorId)
            // Dismiss the top card
            val topCard = requireView().findViewById<View>(R.id.top_card)
            topCard.animate()
                .translationY(-topCard.height.toFloat())
                .setDuration(300)
                .withEndAction { topCard.visibility = View.GONE }
                .start()
            // Show cancel navigation button
            requireView().findViewById<View>(R.id.btn_cancel_navigation)?.visibility = View.VISIBLE
            // Center on user so they see the path (use lastLocation to avoid double-press issue)
            centerOnUserLocation()
            Toast.makeText(requireContext(), "Sigue la flecha hacia el destino", Toast.LENGTH_SHORT).show()
        } ?: run {
            Toast.makeText(requireContext(), "Selecciona un punto primero", Toast.LENGTH_SHORT).show()
        }
    }

    private fun cancelNavigation() {
        parkMapView.stopNavigation()
        requireView().findViewById<View>(R.id.btn_cancel_navigation)?.visibility = View.GONE
    }

    private fun centerOnUserLocation() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        ) {
            fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null && loc.accuracy <= MAX_ACCEPTABLE_ACCURACY_M) {
                    // Feed filter — render loop will move the dot
                    gpsKalmanFilter.process(loc.latitude, loc.longitude, loc.accuracy, loc.time)
                    lastGpsFixMs = System.currentTimeMillis()
                    // Set position immediately so centerOnUserLocation() has data
                    val pred = gpsKalmanFilter.predict(System.currentTimeMillis())
                    if (pred != null) {
                        parkMapView.setUserLocation(pred.first, pred.second, animDurationMs = 0L)
                    }
                    setGpsLoading(false)
                }
                parkMapView.centerOnUserLocation()
            }
        } else {
            parkMapView.centerOnUserLocation()
        }
    }

    // ===== Location services =====

    private fun requestLocationPermission() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
            startLocationUpdates()
        } else {
            locationPermissionLauncher.launch(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ))
        }
    }

    private fun startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return

        // Reset filter on fresh start to avoid stale state after a long pause
        gpsKalmanFilter.reset()

        // Eagerly seed the Kalman filter with last known location
        fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
            if (loc != null && loc.accuracy <= MAX_ACCEPTABLE_ACCURACY_M) {
                gpsKalmanFilter.process(loc.latitude, loc.longitude, loc.accuracy, loc.time)
                lastGpsFixMs = System.currentTimeMillis()
                // Immediate placement so the dot is visible
                parkMapView.setUserLocation(loc.latitude, loc.longitude, animDurationMs = 0L)
            }
        }

        // High-accuracy mode, 1 s preferred, 500 ms fastest.
        // Faster GPS cadence reduces dead-reckoning extrapolation time, so
        // corrections are smaller and less visible. The render loop (60 fps)
        // keeps the dot moving smoothly between fixes.
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .setMaxUpdateDelayMillis(2000L)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return

                // Discard obviously bad fixes
                if (loc.accuracy > MAX_ACCEPTABLE_ACCURACY_M) return

                // Feed to Kalman — DON'T call setUserLocation here.
                // The render loop reads the filter state and moves the dot.
                gpsKalmanFilter.process(loc.latitude, loc.longitude, loc.accuracy, loc.time)
                lastGpsFixMs = System.currentTimeMillis()

                // Save GPS bearing/speed for use in onSensorChanged heading blend.
                // Do NOT call setUserHeading here — onSensorChanged is the single
                // owner of heading to avoid two callers fighting each other.
                if (loc.hasBearing()) {
                    lastGpsBearing = loc.bearing
                    lastGpsSpeed   = loc.speed
                }

                // Auto-center on first valid GPS fix + show out-of-bounds banner (visitors only)
                if (!hasAutocentered) {
                    hasAutocentered = true
                    val predicted = gpsKalmanFilter.predict(System.currentTimeMillis())
                    if (predicted != null) {
                        parkMapView.setUserLocation(predicted.first, predicted.second, animDurationMs = 0L)
                    }
                    parkMapView.post { parkMapView.centerOnUserLocation() }
                    val isAdmin = UserSession.currentUser?.role == "admin"
                    if (isAdded && !isAdmin) {
                        val (sLat, sLng) = predicted ?: Pair(loc.latitude, loc.longitude)
                        if (!parkMapView.isInsideParkBounds(sLat, sLng)) {
                            val banner = requireView().findViewById<android.widget.TextView?>(R.id.banner_out_of_bounds)
                            banner?.visibility = View.VISIBLE
                        }
                    }
                }

                // Hide GPS loading indicator on first accepted location
                if (isWaitingForLocation) setGpsLoading(false)
            }
        }

        fusedLocationClient.requestLocationUpdates(request, locationCallback!!, Looper.getMainLooper())

        // Start render loop — single source of truth for dot position
        renderHandler.removeCallbacks(renderRunnable)
        renderHandler.post(renderRunnable)
    }

    private fun stopLocationUpdates() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        renderHandler.removeCallbacks(renderRunnable)
    }

    // ===== Game readiness (GPS, internet, permissions) =====

    /**
     * Checks that GPS, internet and location permission are available.
     * If all good → starts location updates.
     * If not → shows a dialog explaining what the user needs to fix.
     * Uses Google Play Services LocationSettingsRequest to let the user
     * turn on GPS without leaving the app.
     */
    private fun checkGameReadiness() {
        val isAdmin = UserSession.currentUser?.role == "admin"
        val allIssues = GameReadinessChecker.check(requireContext())

        // Admins bypass the internet requirement — they can see their GPS location
        // anywhere (inside or outside the park) as long as GPS and permission are available.
        val issues = if (isAdmin) {
            allIssues.filter { it.type != GameReadinessChecker.IssueType.NO_INTERNET }
        } else {
            allIssues
        }

        // Update top banner with status (admins keep their own admin banner)
        if (!isAdmin) updateRequirementsBanner(issues)

        if (issues.isEmpty()) {
            // Everything OK → start GPS normally
            requestLocationPermission()
            return
        }

        // If the only issue is permission, handle that directly
        val nonPermissionIssues = issues.filter { it.type != GameReadinessChecker.IssueType.PERMISSION_LOCATION }
        if (issues.any { it.type == GameReadinessChecker.IssueType.PERMISSION_LOCATION }) {
            requestLocationPermission()
        }

        // If GPS is off, try to resolve via Google Play Services dialog (no settings app needed)
        if (issues.any { it.type == GameReadinessChecker.IssueType.GPS_DISABLED }) {
            promptEnableGps()
        }

        // Show combined dialog for remaining issues (internet etc.)
        if (nonPermissionIssues.isNotEmpty() && !hasShownReadinessDialog) {
            hasShownReadinessDialog = true
            showReadinessDialog(issues)
        }
    }

    /**
     * Uses Google Play Services to show a system-level GPS enable dialog
     * (same pattern used by Uber, Google Maps) so the user doesn't need
     * to go to system Settings.
     */
    private fun promptEnableGps() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 2000L
        ).build()

        val settingsRequest = LocationSettingsRequest.Builder()
            .addLocationRequest(locationRequest)
            .setAlwaysShow(true) // Force showing the dialog even if GPS was disabled before
            .build()

        LocationServices.getSettingsClient(requireActivity())
            .checkLocationSettings(settingsRequest)
            .addOnFailureListener { exception ->
                if (exception is com.google.android.gms.common.api.ResolvableApiException) {
                    try {
                        val intentSender = exception.resolution.intentSender
                        gpsSettingsLauncher.launch(
                            IntentSenderRequest.Builder(intentSender).build()
                        )
                    } catch (e: Exception) {
                        // Fallback: open system location settings
                        try {
                            startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                        } catch (_: Exception) { }
                    }
                }
            }
    }

    /**
     * Shows a dialog listing all requirements that are not met.
     * Provides button to open relevant settings.
     */
    private fun showReadinessDialog(issues: List<GameReadinessChecker.Issue>) {
        if (!isAdded) return

        val message = buildString {
            append("Para que el juego funcione correctamente necesitas:\n\n")
            issues.forEachIndexed { index, issue ->
                append("${index + 1}. ${issue.title}\n")
                append("   ${issue.description}\n\n")
            }
            append("Activa los servicios necesarios y vuelve a este mapa.")
        }

        AlertDialog.Builder(requireContext())
            .setTitle("⚠️ Requisitos del juego")
            .setMessage(message)
            .setPositiveButton("Configuración") { _, _ ->
                // Open the most relevant settings
                val hasGpsIssue = issues.any { it.type == GameReadinessChecker.IssueType.GPS_DISABLED }
                val hasInternetIssue = issues.any { it.type == GameReadinessChecker.IssueType.NO_INTERNET }
                val intent = when {
                    hasGpsIssue -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    hasInternetIssue -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
                    else -> Intent(Settings.ACTION_SETTINGS)
                }
                try { startActivity(intent) } catch (_: Exception) { }
            }
            .setNegativeButton("Continuar") { dialog, _ -> dialog.dismiss() }
            .setCancelable(true)
            .show()
    }

    /**
     * Shows/hides a warning banner at the top of the map indicating
     * which requirements are missing. Disappears when all are met.
     */
    private fun updateRequirementsBanner(issues: List<GameReadinessChecker.Issue>) {
        if (!isAdded) return
        val banner = view?.findViewById<TextView>(R.id.banner_out_of_bounds) ?: return

        if (issues.isEmpty()) {
            // Only hide if it was showing a requirements message (not an out-of-bounds message)
            if (banner.tag == "requirements") {
                banner.visibility = View.GONE
                banner.tag = null
            }
            return
        }

        // Build short text for the banner
        val labels = issues.map { issue ->
            when (issue.type) {
                GameReadinessChecker.IssueType.PERMISSION_LOCATION -> "📍 Permiso de ubicación"
                GameReadinessChecker.IssueType.GPS_DISABLED -> "📍 GPS desactivado"
                GameReadinessChecker.IssueType.NO_INTERNET -> "📶 Sin internet"
            }
        }
        banner.text = labels.joinToString("  •  ")
        banner.tag = "requirements"
        banner.visibility = View.VISIBLE
    }

    // ===== Compass / Sensor events =====

    override fun onSensorChanged(event: SensorEvent) {
        // -- Step detector: feed step events to Kalman filter --
        if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR) {
            gpsKalmanFilter.onStepDetected(System.currentTimeMillis())
            return
        }

        // -- Compute raw heading from whichever sensor path is active --
        val rawDeg: Float = when (event.sensor.type) {

            Sensor.TYPE_ROTATION_VECTOR,
            Sensor.TYPE_GAME_ROTATION_VECTOR -> {
                // Hardware-fused orientation quaternion → rotation matrix → azimuth.
                // Much more accurate than raw accel+mag because the gyroscope
                // corrects for magnetic interference and phone tilt.
                val rotMat = FloatArray(9)
                SensorManager.getRotationMatrixFromVector(rotMat, event.values)
                val orientation = FloatArray(3)
                SensorManager.getOrientation(rotMat, orientation)
                Math.toDegrees(orientation[0].toDouble()).toFloat()
            }

            Sensor.TYPE_ACCELEROMETER -> {
                System.arraycopy(event.values, 0, gravity, 0, 3)
                hasGravity = true
                return // need mag reading too
            }

            Sensor.TYPE_MAGNETIC_FIELD -> {
                System.arraycopy(event.values, 0, geomagnetic, 0, 3)
                hasMagnetic = true
                if (!hasGravity) return
                val rotMat = FloatArray(9)
                val incl   = FloatArray(9)
                if (!SensorManager.getRotationMatrix(rotMat, incl, gravity, geomagnetic)) return
                val orientation = FloatArray(3)
                SensorManager.getOrientation(rotMat, orientation)
                Math.toDegrees(orientation[0].toDouble()).toFloat()
            }

            else -> return
        }

        // -- EMA to smooth out rapid jitter --
        val emaHeading = if (smoothedHeading.isNaN()) {
            rawDeg
        } else {
            var delta = rawDeg - smoothedHeading
            if (delta > 180f)  delta -= 360f
            if (delta < -180f) delta += 360f
            var next = smoothedHeading + COMPASS_EMA_ALPHA * delta
            if (next > 180f)  next -= 360f
            if (next < -180f) next += 360f
            next
        }
        smoothedHeading = emaHeading

        // -- Blend GPS bearing when walking (> 1.0 m/s) --
        // GPS bearing gives the actual direction of travel — more useful for
        // navigation. We smoothly blend GPS bearing in proportionally to speed:
        // at 1 m/s → 20% GPS, at 2 m/s → 50% GPS, at 3+ m/s → 60% GPS.
        val finalHeading = if (lastGpsSpeed >= 1.0f) {
            val blendFactor = ((lastGpsSpeed - 1.0f) / 3.0f).coerceIn(0.2f, 0.6f)
            var delta = lastGpsBearing - emaHeading
            if (delta > 180f)  delta -= 360f
            if (delta < -180f) delta += 360f
            var blended = emaHeading + blendFactor * delta
            if (blended > 180f)  blended -= 360f
            if (blended < -180f) blended += 360f
            blended
        } else {
            emaHeading
        }

        parkMapView.setUserHeading(finalHeading)

        // Feed heading to Kalman filter for velocity direction constraint
        gpsKalmanFilter.setCompassHeading(finalHeading.toDouble(), System.currentTimeMillis())
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { /* no-op */ }

    override fun onResume() {
        super.onResume()
        // SENSOR_DELAY_FASTEST ≈ 5 ms (200 Hz) — matches Google Maps' high-frequency
        // heading updates for ultra-responsive compass. The EMA filter (α=0.18)
        // smooths out noise while preserving instant turn response.
        if (useRotationVector) {
            rotationVectorSensor?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
            }
        } else {
            accelerometerSensor?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
            }
            magnetometerSensor?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
            }
        }
        // Register step detector for Kalman velocity assist
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        // Check GPS, internet, permissions — prompt user to fix issues
        checkGameReadiness()
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
        stopLocationUpdates()
        // Reset smoothing state so stale data doesn't bleed into the next resume
        smoothedHeading = Float.NaN
        gpsKalmanFilter.reset()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        hasAutocentered = false
        if (::poiOverlayManager.isInitialized) {
            poiOverlayManager.clearCache()
        }
    }

    /** Show/hide GPS loading spinner on the location FAB */
    private fun setGpsLoading(loading: Boolean) {
        isWaitingForLocation = loading
        activity?.runOnUiThread {
            gpsFab?.visibility  = if (loading) View.INVISIBLE else View.VISIBLE
            gpsProgress?.visibility = if (loading) View.VISIBLE else View.GONE
        }
    }

    private fun showMapLayerPanel() {
        val panel = MapLayerPanelFragment.newInstance()

        // Capture current map + POI state for saving
        panel.onSaveRequested = {
            val mapState = parkMapView.getMapState()

            val poiPositions = if (::poiOverlayManager.isInitialized) {
                poiOverlayManager.getDynamicPositions().map { (id, pos) ->
                    PoiPositionSave(id = id, lat = pos.first, lng = pos.second)
                }
            } else emptyList()

            val poiVisible = if (::poiOverlayManager.isInitialized) {
                poiOverlayManager.isOverlayVisible
            } else false

            MapConfigData(
                scale      = mapState.scale,
                rotation   = mapState.rotation,
                offsetX    = mapState.offsetX,
                offsetY    = mapState.offsetY,
                showGrid   = mapState.showGrid,
                showBoundary  = mapState.showBoundary,
                showSections  = mapState.showSections,
                showLabels    = mapState.showLabels,
                poiVisible    = poiVisible,
                poiPositions  = poiPositions.ifEmpty { null },
                stickers      = if (::stickerManager.isInitialized) stickerManager.toConfigData() else null
            )
        }

        // Apply loaded configuration
        panel.onLoadRequested = { configData ->
            parkMapView.setMapState(ParkMapView.MapState(
                scale    = configData.effectiveScale,
                rotation = configData.effectiveRotation,
                offsetX  = configData.effectiveOffsetX,
                offsetY  = configData.effectiveOffsetY,
                showGrid     = configData.effectiveShowGrid,
                showBoundary = false,   // Nunca mostrar límites en vista visitante
                showSections = configData.effectiveShowSections,
                showLabels   = configData.effectiveShowLabels
            ))

            if (::poiOverlayManager.isInitialized) {
                poiOverlayManager.setOverlayVisible(configData.poiVisible)
                configData.poiPositions?.let { positions ->
                    poiOverlayManager.loadDynamicPositions(
                        positions.associate { it.id to Pair(it.lat, it.lng) }
                    )
                }
            }

            // Apply stickers from loaded config
            if (::stickerManager.isInitialized) {
                configData.stickers?.let { stickerLayers ->
                    stickerManager.loadFromConfigData(stickerLayers)
                    for (layer in stickerLayers) {
                        layer.stickers?.forEach { s ->
                            s.stickerKey?.let { stickerManager.ensureBitmapLoaded(it) }
                        }
                    }
                }
            }

            parkMapView.invalidate()
        }

        // Reset POI positions callback
        panel.onResetPoiPositions = {
            if (::poiOverlayManager.isInitialized) {
                poiOverlayManager.resetPositions()
                parkMapView.invalidate()
            }
        }

        panel.show(parentFragmentManager, MapLayerPanelFragment.TAG)
    }

    private fun showTopCard(anchorId: String) {
        val topCard = requireView().findViewById<View>(R.id.top_card)
        val cardDesc = requireView().findViewById<TextView>(R.id.card_description)

        val location = locationMap[anchorId]

        // Show only the animal name
        val asset = location?.virtualAssetId?.let { assetId ->
            viewModel.state.value.assetMap[assetId]
        }

        cardDesc.text = asset?.name ?: location?.name ?: "Sin nombre"

        topCard.visibility = View.VISIBLE
        topCard.translationY = -topCard.height.toFloat()
        topCard.animate().translationY(0f).duration = 300
    }
}
