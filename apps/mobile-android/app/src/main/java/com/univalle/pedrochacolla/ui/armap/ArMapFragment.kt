package com.univalle.pedrochacolla.ui.armap

import android.Manifest
import android.content.Context
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
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.transition.Transition
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.snackbar.Snackbar
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.repository.MapConfigurationRepository
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import com.univalle.pedrochacolla.ui.dashboard.PoiItem
import com.univalle.pedrochacolla.ui.dashboard.PoiOverlayManager
import com.univalle.pedrochacolla.ui.dashboard.StickerManager
import com.univalle.pedrochacolla.ui.dashboard.StickerOverlayManager
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper
import com.univalle.pedrochacolla.utils.ar.ArDeviceCompatibility
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.location.GpsKalmanFilter
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * ArMapFragment — Modo Explorador: experiencia estilo Pokémon Go para dispositivos de GAMA BAJA.
 *
 * En lugar de Realidad Mixta (ARCore + cloud anchors, que requiere hardware de gama alta),
 * este fragmento muestra un **mapa interactivo del parque** con los animales como marcadores.
 * El usuario:
 *   1. Navega por el mapa y ve los animales de la app con iconos.
 *   2. Los animales dentro del radio de encuentro (50 m) se destacan visualmente.
 *   3. Al tocar un marcador, se abre una hoja de encuentro (BottomSheet) con:
 *      - Información del animal (nombre, científico, categoría, hábitat)
 *      - Distancia actual
 *      - Botón "¡Guardar encuentro!" (habilitado solo si está en rango)
 *   4. Al guardar, se registra la interacción en el backend (igual que Realidad Mixta).
 *
 * El progreso se refleja en la pantalla de inicio y en la sección Colección.
 */
@AndroidEntryPoint
class ArMapFragment : Fragment(), SensorEventListener {

    /** true cuando el usuario autenticado tiene rol admin */
    private val isAdmin get() = UserSession.currentUser?.role == "admin"

    /** Cuando true (admin toggle), muestra TODOS los animales en el mapa sin importar distancia */
    private var showAllAnimals = false

    private val viewModel: ArMapViewModel by viewModels()
    private lateinit var parkMapView: ParkMapView
    private lateinit var loadingOverlay: View
    private var fabAdminShowAll: com.google.android.material.floatingactionbutton.FloatingActionButton? = null
    private var adminBanner: android.widget.TextView? = null
    private lateinit var fabMyLocation: FloatingActionButton
    private lateinit var fabAr: FloatingActionButton
    private lateinit var stickerOverlayManager: StickerOverlayManager
    private lateinit var poiOverlayManager: PoiOverlayManager
    private lateinit var stickerManager: StickerManager
    private var locationCallback: LocationCallback? = null
    private var outOfBoundsBanner: android.widget.TextView? = null

    // GPS
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var lastKnownLat: Double? = null
    private var lastKnownLng: Double? = null

    // GPS Kalman filter — same as DashboardFragment for smooth dot movement
    private val gpsKalmanFilter = GpsKalmanFilter(processNoiseMetersPerSecond = 0.30)
    private val MAX_ACCEPTABLE_ACCURACY_M = 20f

    // Render loop — single source of truth for dot position (60 fps)
    private val renderHandler = Handler(Looper.getMainLooper())
    private var lastGpsFixMs = 0L
    private val RENDER_INTERVAL_MS = 16L
    private val renderRunnable: Runnable = object : Runnable {
        override fun run() {
            if (!gpsKalmanFilter.isInitialized) {
                renderHandler.postDelayed(this, RENDER_INTERVAL_MS)
                return
            }
            val predicted = gpsKalmanFilter.predict(System.currentTimeMillis())
            if (predicted != null) {
                parkMapView.setUserLocation(predicted.first, predicted.second, animDurationMs = 0L)
            }
            renderHandler.postDelayed(this, RENDER_INTERVAL_MS)
        }
    }

    // Compass sensors — same high-precision approach as DashboardFragment
    private lateinit var sensorManager: SensorManager
    private var rotationVectorSensor: Sensor? = null
    private var useRotationVector = false
    private var accelerometerSensor: Sensor? = null
    private var magnetometerSensor: Sensor? = null
    private val gravity = FloatArray(3)
    private val geomagnetic = FloatArray(3)
    private var hasGravity = false
    private var hasMagnetic = false
    private val COMPASS_EMA_ALPHA = 0.18f
    private var smoothedHeading = Float.NaN
    private var lastGpsBearing = 0f
    private var lastGpsSpeed = 0f

    /** true después del primer fix GPS — evita llamar centerOnUserLocation más de una vez */
    private var hasAutocentered = false

    /** true después de mostrar el hint de exploración (se muestra solo una vez) */
    private var hasShownExploreHint = false

    /** Referencia al BottomSheet abierto para actualizarlo si llega el resultado */
    private var currentBottomSheet: AnimalEncounterBottomSheet? = null

    // ─────────────────────────────────────────────────────────────────
    //  PERMISOS GPS
    // ─────────────────────────────────────────────────────────────────

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            startLocationUpdates()
        } else {
            Snackbar.make(
                requireView(),
                "Permiso de ubicación necesario para detectar animales cercanos",
                Snackbar.LENGTH_LONG
            ).show()
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  LIFECYCLE
    // ─────────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
        // Initialize compass sensors — prefer hardware-fused rotation vector
        sensorManager = requireContext().getSystemService(Context.SENSOR_SERVICE) as SensorManager
        rotationVectorSensor =
            sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
                ?: sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        useRotationVector = rotationVectorSensor != null
        if (!useRotationVector) {
            accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            magnetometerSensor  = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_ar_map, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Sistema de retroceso: tanto la flecha del sistema como la del botón van al inicio
        requireActivity().onBackPressedDispatcher.addCallback(
            viewLifecycleOwner,
            object : androidx.activity.OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    findNavController().navigate(R.id.navigation_stats)
                }
            }
        )

        // Bind views
        parkMapView    = view.findViewById(R.id.arMapParkMapView)
        loadingOverlay  = view.findViewById(R.id.arMapLoadingOverlay)
        fabMyLocation  = view.findViewById(R.id.arMapFabMyLocation)
        fabAr          = view.findViewById(R.id.arMapFabAr)
        outOfBoundsBanner = view.findViewById(R.id.arMapOutOfBoundsBanner)
        fabAdminShowAll = view.findViewById(R.id.arMapFabAdminShowAll)
        adminBanner     = view.findViewById(R.id.arMapAdminBanner)

        // Configurar mapa
        val isDark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        parkMapView.setDarkTheme(isDark)
        parkMapView.showBoundary = false
        parkMapView.showGrid = false
        parkMapView.showSections = true
        parkMapView.showLabels = false  // en modo explorador no se muestran etiquetas ni alertas
        parkMapView.showScaleBar = false // ocultar barra de escala en modo explorador

        // ── Admin controls ──
        parkMapView.isAdminMode = isAdmin
        if (isAdmin) {
            fabAdminShowAll?.visibility = View.VISIBLE
            adminBanner?.visibility = View.VISIBLE
            fabAdminShowAll?.setOnClickListener {
                showAllAnimals = !showAllAnimals
                val newTint = if (showAllAnimals) "#CC1565C0" else "#CC37474F"
                fabAdminShowAll?.backgroundTintList =
                    android.content.res.ColorStateList.valueOf(
                        android.graphics.Color.parseColor(newTint)
                    )
                val stateMsg = if (showAllAnimals)
                    "🔐 Modo Admin — Viendo TODOS los animales"
                else
                    "🔐 Modo Admin — Vista explorador normal"
                adminBanner?.text = stateMsg
                // Force re-render of markers with new filter
                val st = viewModel.uiState.value
                if (st is ArMapUiState.Ready) updateMapMarkers(st.locations)
            }
        }

        // ── Web-synced overlays ──
        poiOverlayManager = PoiOverlayManager(requireContext())
        poiOverlayManager.poiItems =
            PoiOverlayManager.createDefaultItems(resources, requireContext().packageName)
        parkMapView.poiOverlayManager = poiOverlayManager

        stickerManager = StickerManager(requireContext())
        stickerOverlayManager = StickerOverlayManager(stickerManager)
        parkMapView.stickerOverlayManager = stickerOverlayManager

        // Establecer zoom inicial cuando el view tenga dimensiones
        parkMapView.post { initializeMapScale() }

        // Click en marcador → abrir encounter sheet
        parkMapView.setMarkerClickListener(object : ParkMapView.OnMarkerClickListener {
            override fun onMarkerClick(marker: ParkMapView.MapMarker) {
                onAnimalMarkerTapped(marker.id)
            }
        })

        // FAB: centrar en ubicación del usuario
        fabAr.setOnClickListener {
            (requireActivity() as MainActivity).navigateToAr(
                findNavController(),
                com.univalle.pedrochacolla.ui.ar.ArFragment.SOURCE_MAP
            )
        }

        // Botón Volver — regresa a la pantalla de inicio (Bienvenido usuario)
        view.findViewById<View>(R.id.btnBackArMap)?.setOnClickListener {
            findNavController().navigate(R.id.navigation_stats)
        }

        fabMyLocation.setOnClickListener {
            val lat = lastKnownLat
            val lng = lastKnownLng
            if (lat != null && lng != null) {
                // Use Kalman-filtered position for accuracy
                val predicted = gpsKalmanFilter.predict(System.currentTimeMillis())
                if (predicted != null) {
                    parkMapView.setUserLocation(predicted.first, predicted.second, animDurationMs = 0L)
                } else {
                    parkMapView.setUserLocation(lat, lng, animDurationMs = 0L)
                }
                parkMapView.centerOnUserLocation()
            } else {
                requestLocationPermissions()
            }
        }

        observeUiState()
        observeEncounterSave()
        observeModelViewerResult()

        // Solicitar permisos e iniciar GPS
        requestLocationPermissions()

        // Cargar datos del backend
        viewModel.loadMapData()

        // Cargar configuración global del mapa (stickers, POI) desde el admin web
        loadGlobalConfig()
    }

    /**
     * Loads the public/global map configuration saved by the web admin.
     * Applies stickers and POI positions to this explorer map so that the
     * same visual resources configured on the web are visible here.
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

                    // Sync stickers from web admin
                    if (::stickerManager.isInitialized) {
                        val stickerLayers = data.stickers ?: emptyList()
                        stickerManager.loadFromConfigData(stickerLayers)
                        for (layer in stickerLayers) {
                            layer.stickers?.forEach { s ->
                                s.stickerKey?.let { stickerManager.ensureBitmapLoaded(it) }
                            }
                        }
                        parkMapView.invalidate()
                        Timber.d("ArMapFragment: Synced ${stickerLayers.sumOf { it.stickers?.size ?: 0 }} stickers from global config")
                    }

                    // Apply POI positions if available
                    if (::poiOverlayManager.isInitialized) {
                        data.poiPositions?.let { positions ->
                            poiOverlayManager.loadDynamicPositions(
                                positions.associate { it.id to Pair(it.lat, it.lng) }
                            )
                        }
                        // Auto-show POI overlay in explorer mode
                        poiOverlayManager.toggleOverlay()
                        parkMapView.invalidate()
                    }
                }
                result.onFailure { e ->
                    Timber.w(e, "ArMapFragment: Failed to load global config")
                }
            } catch (e: Exception) {
                Timber.w(e, "ArMapFragment: Error loading global config")
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Register compass sensors at highest frequency for precise heading
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
        if (hasLocationPermission()) startLocationUpdates()
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
        stopLocationUpdates()
        smoothedHeading = Float.NaN
        gpsKalmanFilter.reset()
    }

    // ── Compass / Sensor events ──

    override fun onSensorChanged(event: SensorEvent) {
        val rawDeg: Float = when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR,
            Sensor.TYPE_GAME_ROTATION_VECTOR -> {
                val rotMat = FloatArray(9)
                SensorManager.getRotationMatrixFromVector(rotMat, event.values)
                val orientation = FloatArray(3)
                SensorManager.getOrientation(rotMat, orientation)
                Math.toDegrees(orientation[0].toDouble()).toFloat()
            }
            Sensor.TYPE_ACCELEROMETER -> {
                System.arraycopy(event.values, 0, gravity, 0, 3)
                hasGravity = true
                return
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

        // EMA smoothing
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

        // Blend GPS bearing when walking
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

    // ─────────────────────────────────────────────────────────────────
    //  OBSERVADORES DE ESTADO
    // ─────────────────────────────────────────────────────────────────

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is ArMapUiState.Loading -> {
                            loadingOverlay.visibility = View.VISIBLE
                        }
                        is ArMapUiState.Ready -> {
                            loadingOverlay.visibility = View.GONE
                            updateMapMarkers(state.locations)
                            if (!hasShownExploreHint) {
                                hasShownExploreHint = true
                                showExploreHint()
                            }
                        }
                        is ArMapUiState.Error -> {
                            loadingOverlay.visibility = View.GONE
                            Snackbar.make(
                                requireView(),
                                state.message,
                                Snackbar.LENGTH_LONG
                            ).setAction("Reintentar") { viewModel.loadMapData() }.show()
                        }
                    }
                }
            }
        }
    }

    private fun observeEncounterSave() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.encounterSaveState.collect { state ->
                    when (state) {
                        is EncounterSaveState.Saving -> {
                            Timber.d("ArMapFragment: guardando encuentro...")
                        }
                        is EncounterSaveState.Success -> {
                            currentBottomSheet?.markAsSaved()
                            Snackbar.make(
                                requireView(),
                                "🎉 ¡${state.animalName} guardado en tu colección!",
                                Snackbar.LENGTH_LONG
                            ).show()
                            viewModel.resetEncounterState()
                        }
                        is EncounterSaveState.Error -> {
                            Snackbar.make(
                                requireView(),
                                "No se pudo guardar: ${state.message}",
                                Snackbar.LENGTH_LONG
                            ).show()
                            viewModel.resetEncounterState()
                        }
                        EncounterSaveState.Idle -> { /* nada */ }
                    }
                }
            }
        }
    }

    /**
     * Observa resultados de guardado provenientes de [ModelViewerFragment] via savedStateHandle.
     * ModelViewerFragment usa la back-stack result API para devolver el encuentro a guardar.
     */
    private fun observeModelViewerResult() {
        findNavController()
            .currentBackStackEntry
            ?.savedStateHandle
            ?.getLiveData<String>(ModelViewerFragment.RESULT_SAVE_LOCATION_ID)
            ?.observe(viewLifecycleOwner) { locationId ->
                if (locationId.isNullOrBlank()) return@observe
                val handle = findNavController().currentBackStackEntry?.savedStateHandle
                val assetId     = handle?.get<String>(ModelViewerFragment.RESULT_SAVE_ASSET_ID)
                val animalName  = handle?.get<String>(ModelViewerFragment.RESULT_SAVE_ANIMAL_NAME) ?: ""
                viewModel.saveEncounter(locationId, assetId, animalName)
                // Limpiar resultado para evitar doble procesamiento
                handle?.remove<String>(ModelViewerFragment.RESULT_SAVE_LOCATION_ID)
                handle?.remove<String>(ModelViewerFragment.RESULT_SAVE_ASSET_ID)
                handle?.remove<String>(ModelViewerFragment.RESULT_SAVE_ANIMAL_NAME)
            }
    }

    // ─────────────────────────────────────────────────────────────────
    //  MAPA — MARCADORES
    // ─────────────────────────────────────────────────────────────────

    /**
     * Actualiza los marcadores del mapa con mecánica de exploración pura:
     * - Sin GPS → muestra todos los animales como referencia visual.
     * - Con GPS → solo muestra los animales dentro del radio de encuentro (ENCOUNTER_RADIUS_METERS).
     *   No hay excepción para animales ya encontrados: el usuario debe volver a acercarse
     *   para verlos en el mapa.
     */
    private fun updateMapMarkers(locations: List<LocationWithAsset>) {
        val gpsAvailable = lastKnownLat != null

        // Admin with "show all" toggle: bypass all distance/visibility filters
        val visibleLocations = when {
            isAdmin && showAllAnimals -> locations
            gpsAvailable -> {
                // Con GPS: animales ya encontrados siempre visibles + no encontrados dentro del radio
                locations.filter { lwa ->
                    lwa.alreadyFound || (lwa.distanceMeters != null && lwa.distanceMeters <= VISIBILITY_RADIUS_METERS)
                }
            }
            else -> {
                // Sin GPS: solo los ya capturados
                locations.filter { it.alreadyFound }
            }
        }

        // 1. Poner marcadores en el mapa (sin bitmaps inicialmente)
        parkMapView.setLocations(visibleLocations.map { it.location })

        // 2. Asignar flags y cargar ícónos vía Glide
        for (lwa in visibleLocations) {
            val locationId = lwa.location.id ?: continue

            // Flags de estado (instantáneo)
            parkMapView.setMarkerNearby(
                locationId,
                lwa.distanceMeters != null && lwa.distanceMeters <= ENCOUNTER_RADIUS_METERS
            )
            parkMapView.setMarkerFound(locationId, lwa.alreadyFound)

            // Cargar ícono del animal (Glide sirve desde caché en memória si ya cargó antes)
            val iconUrl = lwa.asset?.iconUrl ?: continue
            val imageUrl = ImageUrlHelper.buildUrl(iconUrl) ?: continue
            Glide.with(this)
                .asBitmap()
                .load(imageUrl)
                .into(object : CustomTarget<Bitmap>(96, 96) {
                    override fun onResourceReady(resource: Bitmap, transition: Transition<in Bitmap>?) {
                        // Podria haberse reemplazado el marcador si el GPS actualizó antes
                        parkMapView.setMarkerBitmap(locationId, resource)
                    }
                    override fun onLoadCleared(placeholder: Drawable?) {
                        parkMapView.setMarkerBitmap(locationId, null)
                    }
                })
        }
    }



    /**
     * Muestra el hint de exploración la primera vez que se cargan los datos.
     */
    private fun showExploreHint() {
        Snackbar.make(
            requireView(),
            "¡Camina por el parque para descubrir los animales cercanos!",
            Snackbar.LENGTH_LONG
        ).show()
    }

    /**
     * Establece el zoom y rotación inicial del mapa una vez que el view tiene dimensiones.
     * - rotation = 0 → norte arriba (los árboles aparecen rectos, no inclinados)
     * - scale = 7f → zoom justo para ver el parque con animales no superpuestos
     */
    private fun initializeMapScale() {
        val current = parkMapView.getMapState()
        parkMapView.setMapState(
            current.copy(
                scale = 7f,
                rotation = 0f  // norte arriba: los árboles se ven rectos
            )
        )
    }

    /**
     * Al tocar un marcador:
     * - Todos los dispositivos: muestra primero el BottomSheet de detalle del animal
     * - "Ver en 3D" en dispositivos COMPATIBLES: navega a Realidad Mixta (ArFragment)
     * - "Ver en 3D" en dispositivos de baja gama: navega al visor ModelViewerFragment
     */
    private fun onAnimalMarkerTapped(markerId: String) {
        val state = viewModel.uiState.value
        if (state !is ArMapUiState.Ready) return

        val lwa = state.locations.find { it.location.id == markerId } ?: run {
            Timber.w("ArMapFragment: marcador $markerId no encontrado en la lista")
            return
        }

        val isCompatible = ArDeviceCompatibility.checkCompatibility(requireContext()) ==
                ArDeviceCompatibility.CompatibilityResult.COMPATIBLE

        // Mostrar BottomSheet de detalle para TODOS los dispositivos
        currentBottomSheet = AnimalEncounterBottomSheet.newInstance(lwa).apply {
            isArCompatible = isCompatible
            isAdminMode = isAdmin
            onGoToArMixto = {
                // Navegar a Realidad Mixta (ARCore) — solo dispositivos compatibles
                Timber.i("ArMapFragment: navegando a Realidad Mixta desde BottomSheet")
                findNavController().navigate(
                    R.id.navigation_ar,
                    android.os.Bundle().apply {
                        putString(
                            com.univalle.pedrochacolla.ui.ar.ArFragment.ARG_SOURCE,
                            com.univalle.pedrochacolla.ui.ar.ArFragment.SOURCE_BOTTOM_SHEET
                        )
                    }
                )
            }
            onSaveEncounter = { locationId, assetId, animalName ->
                viewModel.saveEncounter(locationId, assetId, animalName)
            }
            onViewIn3D = { modelUrl, animalName, scientificName, category, habitat,
                           distance, locationId, assetId, alreadyFound ->
                // Navegar al detalle rediseñado (estilo Pokemon GO)
                findNavController().navigate(
                    R.id.navigation_animal_detail,
                    AnimalDetailFragment.args(
                        modelUrl       = modelUrl,
                        animalName     = animalName,
                        scientificName = scientificName,
                        category       = category,
                        habitat        = habitat,
                        section        = lwa.location.section,
                        description    = lwa.asset?.description,
                        displayOrder   = lwa.asset?.displayOrder ?: 0,
                        distanceMeters = distance,
                        locationId     = locationId,
                        assetId        = assetId,
                        alreadyFound   = alreadyFound
                    )
                )
            }
        }
        currentBottomSheet!!.show(
            childFragmentManager,
            AnimalEncounterBottomSheet.TAG
        )
    }

    // ─────────────────────────────────────────────────────────────────
    //  GPS
    // ─────────────────────────────────────────────────────────────────

    private fun requestLocationPermissions() {
        if (!hasLocationPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            startLocationUpdates()
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            requireContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            requireContext(),
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

    private fun startLocationUpdates() {
        if (!hasLocationPermission()) return

        // Reset filter on fresh start to avoid stale state
        gpsKalmanFilter.reset()

        // Eagerly seed the Kalman filter with last known location
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null && loc.accuracy <= MAX_ACCEPTABLE_ACCURACY_M) {
                    gpsKalmanFilter.process(loc.latitude, loc.longitude, loc.accuracy, loc.time)
                    lastGpsFixMs = System.currentTimeMillis()
                    lastKnownLat = loc.latitude
                    lastKnownLng = loc.longitude
                    parkMapView.setUserLocation(loc.latitude, loc.longitude, animDurationMs = 0L)
                }
            }
        } catch (_: SecurityException) { }

        // HIGH_ACCURACY + 1 s interval + no min distance = continuous precise updates
        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            1_000L
        ).apply {
            setMinUpdateIntervalMillis(500L)
            setMaxUpdateDelayMillis(2_000L)
            setWaitForAccurateLocation(false)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return

                // Discard poor accuracy fixes
                if (loc.accuracy > MAX_ACCEPTABLE_ACCURACY_M) return

                // Feed Kalman filter — render loop moves the dot
                gpsKalmanFilter.process(loc.latitude, loc.longitude, loc.accuracy, loc.time)
                lastGpsFixMs = System.currentTimeMillis()
                lastKnownLat = loc.latitude
                lastKnownLng = loc.longitude

                // Save GPS bearing/speed for compass blending
                if (loc.hasBearing()) {
                    lastGpsBearing = loc.bearing
                    lastGpsSpeed   = loc.speed
                }

                viewModel.onLocationUpdate(loc.latitude, loc.longitude)

                // Mostrar banner si el usuario está fuera de los límites del parque (solo visitantes)
                val predicted = gpsKalmanFilter.predict(System.currentTimeMillis())
                val (sLat, sLng) = predicted ?: Pair(loc.latitude, loc.longitude)
                if (!isAdmin) {
                    val isInside = parkMapView.isInsideParkBounds(sLat, sLng)
                    outOfBoundsBanner?.visibility = if (isInside) android.view.View.GONE else android.view.View.VISIBLE
                }

                // Al primer fix GPS: centrar el mapa en el usuario automáticamente
                if (!hasAutocentered) {
                    hasAutocentered = true
                    if (predicted != null) {
                        parkMapView.setUserLocation(predicted.first, predicted.second, animDurationMs = 0L)
                    }
                    parkMapView.post { parkMapView.centerOnUserLocation() }
                    Timber.d("ArMapFragment: primer fix GPS — mapa centrado en usuario")
                }

                Timber.d("ArMapFragment: GPS fix lat=${loc.latitude}, lng=${loc.longitude}, acc=${loc.accuracy}")
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                request,
                locationCallback!!,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Timber.e(e, "ArMapFragment: permiso de ubicación denegado al iniciar updates")
        }

        // Start render loop — 60 fps smooth dot movement
        renderHandler.removeCallbacks(renderRunnable)
        renderHandler.post(renderRunnable)
    }

    private fun stopLocationUpdates() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        renderHandler.removeCallbacks(renderRunnable)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        stopLocationUpdates()
        currentBottomSheet = null
        outOfBoundsBanner = null
        fabAdminShowAll = null
        adminBanner = null
        // Resetear estado por sesión para que el próximo acceso empiece limpio
        hasAutocentered = false
        hasShownExploreHint = false
        lastKnownLat = null
        lastKnownLng = null
    }
}
