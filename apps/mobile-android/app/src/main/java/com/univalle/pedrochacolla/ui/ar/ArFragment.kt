package com.univalle.pedrochacolla.ui.ar

import android.Manifest
import android.animation.ValueAnimator
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import dagger.hilt.android.AndroidEntryPoint
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.remote.ApiClient
import com.univalle.pedrochacolla.databinding.FragmentArBinding
import com.univalle.pedrochacolla.ui.armap.AnimalEncounterBottomSheet
import com.univalle.pedrochacolla.utils.ar.*
import com.univalle.pedrochacolla.utils.constants.Constants
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.window.BannerUtil
import com.bumptech.glide.Glide
import com.google.android.material.bottomsheet.BottomSheetDialog
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.ar.node.CloudAnchorNode
import io.github.sceneview.collision.Sphere
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.model.ModelInstance
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Request
import timber.log.Timber
import java.nio.ByteBuffer
import kotlin.math.cos
import kotlin.math.sin

/**
 * ArFragment — AR experience with cloud anchors
 *
 * STATE MACHINE:
 *   State 0 (Idle): "Colocar ancla" + "Buscar anclas" buttons
 *   State 1a (WaitingForPlacement): Tap surface to place cube
 *   State 1b (EditingAnchor): Adjust scale/rotation + VPS 360° scan + confirm
 *   State 2 (CapturingQuality): Extra VPS scanning if readiness was insufficient
 *   State 3 (SearchingForAnchors → AnchorsLoaded): Find & display remote anchors
 *
 * TWO NAVIGATION BUTTONS:
 *   - btn_return_nav (X icon, top-left): ALWAYS exits AR entirely
 *   - btn_back_state (← icon, bottom-left): Goes back one state (only visible in states 1+)
 */
@AndroidEntryPoint
class ArFragment : Fragment() {

    companion object {
        /** Key for the navigation source argument */
        const val ARG_SOURCE = "ar_source"
        /** Entered from bottom navigation or default */
        const val SOURCE_DEFAULT = "default"
        /** Entered from the AR map (explorer mode) */
        const val SOURCE_MAP = "map"
        /** Entered from the AnimalEncounterBottomSheet "Ver en Realidad Mixta" button */
        const val SOURCE_BOTTOM_SHEET = "bottom_sheet"
    }

    private var _binding: FragmentArBinding? = null
    private val binding get() = _binding!!

    private val viewModel by viewModels<ArViewModel>()

    // AR Components
    private lateinit var sceneManager: ArSceneManager
    private lateinit var anchorManager: AnchorManager
    private lateinit var fabMenuController: FabMenuController
    private lateinit var screenshotManager: ScreenshotManager
    private lateinit var animationController: AnimationSequenceController

    // Location services
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    // Loading dialog
    private var loadingDialog: LoadingDialogFragment? = null

    // Hand scan animation
    private var handScanAnimator: ValueAnimator? = null

    // Map of CloudAnchorNode → ResolvedAnchor for tap handling
    private val nodeAnchorMap = mutableMapOf<Node, ResolvedAnchor>()

    // Selected virtual asset for admin anchor upload
    private var selectedAsset: com.univalle.pedrochacolla.data.model.VirtualAsset? = null

    // Game discovery overlay state
    private var discoveryDismissRunnable: Runnable? = null
    private var discoveryProgressAnimator: ValueAnimator? = null
    private var discoveryPulseAnimator: ValueAnimator? = null

    // Bottom sheet for animal capture (shown on model tap)
    private var currentBottomSheet: AnimalEncounterBottomSheet? = null

    // Navigation source — determines back behavior for visitors
    private var navigationSource: String = SOURCE_DEFAULT

    // Admin check — based on user role only (API Key auth, TTL extended via CLI)
    private val isAdmin: Boolean
        get() = UserSession.currentUser?.role == "admin"

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentArBinding.inflate(inflater, container, false)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Track where the user came from
        navigationSource = arguments?.getString(ARG_SOURCE) ?: SOURCE_DEFAULT

        try {
            initializeComponents()
            setupUserInterface()
            setupClickListeners()
            setupAnimalPickerButton()
            observeViewModel()

            // Visitors skip idle state and go directly to anchor search
            if (!isAdmin) {
                viewModel.loadRemoteAnchors()
            }
        } catch (e: Exception) {
            Timber.e(e, "AR initialization failed")
            Toast.makeText(requireContext(), getString(R.string.ar_session_error), Toast.LENGTH_LONG).show()
            findNavController().navigate(R.id.navigation_stats)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        animationController.cleanup()
        stopHandScanAnimation()
        discoveryDismissRunnable?.let { binding.discoveryCard.removeCallbacks(it) }
        discoveryProgressAnimator?.cancel()
        discoveryPulseAnimator?.cancel()
        _binding = null
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    private fun initializeComponents() {
        sceneManager = ArSceneManager(binding.sceneView)
        sceneManager.configureScene(
            lifecycleOwner = viewLifecycleOwner,
            showPlanes = isAdmin,
            context = requireContext(),
            enableCloudAnchors = true
        )

        anchorManager = AnchorManager(binding.sceneView, requireContext(), lifecycleScope).apply {
            // Wire enhanced components from sceneManager
            planeEnhancer = sceneManager.planeEnhancer
            spatialMapper = sceneManager.spatialMapper

            onAnchorPlaced = { _ ->
                viewModel.onAnchorPlacedInScene()
            }
            onAnchorHosted = { cloudAnchorId, spatialData ->
                handleAnchorHosted(cloudAnchorId, spatialData)
            }
            onAnchorHostingError = { error ->
                viewModel.setError(error)
                dismissLoading()
            }
            onPlacementQualityUpdate = { quality ->
                // Update UI with placement quality feedback
                if (quality.score >= 0.7f) {
                    binding.etInstructionsAnchor.text = "✓ ${quality.recommendation}"
                } else {
                    binding.etInstructionsAnchor.text = quality.recommendation
                }
                binding.etInstructionsAnchor.visibility = View.VISIBLE
            }
            onVpsReadinessUpdate = { readiness, hint ->
                activity?.runOnUiThread {
                    if (_binding == null) return@runOnUiThread
                    val percent = (readiness * 100).toInt()
                    binding.vpsReadinessProgress.progress = percent
                    binding.tvVpsPercent.text = "$percent%"
                    binding.tvVpsHint.text = hint
                    val (badgeText, color) = when {
                        readiness >= 0.8f -> "Listo ✓" to "#4CAF50"
                        readiness >= 0.5f -> "Aceptable" to "#FFC107"
                        else -> "Insuficiente" to "#FF5722"
                    }
                    binding.tvVpsStatusBadge.text = badgeText
                    binding.tvVpsStatusBadge.setBackgroundColor(
                        android.graphics.Color.parseColor(color)
                    )
                    binding.vpsReadinessProgress.setIndicatorColor(
                        android.graphics.Color.parseColor(color)
                    )
                }
            }
        }

        fabMenuController = FabMenuController(
            listOf(binding.fabScaleUp, binding.fabScaleDown, binding.fabRotateLeft, binding.fabRotateRight)
        )

        screenshotManager = ScreenshotManager(binding.sceneView, requireContext()).apply {
            flashOverlay = binding.flashOverlay
        }
        animationController = AnimationSequenceController()

        // Initialize interaction tracker for daily dedup
        InteractionTracker.init(requireContext())
    }

    private fun setupUserInterface() {
        // Hide everything initially — State 0 shows only the two main buttons
        binding.etInstructionsAnchor.visibility = View.GONE
        binding.fabMenu.visibility = View.GONE
        binding.btnUploadAnchor.visibility = View.GONE
        binding.btnCancelSearch.visibility = View.GONE
        binding.animalPickerContainer.visibility = View.GONE
        binding.surfaceQualityContainer.visibility = View.GONE
        binding.vpsIndicatorContainer.visibility = View.GONE
        binding.wallModeContainer.visibility = View.GONE
        binding.btnBackState.visibility = View.GONE
        binding.iconScanHand.visibility = View.GONE

        // Show depth status chip if depth is enabled
        if (sceneManager.isDepthEnabled) {
            binding.chipDepthStatus.text = "Profundidad: activa"
            binding.chipDepthStatus.visibility = View.VISIBLE
        } else {
            binding.chipDepthStatus.visibility = View.GONE
        }

        // Admin-only host button
        if (!isAdmin) {
            binding.btnHostAnchor.visibility = View.GONE
        }

        fabMenuController.hide()

        // Gesture listener for model taps in AR scene
        binding.sceneView.setOnGestureListener(
            onSingleTapConfirmed = { _, node ->
                Timber.d("onSingleTapConfirmed: node=${node?.javaClass?.simpleName}, isTouchable=${node?.isTouchable}, mapSize=${nodeAnchorMap.size}")
                if (node != null) {
                    // Find the resolved anchor: check the tapped node, its parent, or grandparent
                    val resolved = nodeAnchorMap[node]
                        ?: node.parent?.let { nodeAnchorMap[it] }
                        ?: node.parent?.parent?.let { nodeAnchorMap[it] }
                    if (resolved != null) {
                        Timber.i("Model tapped: ${resolved.location.name}")
                        handleModelTapped(resolved)
                    } else {
                        Timber.d("onSingleTapConfirmed: Node hit but no mapping found")
                    }
                } else {
                    // Tap on empty space — hide discovery overlay
                    hideDiscoveryCard()
                }
            }
        )
    }

    private fun setupClickListeners() {
        // EXIT AR (X button, top-left) — leaves AR screen
        binding.btnReturnNav.setOnClickListener {
            exitArFragment()
        }

        // BACK STATE (← button, bottom-left)
        binding.btnBackState.setOnClickListener {
            handleBackState()
        }

        // Start anchor placement (admin)
        binding.btnHostAnchor.setOnClickListener {
            viewModel.startAnchorPlacementMode()
        }

        // Resolve remote anchors
        binding.btnResolveAnchors.setOnClickListener {
            viewModel.loadRemoteAnchors()
        }

        // Cancel search
        binding.btnCancelSearch.setOnClickListener {
            if (!isAdmin) {
                exitArFragment()
            } else {
                resetToIdleStateKeepingModels()
            }
        }

        // Upload anchor
        binding.btnUploadAnchor.setOnClickListener {
            handleUploadAnchor()
        }

        // FAB menu toggle
        binding.fabMenu.setOnClickListener { fabMenuController.toggle() }

        // Transformations
        binding.fabScaleUp.setOnClickListener {
            anchorManager.scaleUp(Constants.AR.SCALE_FACTOR_UP)
            updateTransformDisplay()
        }
        binding.fabScaleDown.setOnClickListener {
            anchorManager.scaleDown(Constants.AR.SCALE_FACTOR_DOWN)
            updateTransformDisplay()
        }
        binding.fabRotateLeft.setOnClickListener {
            anchorManager.rotateLeft(Constants.AR.ROTATION_STEP_DEGREES)
            updateTransformDisplay()
        }
        binding.fabRotateRight.setOnClickListener {
            anchorManager.rotateRight(Constants.AR.ROTATION_STEP_DEGREES)
            updateTransformDisplay()
        }

        // Screenshot
        binding.btnTakePhoto.setOnClickListener {
            screenshotManager.captureAndSave(
                onSuccess = { BannerUtil.showBanner(requireActivity(), getString(R.string.ar_photo_saved)) },
                onError = { msg -> BannerUtil.showBanner(requireActivity(), msg) }
            )
        }

        // Wall mode toggle — reachable during VPS quality capture
        binding.switchWallMode.setOnCheckedChangeListener { _, isChecked ->
            val mapper = anchorManager.spatialMapper ?: return@setOnCheckedChangeListener
            mapper.wallMode = isChecked
            // Immediately refresh the badge color and hint so the admin sees the new threshold
            anchorManager.onVpsReadinessUpdate?.invoke(mapper.scanReadiness, mapper.scanReadinessHint)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BACK STATE — goes back one state in the AR flow
    // ═══════════════════════════════════════════════════════════════

    private fun handleBackState() {
        when (viewModel.uiState.value) {
            is ArUiState.WaitingForAnchorPlacement -> {
                // Waiting → Idle (discard all pending if no anchors placed yet)
                anchorManager.disableAnchorPlacementMode()
                resetToIdleState()
            }
            is ArUiState.EditingAnchor -> {
                // Discard the current cube and go back to idle
                anchorManager.clear()
                fabMenuController.hide()
                binding.fabMenu.visibility = View.GONE
                binding.tvTransformInfo.visibility = View.GONE
                binding.animalPickerContainer.visibility = View.GONE
                binding.vpsIndicatorContainer.visibility = View.GONE
                binding.wallModeContainer.visibility = View.GONE
                selectedAsset = null
                resetToIdleState()
            }
            is ArUiState.CapturingQuality -> {
                // VPS scanning → back to EditingAnchor
                binding.vpsIndicatorContainer.visibility = View.GONE
                binding.etInstructionsAnchor.visibility = View.GONE
                binding.wallModeContainer.visibility = View.GONE
                showAnchorEditControls()
                viewModel.onAnchorPlacedInScene()
            }
            is ArUiState.SearchingForAnchors,
            is ArUiState.AnchorsLoaded -> {
                stopHandScanAnimation()
                if (!isAdmin) {
                    // Visitors exit AR entirely — go back to where they came from
                    exitArFragment()
                } else {
                    resetToIdleStateKeepingModels()
                }
            }
            is ArUiState.Error,
            is ArUiState.Loading,
            is ArUiState.AnchorHostingSuccess -> {
                dismissLoading()
                resetToIdleState()
            }
            is ArUiState.Idle -> resetToIdleState()
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANIMAL PICKER SETUP
    // ═══════════════════════════════════════════════════════════════

    /**
     * Wires the "Seleccionar animal" button, the "Cambiar" button, and
     * observes the ViewModel's virtualAssets flow so data is ready for the dialog.
     */
    private fun setupAnimalPickerButton() {
        binding.btnSelectAnimal.setOnClickListener {
            showAnimalPickerDialog()
        }
        binding.btnChangeAnimal.setOnClickListener {
            showAnimalPickerDialog()
        }
        // Tapping the selected animal display also re-opens the dialog
        binding.selectedAnimalLayout.setOnClickListener {
            showAnimalPickerDialog()
        }
    }

    /**
     * Opens a BottomSheetDialog with a vertical scrolling list of all active
     * VirtualAssets. Tapping one selects it, closes the dialog, updates the
     * UI and replaces the cube model with the selected animal's 3D model.
     *
     * If assets haven't loaded yet (race condition between ViewModel init and
     * user tap), triggers a refresh and waits up to 10s for the data.
     */
    private fun showAnimalPickerDialog() {
        val assets = viewModel.virtualAssets.value
        if (assets.isNotEmpty()) {
            openAnimalPickerWith(assets)
            return
        }

        // Assets not loaded yet — trigger refresh and wait
        viewModel.refreshVirtualAssets()
        lifecycleScope.launch {
            val loadingToast = Toast.makeText(requireContext(), "Cargando animales...", Toast.LENGTH_LONG)
            loadingToast.show()

            val loaded = withTimeoutOrNull(10_000L) {
                viewModel.virtualAssets.first { it.isNotEmpty() }
            }

            loadingToast.cancel()

            if (loaded.isNullOrEmpty()) {
                Toast.makeText(requireContext(), "No hay animales disponibles", Toast.LENGTH_SHORT).show()
            } else {
                openAnimalPickerWith(loaded)
            }
        }
    }

    /** Inflates and shows the animal picker BottomSheetDialog with the given list. */
    private fun openAnimalPickerWith(assets: List<com.univalle.pedrochacolla.data.model.VirtualAsset>) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_animal_picker, null)
        val rv = dialogView.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rv_dialog_animals)

        val bottomSheet = BottomSheetDialog(requireContext())
        bottomSheet.setContentView(dialogView)

        val adapter = AnimalPickerAdapter(R.layout.item_animal_dialog) { asset ->
            onAnimalSelected(asset)
            bottomSheet.dismiss()
        }
        rv.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(requireContext())
        rv.adapter = adapter
        adapter.submitList(assets)

        bottomSheet.show()
    }

    /**
     * Called when the admin selects an animal from the picker dialog.
     * Updates the UI to show the selected icon + upload button,
     * and replaces the cube placeholder with the animal's 3D model.
     */
    private fun onAnimalSelected(asset: com.univalle.pedrochacolla.data.model.VirtualAsset) {
        selectedAsset = asset
        Timber.d("onAnimalSelected: '${asset.name}' (id=${asset.id})")

        // Update picker container UI
        updateAnimalPickerDisplay()

        // Replace the cube model with the selected animal's 3D model
        lifecycleScope.launch {
            try {
                showLoading("Cargando modelo...")
                val newModel = loadAnimalModel(asset)
                dismissLoading()
                if (newModel != null) {
                    anchorManager.replaceModel(newModel)
                    Timber.i("Cube replaced with '${asset.name}' model")
                } else {
                    Toast.makeText(requireContext(), "No se pudo cargar el modelo", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                dismissLoading()
                Timber.e(e, "Error loading animal model")
                Toast.makeText(requireContext(), "Error al cargar modelo: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Updates the animal picker container to show either the "Select" button
     * or the selected animal's icon + name + upload button.
     */
    private fun updateAnimalPickerDisplay() {
        val asset = selectedAsset
        if (asset != null) {
            binding.btnSelectAnimal.visibility = View.GONE
            binding.selectedAnimalLayout.visibility = View.VISIBLE
            binding.tvSelectedAnimalName.text = asset.name
            Glide.with(this)
                .load(ImageUrlHelper.buildUrl(asset.iconUrl))
                .placeholder(R.drawable.ic_launcher_foreground)
                .into(binding.ivSelectedAnimalIcon)
            binding.btnUploadAnchor.visibility = View.VISIBLE
        } else {
            binding.btnSelectAnimal.visibility = View.VISIBLE
            binding.selectedAnimalLayout.visibility = View.GONE
            binding.btnUploadAnchor.visibility = View.GONE
        }
    }

    /**
     * Load a 3D model for the selected VirtualAsset, preserving current
     * scale and rotation from the anchor manager.
     */
    private suspend fun loadAnimalModel(asset: com.univalle.pedrochacolla.data.model.VirtualAsset): ModelNode? {
        val sceneView = sceneManager.getSceneView()
        val (currentScale, currentRotY) = anchorManager.getModelTransform()
        val resolution = ModelResolver.resolve(requireContext(), asset.modelUrl)

        Timber.d("Loading animal model: $resolution (scale=$currentScale, rotY=$currentRotY)")

        val modelInstance: ModelInstance? = when (resolution) {
            is ModelResolution.Local -> {
                sceneView.modelLoader.loadModelInstance(resolution.assetPath)
            }
            is ModelResolution.Remote -> {
                val fullUrl = ImageUrlHelper.buildUrl(resolution.url) ?: resolution.url
                downloadAndCreateModelInstance(fullUrl)
            }
        }

        if (modelInstance == null) {
            Timber.e("Failed to load animal model: $resolution")
            return null
        }

        return ModelNode(
            modelInstance = modelInstance,
            autoAnimate = true,
            scaleToUnits = currentScale,
            centerOrigin = Position(y = -0.5f)
        ).apply {
            isEditable = true
            // Prevent gesture-based scale/rotation — these are controlled
            // exclusively via FAB buttons so that currentScaleToUnits stays
            // in sync with the actual visual size.
            isScaleEditable = false
            isRotationEditable = false
            rotation = Rotation(y = currentRotY)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE OBSERVATION
    // ═══════════════════════════════════════════════════════════════

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                when (state) {
                    is ArUiState.Idle -> handleIdleState()
                    is ArUiState.Loading -> showLoading(state.message)
                    is ArUiState.WaitingForAnchorPlacement -> handleWaitingForPlacement()
                    is ArUiState.EditingAnchor -> handleEditingAnchor()
                    is ArUiState.CapturingQuality -> handleCapturingQuality()
                    is ArUiState.AnchorHostingSuccess -> handleHostingSuccess()
                    is ArUiState.SearchingForAnchors -> handleSearchingAnchors()
                    is ArUiState.AnchorsLoaded -> handleAnchorsLoaded(state.anchors)
                    is ArUiState.Error -> handleError(state.message)
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE HANDLERS
    // ═══════════════════════════════════════════════════════════════

    /** State 0 — Initial state */
    private fun handleIdleState() {
        dismissLoading()
        resetToIdleState()
    }

    /** State 1a — Waiting for user to tap on surface */
    private fun handleWaitingForPlacement() {
        binding.etInstructionsAnchor.text = getString(R.string.ar_tap_surface_instruction)
        binding.etInstructionsAnchor.visibility = View.VISIBLE
        binding.btnResolveAnchors.visibility = View.GONE
        binding.btnHostAnchor.visibility = View.GONE
        binding.btnUploadAnchor.visibility = View.GONE
        binding.btnBackState.visibility = View.VISIBLE
        binding.surfaceQualityContainer.visibility = View.VISIBLE
        binding.fabMenu.visibility = View.GONE
        binding.tvTransformInfo.visibility = View.GONE

        try {
            anchorManager.enableAnchorPlacementMode {
                sceneManager.loadDefaultModel(isEditable = true)
            }
        } catch (e: Exception) {
            viewModel.setError(getString(R.string.ar_arcore_error, e.message ?: ""))
        }
        setupSurfaceQualityMonitor()
    }

    /**
     * Monitor surface quality during placement by processing frames
     * through the enhanced PlaneEnhancer.
     */
    private fun setupSurfaceQualityMonitor() {
        val sceneView = sceneManager.getSceneView()
        sceneView.onSessionUpdated = { session, frame ->
            val enhancedPlanes = sceneManager.onFrameUpdate(session, frame)

            // Update surface quality UI
            activity?.runOnUiThread {
                if (_binding == null) return@runOnUiThread

                val bestPlane = enhancedPlanes.firstOrNull()
                if (bestPlane != null) {
                    val qualityPercent = (bestPlane.quality * 100).toInt()
                    binding.surfaceQualityProgress.progress = qualityPercent

                    // Color-code the progress bar
                    val color = when {
                        qualityPercent >= 70 -> android.graphics.Color.parseColor("#4CAF50")  // Green
                        qualityPercent >= 40 -> android.graphics.Color.parseColor("#FFC107")  // Yellow
                        else -> android.graphics.Color.parseColor("#FF5722")                     // Red
                    }
                    binding.surfaceQualityProgress.setIndicatorColor(color)

                    binding.tvSurfaceQualityHint.text = when {
                        qualityPercent >= 70 -> "Superficie estable — toca para colocar"
                        qualityPercent >= 40 -> "Escanea un poco más…"
                        else -> "Mueve lentamente sobre la superficie"
                    }
                }
            }
        }
    }

    /**
     * EditingAnchor state — cube placed, admin adjusts scale/rotation and
     * simultaneously scans 360° around the anchor (VPS data collection live).
     * Tapping "Subir ancla" checks VPS readiness and triggers hosting.
     */
    private fun handleEditingAnchor() {
        // Replace surface quality monitor with VPS scan driver —
        // feeds frames to SpatialMapper AND updates the VPS progress bar.
        sceneManager.getSceneView().onSessionUpdated = { _, _ ->
            anchorManager.updateVpsScan()
        }
        binding.surfaceQualityContainer.visibility = View.GONE
        binding.btnBackState.visibility = View.VISIBLE
        binding.fabMenu.visibility = View.VISIBLE

        // VPS indicator: visible so admin sees 360° scan progress alongside FABs
        binding.vpsIndicatorContainer.visibility = View.VISIBLE

        // Wall mode toggle: always visible during anchor editing
        binding.wallModeContainer.visibility = View.VISIBLE
        binding.switchWallMode.isChecked = anchorManager.spatialMapper?.wallMode ?: false

        // Animal picker below wall mode
        binding.animalPickerContainer.visibility = View.VISIBLE

        // Show instruction as a toast (temporary) instead of persistent text
        Toast.makeText(requireContext(), "Ajusta el modelo y escanea 360° alrededor del ancla", Toast.LENGTH_LONG).show()
        binding.etInstructionsAnchor.visibility = View.GONE

        // Show upload button only if an animal is already selected
        updateAnimalPickerDisplay()
        updateTransformDisplay()
        binding.tvTransformInfo.visibility = View.VISIBLE
    }

    /** State 2 — Quality capture before upload */
    private fun handleCapturingQuality() {
        binding.btnBackState.visibility = View.VISIBLE
        binding.vpsIndicatorContainer.visibility = View.VISIBLE
        // Wall mode toggle remains visible during quality capture
        binding.wallModeContainer.visibility = View.VISIBLE
        // Keep upload button visible so the admin can tap again once the bar turns green
        binding.btnUploadAnchor.visibility = View.VISIBLE
        binding.etInstructionsAnchor.text = getString(R.string.ar_scan_environment)
        binding.etInstructionsAnchor.visibility = View.VISIBLE
        // Always start with wall mode off for each new scan session
        binding.switchWallMode.isChecked = false

        // Per-frame callback: accumulate VPS feature points and viewpoints while admin walks around
        sceneManager.getSceneView().onSessionUpdated = { _, _ ->
            anchorManager.updateVpsScan()
        }
    }

    /** Upload success — show summary and reset to idle */
    private fun handleHostingSuccess() {
        dismissLoading()
        val count = viewModel.hostedCount.value
        BannerUtil.showBanner(
            requireActivity(),
            "✓ ${count} ancla(s) subida(s) correctamente"
        )
        resetToIdleState()
    }

    /** State 3a — Searching for remote anchors (hand scan animation) */
    private fun handleSearchingAnchors() {
        binding.btnHostAnchor.visibility = View.GONE
        binding.btnResolveAnchors.visibility = View.GONE
        binding.btnBackState.visibility = View.VISIBLE
        binding.btnCancelSearch.visibility = View.VISIBLE

        // Show hand scan animation instead of text
        binding.etInstructionsAnchor.visibility = View.GONE
        startHandScanAnimation()
    }

    /** State 3b — Anchors loaded: resolve and display in scene */
    private fun handleAnchorsLoaded(anchors: List<ResolvedAnchor>) {
        // Keep hand animation running until 3D models actually appear in the scene
        binding.btnCancelSearch.visibility = View.GONE

        if (anchors.isEmpty()) {
            stopHandScanAnimation()
            binding.etInstructionsAnchor.text = "No se encontraron anclas"
            binding.etInstructionsAnchor.visibility = View.VISIBLE
            return
        }

        // Resolve each anchor in the AR scene
        resolveAnchorsInScene(anchors)
    }

    /** Error state */
    private fun handleError(message: String) {
        dismissLoading()
        stopHandScanAnimation()
        BannerUtil.showBanner(requireActivity(), message)
    }

    // ═══════════════════════════════════════════════════════════════
    // UPLOAD ANCHOR
    // ═══════════════════════════════════════════════════════════════

    private fun handleUploadAnchor() {
        try {
            val readiness = anchorManager.spatialMapper?.scanReadiness ?: 0f
            if (!anchorManager.isVpsReadyForHosting()) {
                // Transition to CapturingQuality — this activates the per-frame onSessionUpdated
                // callback so the VPS progress bar updates as the admin walks around the anchor.
                val percent = ((anchorManager.spatialMapper?.scanReadiness ?: 0f) * 100).toInt()
                viewModel.startQualityCapture(percent)
                return
            }

            // Lock model — disable all editing
            anchorManager.lockForHosting()
            fabMenuController.hide()
            binding.fabMenu.visibility = View.GONE
            binding.btnUploadAnchor.visibility = View.GONE
            binding.animalPickerContainer.visibility = View.GONE
            binding.vpsIndicatorContainer.visibility = View.GONE
            binding.wallModeContainer.visibility = View.GONE
            binding.etInstructionsAnchor.text = getString(R.string.ar_loading)
            binding.etInstructionsAnchor.visibility = View.VISIBLE

            showLoading(getString(R.string.ar_loading))
            anchorManager.hostToCloud()
        } catch (e: Exception) {
            dismissLoading()
            viewModel.setError(getString(R.string.ar_arcore_error, e.message ?: ""))
        }
    }

    private fun handleAnchorHosted(cloudAnchorId: String, spatialData: com.univalle.pedrochacolla.data.model.SpatialData?) {
        try {
            if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                Toast.makeText(requireContext(), getString(R.string.ar_no_location_permission), Toast.LENGTH_LONG).show()
                dismissLoading()
                return
            }

            // Capture model transform (scale, rotationY) before location request
            val (modelScale, modelRotationY) = anchorManager.getModelTransform()

            fusedLocationClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location == null) {
                        Toast.makeText(requireContext(), getString(R.string.ar_no_location_obtained), Toast.LENGTH_LONG).show()
                        dismissLoading()
                        resetToIdleState()
                        return@addOnSuccessListener
                    }

                    // Enrich spatial data with GPS info — guard against NaN/Inf from device
                    val safeAccuracy  = location.accuracy.takeIf  { it.isFinite() && it >= 0f }
                    val safeAltitude  = location.altitude.takeIf  { it.isFinite() }
                    val enrichedSpatialData = spatialData?.copy(
                        gpsAccuracy = safeAccuracy,
                        altitude = safeAltitude
                    )

                    viewModel.onAnchorHostedToCloud(
                        cloudAnchorId = cloudAnchorId,
                        virtualAssetId = selectedAsset?.id,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        scale = modelScale,
                        rotationY = modelRotationY,
                        spatialData = enrichedSpatialData
                    )
                }
                .addOnFailureListener {
                    dismissLoading()
                    viewModel.setError(getString(R.string.ar_no_location_obtained))
                }
        } catch (e: Exception) {
            dismissLoading()
            viewModel.setError(getString(R.string.ar_arcore_error, e.message ?: ""))
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR RESOLUTION — Display remote anchors in AR scene
    // ═══════════════════════════════════════════════════════════════

    private fun resolveAnchorsInScene(anchors: List<ResolvedAnchor>) {
        val session = sceneManager.getSession() ?: run {
            Timber.e("No AR session available for anchor resolution")
            stopHandScanAnimation()
            return
        }
        val sceneView = sceneManager.getSceneView()

        val anchorsWithCode = anchors.filter { !it.location.anchorCode.isNullOrBlank() }
        if (anchorsWithCode.isEmpty()) {
            Timber.w("No anchors have cloud anchor codes")
            stopHandScanAnimation()
            binding.etInstructionsAnchor.text = "No hay anclas con código de anclaje"
            binding.etInstructionsAnchor.visibility = View.VISIBLE
            return
        }

        Timber.i("Resolving ${anchorsWithCode.size} cloud anchors...")
        var firstModelShown = false

        for (resolved in anchorsWithCode) {
            val anchorCode = resolved.location.anchorCode ?: continue
            // Log the stored scale/rotation from backend
            Timber.i("Anchor '%s': stored scale=%.3f, rotationY=%.1f",
                resolved.location.name, resolved.location.scale, resolved.location.rotationY)

            try {
                CloudAnchorNode.resolve(
                    engine = sceneView.engine,
                    session = session,
                    cloudAnchorId = anchorCode
                ) { state, node ->
                    if (activity == null || _binding == null) return@resolve

                    if (!state.isError && node != null) {
                        Timber.i("Cloud anchor resolved: ${resolved.location.name}")

                        // Load and attach model in coroutine (model loading is suspend)
                        lifecycleScope.launch {
                            try {
                                val modelNode = loadModelForAnchor(resolved)
                                if (modelNode != null) {
                                    // Read the effective scale for collision shape sizing
                                    val modelScale = resolved.location.scale.takeIf { it > 0f } ?: 1.0f

                                    // Set collision shapes BEFORE adding to scene
                                    node.collisionShape = Sphere(modelScale / 2f)
                                    node.isTouchable = true
                                    modelNode.collisionShape = Sphere(modelScale / 2f)
                                    modelNode.isTouchable = true

                                    // Add to scene — registers colliders
                                    node.addChildNode(modelNode)
                                    sceneView.addChildNode(node)

                                    // Apply rotation from the backend Location record
                                    val targetRotY = resolved.location.rotationY
                                    modelNode.rotation = Rotation(y = targetRotY)

                                    Timber.i("Model placed: '%s' scale=%.3f rotY=%.1f nodeScale=(%.3f,%.3f,%.3f)",
                                        resolved.location.name, modelScale, targetRotY,
                                        modelNode.scale.x, modelNode.scale.y, modelNode.scale.z)

                                    // Store mapping for both parent and child nodes
                                    nodeAnchorMap[node] = resolved
                                    nodeAnchorMap[modelNode] = resolved

                                    // ── VPS spatial refinement ──────────────────────────────
                                    val spatialData = resolved.location.spatialData
                                    val lastFrame = sceneManager.lastFrame
                                    if (spatialData != null && lastFrame != null) {
                                        try {
                                            val match = sceneManager.spatialMapper
                                                .matchEnvironment(session, lastFrame, spatialData)
                                            if (match != null && match.confidence >= 0.5f) {
                                                val preciseAnchor = session.createAnchor(match.pose)
                                                val preciseNode = AnchorNode(
                                                    engine = sceneView.engine,
                                                    anchor = preciseAnchor
                                                )
                                                // Reattach model to the spatially refined anchor
                                                node.removeChildNode(modelNode)
                                                sceneView.removeChildNode(node)
                                                nodeAnchorMap.remove(node)
                                                nodeAnchorMap.remove(modelNode)
                                                preciseNode.collisionShape = Sphere(modelScale / 2f)
                                                preciseNode.isTouchable = true
                                                preciseNode.addChildNode(modelNode)
                                                sceneView.addChildNode(preciseNode)
                                                // Re-apply rotation after VPS re-attachment
                                                modelNode.rotation = Rotation(y = targetRotY)
                                                nodeAnchorMap[preciseNode] = resolved
                                                nodeAnchorMap[modelNode] = resolved
                                                Timber.i("VPS refinement applied (confidence=%.2f) for %s",
                                                    match.confidence, resolved.location.name)
                                            }
                                        } catch (e: Exception) {
                                            Timber.w(e, "VPS refinement skipped for ${resolved.location.name}")
                                        }
                                    }
                                    // ────────────────────────────────────────────────────────

                                    Timber.d("Model tappable: ${resolved.location.name} (scale=$modelScale, sphere radius=${modelScale / 2f})")

                                    // Stop hand animation when first model appears
                                    if (!firstModelShown) {
                                        firstModelShown = true
                                        stopHandScanAnimation()
                                    }
                                }
                            } catch (e: Exception) {
                                Timber.e(e, "Error loading model for ${resolved.location.name}")
                            }
                        }
                    } else {
                        Timber.w("Failed to resolve anchor ${resolved.location.name}: $state")
                    }
                }
            } catch (e: Exception) {
                Timber.e(e, "Error starting cloud anchor resolution for ${resolved.location.name}")
            }
        }
    }

    /**
     * Load a 3D model for a resolved anchor.
     * Uses ModelResolver to check local bundled assets first, falling back to
     * authenticated download from the backend. Animations are auto-played.
     *
     * Scale and rotation are applied from the Location data stored in the backend
     * when the anchor was originally placed by the admin.
     */
    private suspend fun loadModelForAnchor(resolved: ResolvedAnchor): ModelNode? {
        val sceneView = sceneManager.getSceneView()
        // Use stored scale from the Location — this is the scaleToUnits value that
        // the admin set during anchor placement. Fall back to 1.0 if missing/zero.
        val scale = resolved.location.scale.takeIf { it.isFinite() && it > 0f } ?: 1.0f
        val rotY = resolved.location.rotationY.takeIf { it.isFinite() } ?: 0.0f

        // Resolve model: local asset first, then remote download
        val rawModelUrl = resolved.asset?.modelUrl
        val resolution = ModelResolver.resolve(requireContext(), rawModelUrl)

        Timber.i("loadModelForAnchor: '%s' resolution=%s, scale=%.3f (raw=%.3f), rotY=%.1f (raw=%.1f)",
            resolved.location.name, resolution, scale, resolved.location.scale,
            rotY, resolved.location.rotationY)

        val modelInstance: ModelInstance? = when (resolution) {
            is ModelResolution.Local -> {
                // Load from bundled APK assets (instant, no network)
                sceneView.modelLoader.loadModelInstance(resolution.assetPath)
            }
            is ModelResolution.Remote -> {
                // Download from server with authentication
                val fullUrl = ImageUrlHelper.buildUrl(resolution.url) ?: resolution.url
                downloadAndCreateModelInstance(fullUrl)
            }
        }

        if (modelInstance == null) {
            Timber.e("Failed to load model: $resolution")
            // Fallback to default cube if asset model failed
            if (resolution !is ModelResolution.Local || resolution.assetPath != "models/cube.glb") {
                Timber.d("Falling back to default cube model")
                val fallback = sceneView.modelLoader.loadModelInstance("models/cube.glb")
                    ?: return null
                return createModelNodeWithTransforms(fallback, scale, rotY, resolved.location.name)
            }
            return null
        }

        return createModelNodeWithTransforms(modelInstance, scale, rotY, resolved.location.name)
    }

    /**
     * Create a ModelNode with explicit scale (scaleToUnits) and rotation application.
     * Sets transforms both via constructor AND explicitly afterward to guarantee
     * they take effect regardless of SceneView's internal initialization order.
     */
    private fun createModelNodeWithTransforms(
        modelInstance: ModelInstance,
        scale: Float,
        rotationY: Float,
        debugName: String
    ): ModelNode {
        val node = ModelNode(
            modelInstance = modelInstance,
            autoAnimate = true,
            scaleToUnits = scale,
            centerOrigin = Position(y = -0.5f)
        ).apply {
            isEditable = false
        }

        // Explicitly set rotation after construction — this is the primary
        // mechanism for applying the admin's stored rotation.
        node.rotation = Rotation(y = rotationY)

        Timber.i("createModelNode: '%s' scaleToUnits=%.3f, rotation=Rotation(y=%.1f), " +
                "nodeScale=(%.4f,%.4f,%.4f), nodeRotation=(%.1f,%.1f,%.1f)",
            debugName, scale, rotationY,
            node.scale.x, node.scale.y, node.scale.z,
            node.rotation.x, node.rotation.y, node.rotation.z)

        return node
    }

    /**
     * Download a GLB model from an authenticated URL using the app's OkHttpClient,
     * then create a ModelInstance from the raw bytes.
     */
    private suspend fun downloadAndCreateModelInstance(url: String): ModelInstance? {
        return withContext(Dispatchers.IO) {
            try {
                Timber.d("Downloading model from: $url")
                val request = Request.Builder().url(url).build()
                val response = ApiClient.instance.newCall(request).execute()
                if (!response.isSuccessful) {
                    Timber.e("Model download failed ($url): HTTP ${response.code}")
                    return@withContext null
                }
                val bytes = response.body?.bytes() ?: run {
                    Timber.e("Model download returned empty body: $url")
                    return@withContext null
                }
                Timber.d("Model downloaded: ${bytes.size} bytes from $url")

                // Filament requires a DIRECT ByteBuffer (not heap-backed)
                val buffer = ByteBuffer.allocateDirect(bytes.size).apply {
                    put(bytes)
                    rewind()
                }

                withContext(Dispatchers.Main) {
                    sceneManager.getSceneView().modelLoader.createModelInstance(buffer)
                }
            } catch (e: Exception) {
                Timber.e(e, "Error downloading model from: $url")
                null
            }
        }
    }



    // ═══════════════════════════════════════════════════════════════
    // HAND SCAN ANIMATION
    // ═══════════════════════════════════════════════════════════════

    private fun startHandScanAnimation() {
        binding.iconScanHand.visibility = View.VISIBLE
        // Elliptical / oval motion instead of rotation
        val radiusX = 60f  // horizontal amplitude in pixels
        val radiusY = 30f  // vertical amplitude in pixels

        handScanAnimator = ValueAnimator.ofFloat(0f, (2.0 * Math.PI).toFloat()).apply {
            duration = 2500
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { anim ->
                val angle = anim.animatedValue as Float
                binding.iconScanHand.translationX = radiusX * cos(angle.toDouble()).toFloat()
                binding.iconScanHand.translationY = radiusY * sin(angle.toDouble()).toFloat()
            }
            start()
        }
    }

    private fun stopHandScanAnimation() {
        handScanAnimator?.cancel()
        handScanAnimator = null
        binding.iconScanHand.translationX = 0f
        binding.iconScanHand.translationY = 0f
        binding.iconScanHand.visibility = View.GONE
    }

    // ═══════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Exits the AR fragment — navigates back depending on where the user came from.
     * Visitors came from the map or bottom sheet → go back to the map.
     * Admins (or unknown source) → go to stats (home).
     */
    private fun exitArFragment() {
        val navController = findNavController()
        when (navigationSource) {
            SOURCE_MAP, SOURCE_BOTTOM_SHEET -> navController.navigate(R.id.navigation_ar_map)
            else -> navController.navigate(R.id.navigation_stats)
        }
    }

    private fun showAnchorEditControls() {
        binding.fabMenu.visibility = View.VISIBLE
        binding.wallModeContainer.visibility = View.VISIBLE
        binding.animalPickerContainer.visibility = View.VISIBLE
        updateAnimalPickerDisplay()
        updateTransformDisplay()
        binding.tvTransformInfo.visibility = View.VISIBLE
    }

    private fun resetToIdleState() {
        anchorManager.clear()
        sceneManager.resetProcessors()
        fabMenuController.hide()
        stopHandScanAnimation()
        nodeAnchorMap.clear()
        selectedAsset = null

        binding.etInstructionsAnchor.visibility = View.GONE
        binding.fabMenu.visibility = View.GONE
        binding.btnUploadAnchor.visibility = View.GONE
        binding.btnCancelSearch.visibility = View.GONE
        binding.surfaceQualityContainer.visibility = View.GONE
        binding.vpsIndicatorContainer.visibility = View.GONE
        binding.wallModeContainer.visibility = View.GONE
        binding.animalPickerContainer.visibility = View.GONE
        binding.btnBackState.visibility = View.GONE
        binding.iconScanHand.visibility = View.GONE
        binding.tvTransformInfo.visibility = View.GONE

        binding.btnHostAnchor.text = getString(R.string.ar_place_anchor)
        binding.btnHostAnchor.visibility = if (isAdmin) View.VISIBLE else View.GONE
        binding.btnResolveAnchors.visibility = View.VISIBLE

        viewModel.resetToIdle()
    }

    /**
     * Vuelve al estado idle pero conserva los modelos resueltos en la escena
     * para que el usuario pueda seguir tocándolos y abrir el bottom sheet de captura.
     */
    private fun resetToIdleStateKeepingModels() {
        anchorManager.clear()
        fabMenuController.hide()
        stopHandScanAnimation()
        selectedAsset = null
        // NO se limpia nodeAnchorMap — los modelos siguen en la escena y son tocables

        binding.etInstructionsAnchor.visibility = View.GONE
        binding.fabMenu.visibility = View.GONE
        binding.btnUploadAnchor.visibility = View.GONE
        binding.btnCancelSearch.visibility = View.GONE
        binding.surfaceQualityContainer.visibility = View.GONE
        binding.vpsIndicatorContainer.visibility = View.GONE
        binding.wallModeContainer.visibility = View.GONE
        binding.animalPickerContainer.visibility = View.GONE
        binding.btnBackState.visibility = View.GONE
        binding.iconScanHand.visibility = View.GONE
        binding.tvTransformInfo.visibility = View.GONE

        binding.btnHostAnchor.text = getString(R.string.ar_place_anchor)
        binding.btnHostAnchor.visibility = if (isAdmin) View.VISIBLE else View.GONE
        binding.btnResolveAnchors.visibility = View.VISIBLE

        viewModel.resetToIdle()
    }

    /** Update the scale/rotation indicator text */
    private fun updateTransformDisplay() {
        val (scale, rotationY) = anchorManager.getModelTransform()
        binding.tvTransformInfo.text = "Escala: %.2f  |  Rotación: %.0f°".format(scale, rotationY)
    }

    private fun showLoading(message: String = getString(R.string.ar_loading)) {
        if (loadingDialog == null) {
            loadingDialog = LoadingDialogFragment.newInstance()
            loadingDialog?.show(parentFragmentManager, "loading")
        }
    }

    private fun dismissLoading() {
        loadingDialog?.dismiss()
        loadingDialog = null
    }

    /**
     * Handle a tap on a 3D model in the AR scene.
     * Shows the AnimalEncounterBottomSheet with animal info and a "Regresar" button.
     */
    private fun handleModelTapped(resolved: ResolvedAnchor) {
        val isNew = !resolved.isInteracted

        // Record interaction (daily dedup per user to avoid spamming)
        val userId = UserSession.currentUser?.id ?: return
        val interactionKey = "view_${userId}_${resolved.location.id}"
        if (!InteractionTracker.hasInteractedToday(interactionKey)) {
            viewModel.recordInteraction(
                locationId = resolved.location.id,
                virtualAssetId = resolved.asset?.id
            )
            InteractionTracker.setInteractionForToday(interactionKey)
        }

        // Update local state so subsequent taps show as already found
        if (isNew) {
            val updated = resolved.copy(isInteracted = true)
            val entriesToUpdate = nodeAnchorMap.entries.filter {
                it.value === resolved || it.value.location.id == resolved.location.id
            }
            for (entry in entriesToUpdate) {
                nodeAnchorMap[entry.key] = updated
            }
        }

        // Show capture bottom sheet (AR mode: no spinning 3D model, "Regresar" button)
        currentBottomSheet = AnimalEncounterBottomSheet.newInstanceFromAr(
            location = resolved.location,
            asset = resolved.asset,
            alreadyFound = !isNew
        ).apply {
            // El usuario ya está en AR, "Guardar encuentro" registra la interacción scan
            onSaveEncounter = { locationId, assetId, animalName ->
                viewModel.recordInteraction(
                    locationId = locationId,
                    virtualAssetId = assetId
                )
            }
            // "Regresar" simplemente cierra la ventana
            onGoBack = {
                // No-op: dismiss() ya se llama dentro del bottom sheet
            }
        }
        currentBottomSheet!!.show(childFragmentManager, AnimalEncounterBottomSheet.TAG)
    }

    // ═══════════════════════════════════════════════════════════════
    // GAME DISCOVERY OVERLAY
    // ═══════════════════════════════════════════════════════════════

    /**
     * Muestra el overlay de descubrimiento al estilo juego móvil.
     *
     * [isNew] = true  → ¡NUEVO! — dorado, dim de fondo, pulso, haptic, dismiss manual.
     * [isNew] = false → YA EN TU ÁLBUM — verde, sin dim, cuenta atrás de 2 s.
     */
    private fun showDiscoveryCard(resolved: ResolvedAnchor, isNew: Boolean) {
        if (activity == null || !isAdded || _binding == null) return

        // Cancelar cualquier estado anterior
        discoveryDismissRunnable?.let { binding.discoveryCard.removeCallbacks(it) }
        discoveryProgressAnimator?.cancel()
        discoveryPulseAnimator?.cancel()
        binding.discoveryCard.clearAnimation()
        binding.discoveryCard.scaleX = 1f
        binding.discoveryCard.scaleY = 1f

        // ── Contenido ──────────────────────────────────────────────
        binding.tvDiscoveryName.text = resolved.asset?.name ?: resolved.location.name
        val sci = resolved.asset?.scientificName
        if (!sci.isNullOrBlank()) {
            binding.tvDiscoverySubtitle.text = sci
            binding.tvDiscoverySubtitle.visibility = View.VISIBLE
        } else {
            binding.tvDiscoverySubtitle.visibility = View.GONE
        }
        val iconUrl = ImageUrlHelper.buildUrl(resolved.asset?.iconUrl)
        if (iconUrl != null) {
            Glide.with(this).load(iconUrl).into(binding.ivDiscoveryIcon)
        } else {
            binding.ivDiscoveryIcon.setImageDrawable(null)
        }

        if (isNew) {
            // ── ¡NUEVO! — tema dorado ────────────────────────────────
            binding.discoveryCard.setCardBackgroundColor(android.graphics.Color.parseColor("#1C1400"))
            val badgeBg = android.graphics.drawable.GradientDrawable().apply {
                setColor(android.graphics.Color.parseColor("#FFD700"))
                cornerRadius = 100f
            }
            binding.tvDiscoveryBadge.background = badgeBg
            binding.tvDiscoveryBadge.text = "★  ¡NUEVO!  ★"
            binding.tvDiscoveryBadge.setTextColor(android.graphics.Color.parseColor("#1C1400"))

            binding.discoveryDimOverlay.visibility = View.VISIBLE
            binding.discoveryProgress.visibility = View.GONE
            binding.tvDiscoveryDismiss.visibility = View.VISIBLE

            // Dismiss al tocar cualquier parte
            binding.discoveryDimOverlay.setOnClickListener { hideDiscoveryCard() }
            binding.discoveryCard.setOnClickListener { hideDiscoveryCard() }

            // Feedback haptico: patrón pulso
            try {
                val vibrator = requireContext().getSystemService(android.os.Vibrator::class.java)
                vibrator?.vibrate(
                    android.os.VibrationEffect.createWaveform(longArrayOf(0L, 80L, 60L, 160L), -1)
                )
            } catch (e: Exception) {
                Timber.w("Haptic feedback not available: ${e.message}")
            }

            // Pulso suave continuo en la tarjeta
            discoveryPulseAnimator = ValueAnimator.ofFloat(1f, 1.05f, 1f).apply {
                duration = 800
                repeatCount = ValueAnimator.INFINITE
                interpolator = android.view.animation.AccelerateDecelerateInterpolator()
                addUpdateListener { anim ->
                    if (_binding == null) return@addUpdateListener
                    val s = anim.animatedValue as Float
                    binding.discoveryCard.scaleX = s
                    binding.discoveryCard.scaleY = s
                }
                start()
            }
        } else {
            // ── YA EN TU ÁLBUM — tema verde, auto-dismiss 2 s ──────────
            binding.discoveryCard.setCardBackgroundColor(android.graphics.Color.parseColor("#071A0E"))
            val badgeBg = android.graphics.drawable.GradientDrawable().apply {
                setColor(android.graphics.Color.parseColor("#2E7D32"))
                cornerRadius = 100f
            }
            binding.tvDiscoveryBadge.background = badgeBg
            binding.tvDiscoveryBadge.text = "✓  YA EN TU ÁLBUM"
            binding.tvDiscoveryBadge.setTextColor(android.graphics.Color.parseColor("#E8F5E9"))

            binding.discoveryDimOverlay.visibility = View.GONE
            binding.discoveryProgress.visibility = View.VISIBLE
            binding.tvDiscoveryDismiss.visibility = View.GONE
            binding.discoveryCard.setOnClickListener(null)
            binding.discoveryDimOverlay.setOnClickListener(null)

            // Barra de cuenta atrás animada (100 → 0 en 2 s)
            discoveryProgressAnimator = ValueAnimator.ofInt(100, 0).apply {
                duration = 2000
                interpolator = LinearInterpolator()
                addUpdateListener { anim ->
                    if (_binding != null) binding.discoveryProgress.progress = anim.animatedValue as Int
                }
                start()
            }

            // Auto-dismiss al terminar la cuenta
            val runnable = Runnable { if (isAdded && _binding != null) hideDiscoveryCard() }
            discoveryDismissRunnable = runnable
            binding.discoveryCard.postDelayed(runnable, 2000)
        }

        // Tarjeta aparece deslizándose desde abajo (estilo Pokémon GO)
        binding.discoveryCard.translationY = 600f
        binding.discoveryCard.visibility = View.VISIBLE
        binding.discoveryCard.animate()
            .translationY(0f)
            .setDuration(380)
            .setInterpolator(android.view.animation.DecelerateInterpolator())
            .start()
    }

    private fun hideDiscoveryCard() {
        if (_binding == null) return
        discoveryDismissRunnable?.let { binding.discoveryCard.removeCallbacks(it) }
        discoveryProgressAnimator?.cancel()
        discoveryPulseAnimator?.cancel()
        binding.discoveryCard.scaleX = 1f
        binding.discoveryCard.scaleY = 1f
        binding.discoveryCard.animate()
            .translationY(600f)
            .setDuration(280)
            .setInterpolator(android.view.animation.AccelerateInterpolator())
            .withEndAction {
                if (_binding != null) {
                    binding.discoveryCard.visibility = View.GONE
                    binding.discoveryDimOverlay.visibility = View.GONE
                }
            }
            .start()
    }
}
