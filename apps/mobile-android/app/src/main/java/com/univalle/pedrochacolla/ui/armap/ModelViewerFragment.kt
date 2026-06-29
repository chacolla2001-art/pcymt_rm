package com.univalle.pedrochacolla.ui.armap

import android.animation.ValueAnimator
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.textview.MaterialTextView
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.remote.ApiClient
import com.univalle.pedrochacolla.utils.ar.ModelResolution
import com.univalle.pedrochacolla.utils.ar.ModelResolver
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper
import io.github.sceneview.SceneView
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ModelNode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Request
import timber.log.Timber
import java.nio.ByteBuffer
import kotlin.math.roundToInt

import dagger.hilt.android.AndroidEntryPoint

/**
 * ModelViewerFragment — Visor de modelo 3D completo para el Modo Explorador.
 *
 * Se navega aquí desde [AnimalEncounterBottomSheet] al tocar "Ver modelo 3D".
 * Muestra el modelo GLB del animal girando en un SceneView 3D (sin ARCore),
 * junto con la información del animal y la opción de guardar el encuentro.
 *
 * Argumentos (Bundle):
 * - ARG_MODEL_URL     : String  — ruta del modelo (e.g. "/api/files/bear.glb")
 * - ARG_ANIMAL_NAME   : String
 * - ARG_SCIENTIFIC    : String? (nullable)
 * - ARG_CATEGORY      : String? (nullable)
 * - ARG_HABITAT       : String? (nullable)
 * - ARG_DISTANCE      : Double  (< 0 = no GPS)
 * - ARG_LOCATION_ID   : String?
 * - ARG_ASSET_ID      : String?
 * - ARG_ALREADY_FOUND : Boolean
 */
@AndroidEntryPoint
class ModelViewerFragment : Fragment() {

    companion object {
        const val ARG_MODEL_URL      = "mv_model_url"
        const val ARG_ANIMAL_NAME    = "mv_animal_name"
        const val ARG_SCIENTIFIC     = "mv_scientific"
        const val ARG_CATEGORY       = "mv_category"
        const val ARG_HABITAT        = "mv_habitat"
        const val ARG_DISTANCE       = "mv_distance"
        const val ARG_LOCATION_ID    = "mv_location_id"
        const val ARG_ASSET_ID       = "mv_asset_id"
        const val ARG_ALREADY_FOUND  = "mv_already_found"

        const val RESULT_SAVE_LOCATION_ID  = "mv_result_location_id"
        const val RESULT_SAVE_ASSET_ID      = "mv_result_asset_id"
        const val RESULT_SAVE_ANIMAL_NAME   = "mv_result_animal_name"

        fun args(
            modelUrl: String?,
            animalName: String,
            scientificName: String?,
            category: String?,
            habitat: String?,
            distanceMeters: Double?,
            locationId: String?,
            assetId: String?,
            alreadyFound: Boolean
        ) = Bundle().apply {
            putString(ARG_MODEL_URL, modelUrl)
            putString(ARG_ANIMAL_NAME, animalName)
            putString(ARG_SCIENTIFIC, scientificName)
            putString(ARG_CATEGORY, category)
            putString(ARG_HABITAT, habitat)
            putDouble(ARG_DISTANCE, distanceMeters ?: -1.0)
            putString(ARG_LOCATION_ID, locationId)
            putString(ARG_ASSET_ID, assetId)
            putBoolean(ARG_ALREADY_FOUND, alreadyFound)
        }
    }

    private var sceneView: SceneView? = null
    private var rotationAnimator: ValueAnimator? = null
    private var modelNode: ModelNode? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_model_viewer, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val args       = requireArguments()
        val modelUrl   = args.getString(ARG_MODEL_URL)
        val animalName = args.getString(ARG_ANIMAL_NAME) ?: "Animal"
        val scientific = args.getString(ARG_SCIENTIFIC)
        val category   = args.getString(ARG_CATEGORY)
        val habitat    = args.getString(ARG_HABITAT)
        val distance   = args.getDouble(ARG_DISTANCE).takeIf { it >= 0 }
        val locationId = args.getString(ARG_LOCATION_ID)
        val assetId    = args.getString(ARG_ASSET_ID)
        val alreadyFound = args.getBoolean(ARG_ALREADY_FOUND, false)

        val sceneContainer = view.findViewById<FrameLayout>(R.id.modelViewerSceneContainer)
        val loadingOverlay = view.findViewById<FrameLayout>(R.id.modelViewerLoadingOverlay)
        val infoCard       = view.findViewById<LinearLayout>(R.id.modelViewerInfoCard)
        val layoutBanner   = view.findViewById<LinearLayout>(R.id.layoutModelViewerStatusBanner)
        val tvBannerText   = view.findViewById<TextView>(R.id.tvModelViewerBannerText)
        val tvName         = view.findViewById<TextView>(R.id.tvModelViewerAnimalName)
        val tvScientific   = view.findViewById<TextView>(R.id.tvModelViewerScientific)
        val chipCategory   = view.findViewById<Chip>(R.id.chipModelViewerCategory)
        val chipDistance   = view.findViewById<Chip>(R.id.chipModelViewerDistance)
        val tvHabitat      = view.findViewById<TextView>(R.id.tvModelViewerHabitat)
        val btnSave        = view.findViewById<MaterialButton>(R.id.btnModelViewerSave)
        val btnClose       = view.findViewById<MaterialButton>(R.id.btnModelViewerClose)
        val fabBack        = view.findViewById<FloatingActionButton>(R.id.fabModelViewerBack)

        // ── Texto del animal ─────────────────────────────────────────
        tvName.text = animalName

        if (!scientific.isNullOrBlank()) {
            tvScientific.text = scientific
            tvScientific.visibility = View.VISIBLE
        }
        if (!category.isNullOrBlank()) {
            chipCategory.text = category
            chipCategory.visibility = View.VISIBLE
        }
        if (!habitat.isNullOrBlank()) {
            tvHabitat.text = "🌿 $habitat"
            tvHabitat.visibility = View.VISIBLE
        }
        if (distance != null) {
            val distText = if (distance < 1000) "${distance.roundToInt()} m" else "${"%.1f".format(distance / 1000)} km"
            chipDistance.text = "📍 $distText"
            chipDistance.visibility = View.VISIBLE
        }

        // ── Botón guardar ────────────────────────────────────────────
        val isInRange = distance != null && distance <= ENCOUNTER_RADIUS_METERS
        btnSave.isEnabled = isInRange && !alreadyFound
        btnSave.text = when {
            alreadyFound -> "✅ Ya guardado"
            isInRange    -> "⭐ ¡Guardar encuentro!"
            else         -> "🚶 Acércate más"
        }

        // ── Banner de estado game-style ──────────────────────────────
        when {
            alreadyFound -> {
                layoutBanner.setBackgroundColor(Color.parseColor("#2E7D32"))
                tvBannerText.text = "✅ ¡YA LO CAPTURASTE!"
                layoutBanner.visibility = View.VISIBLE
            }
            isInRange -> {
                layoutBanner.setBackgroundColor(Color.parseColor("#E65100"))
                tvBannerText.text = "🎯 ¡ANIMAL EN RANGO!"
                layoutBanner.visibility = View.VISIBLE
            }
            else -> layoutBanner.visibility = View.GONE
        }

        btnSave.setOnClickListener {
            // Return save result to ArMapFragment via back stack
            findNavController().previousBackStackEntry?.savedStateHandle?.apply {
                set(RESULT_SAVE_LOCATION_ID, locationId)
                set(RESULT_SAVE_ASSET_ID, assetId)
                set(RESULT_SAVE_ANIMAL_NAME, animalName)
            }
            btnSave.isEnabled = false
            btnSave.text = "✅ Guardado"
            // Actualizar banner a ¡capturado!
            layoutBanner.setBackgroundColor(Color.parseColor("#2E7D32"))
            tvBannerText.text = "✅ ¡YA LO CAPTURASTE!"
            layoutBanner.visibility = View.VISIBLE
        }

        btnClose.setOnClickListener { findNavController().popBackStack() }
        fabBack.setOnClickListener  { findNavController().popBackStack() }

        // ── Inicializar SceneView 3D (sin ARCore) ────────────────────
        try {
            val sv = SceneView(requireContext())
            // Let SceneView observe the fragment's lifecycle instead of calling onPause/onResume manually
            try {
                sv.lifecycle = viewLifecycleOwner.lifecycle
            } catch (e: Exception) {
                Timber.w(e, "ModelViewerFragment: unable to set SceneView.lifecycle — continuing without")
            }
            sv.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            sceneContainer.addView(sv)
            sceneView = sv

            // Cargar modelo 3D
            loadModel(sv, modelUrl) { success ->
                loadingOverlay.visibility = View.GONE
                infoCard.visibility = View.VISIBLE
                if (!success) {
                    Timber.w("ModelViewerFragment: modelo no encontrado, mostrando solo info")
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "ModelViewerFragment: SceneView no disponible en este dispositivo")
            loadingOverlay.visibility = View.GONE
            infoCard.visibility = View.VISIBLE
        }
    }

    /** Resuelve y carga el modelo GLB en el SceneView, con fallback a remote download. */
    private fun loadModel(sv: SceneView, modelUrl: String?, onDone: (Boolean) -> Unit) {
        if (modelUrl.isNullOrBlank()) {
            onDone(false)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val resolution = ModelResolver.resolve(requireContext(), modelUrl)
                Timber.d("ModelViewerFragment: cargando modelo $resolution")

                val instance = when (resolution) {
                    is ModelResolution.Local -> {
                        withContext(Dispatchers.Main) {
                            sv.modelLoader.loadModelInstance(resolution.assetPath)
                        }
                    }
                    is ModelResolution.Remote -> {
                        val fullUrl = ImageUrlHelper.buildUrl(resolution.url) ?: resolution.url
                        downloadAndLoad(sv, fullUrl)
                    }
                }

                if (instance != null) {
                    val node = ModelNode(
                        modelInstance = instance,
                        autoAnimate = true,
                        scaleToUnits = 1.0f,
                        centerOrigin = Position(y = -0.5f)
                    ).also {
                        it.isEditable = false
                    }
                    sv.addChildNode(node)
                    modelNode = node
                    startAutoRotation(node)
                    onDone(true)
                } else {
                    onDone(false)
                }
            } catch (e: Exception) {
                Timber.e(e, "ModelViewerFragment: error al cargar modelo")
                onDone(false)
            }
        }
    }

    /** Descarga el GLB desde la URL autenticada y crea un ModelInstance. */
    private suspend fun downloadAndLoad(sv: SceneView, url: String): io.github.sceneview.model.ModelInstance? {
        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(url).build()
                val response = ApiClient.instance.newCall(request).execute()
                if (!response.isSuccessful) return@withContext null
                val bytes = response.body?.bytes() ?: return@withContext null
                val buffer = ByteBuffer.allocateDirect(bytes.size).apply { put(bytes); rewind() }
                withContext(Dispatchers.Main) {
                    sv.modelLoader.createModelInstance(buffer)
                }
            } catch (e: Exception) {
                Timber.e(e, "ModelViewerFragment: descarga fallida desde $url")
                null
            }
        }
    }

    /** Inicia la rotación automática del modelo sobre el eje Y (360° en 8 s). */
    private fun startAutoRotation(node: ModelNode) {
        rotationAnimator?.cancel()
        rotationAnimator = ValueAnimator.ofFloat(0f, 360f).apply {
            duration = 8_000L
            repeatCount = ValueAnimator.INFINITE
            repeatMode  = ValueAnimator.RESTART
            interpolator = LinearInterpolator()
            addUpdateListener { anim ->
                node.rotation = Rotation(y = anim.animatedValue as Float)
            }
            start()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rotationAnimator?.cancel()
        rotationAnimator = null
        modelNode = null
        sceneView = null
    }

}
