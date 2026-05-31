package com.univalle.pedrochacolla.ui.armap

import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.floatingactionbutton.FloatingActionButton
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
 * AnimalDetailFragment — Detalle completo del animal, estilo Pokemon GO.
 *
 * Pantalla de encuentro inmersiva: modelo GLB girando en SceneView 3D
 * sobre el fondo del parque, con aureola de color por sección y panel
 * inferior con nombre, badges de tipo y botones de acción.
 *
 * Sustituye a [ModelViewerFragment] con una propuesta visual rediseñada.
 * Mismo contrato de argumentos y resultados para compatibilidad con
 * el back-stack de Navigation Component.
 *
 * Argumentos (Bundle):
 * - ARG_MODEL_URL      : String?  — ruta del modelo GLB
 * - ARG_ANIMAL_NAME    : String
 * - ARG_SCIENTIFIC     : String?
 * - ARG_CATEGORY       : String?
 * - ARG_HABITAT        : String?
 * - ARG_SECTION        : String?  — sección del parque (para colores)
 * - ARG_DESCRIPTION    : String?  — descripción / entrada enciclopédica
 * - ARG_DISPLAY_ORDER  : Int      — número visible (#001, #002 …)
 * - ARG_DISTANCE       : Double   — metros; < 0 significa "sin GPS"
 * - ARG_LOCATION_ID    : String?
 * - ARG_ASSET_ID       : String?
 * - ARG_ALREADY_FOUND  : Boolean
 *
 * Resultados (SavedStateHandle):
 * - RESULT_SAVE_LOCATION_ID
 * - RESULT_SAVE_ASSET_ID
 * - RESULT_SAVE_ANIMAL_NAME
 */
@AndroidEntryPoint
class AnimalDetailFragment : Fragment() {

    // ─────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────

    companion object {
        // Argument keys
        const val ARG_MODEL_URL     = "ad_model_url"
        const val ARG_ANIMAL_NAME   = "ad_animal_name"
        const val ARG_SCIENTIFIC    = "ad_scientific"
        const val ARG_CATEGORY      = "ad_category"
        const val ARG_HABITAT       = "ad_habitat"
        const val ARG_SECTION       = "ad_section"
        const val ARG_DESCRIPTION   = "ad_description"
        const val ARG_DISPLAY_ORDER = "ad_display_order"
        const val ARG_DISTANCE      = "ad_distance"
        const val ARG_LOCATION_ID   = "ad_location_id"
        const val ARG_ASSET_ID      = "ad_asset_id"
        const val ARG_ALREADY_FOUND = "ad_already_found"

        // Result keys — usan los mismos strings que ModelViewerFragment para que
        // ArMapFragment.observeModelViewerResult() los capture sin cambios.
        const val RESULT_SAVE_LOCATION_ID = "mv_result_location_id"
        const val RESULT_SAVE_ASSET_ID    = "mv_result_asset_id"
        const val RESULT_SAVE_ANIMAL_NAME = "mv_result_animal_name"

        /** Helper para construir el Bundle de argumentos desde el sitio de llamada. */
        fun args(
            modelUrl: String?,
            animalName: String,
            scientificName: String?,
            category: String?,
            habitat: String?,
            section: String?,
            description: String?,
            displayOrder: Int,
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
            putString(ARG_SECTION, section)
            putString(ARG_DESCRIPTION, description)
            putInt(ARG_DISPLAY_ORDER, displayOrder)
            putDouble(ARG_DISTANCE, distanceMeters ?: -1.0)
            putString(ARG_LOCATION_ID, locationId)
            putString(ARG_ASSET_ID, assetId)
            putBoolean(ARG_ALREADY_FOUND, alreadyFound)
        }

        // ── Paleta de colores por sección ─────────────────────────────

        /** Color de acento sólido para badges y divider según la sección. */
        fun accentColorFor(section: String?): Int = when {
            section == null                              -> Color.parseColor("#D9B992")
            section.contains("Altas",  ignoreCase=true) -> Color.parseColor("#66BB6A")
            section.contains("Medias", ignoreCase=true) -> Color.parseColor("#FFA726")
            section.contains("Bajas",  ignoreCase=true) -> Color.parseColor("#26A69A")
            section.contains("Mitos",  ignoreCase=true) -> Color.parseColor("#AB47BC")
            else                                         -> Color.parseColor("#D9B992")
        }

        /** Color de relleno oscuro para el badge de tipo (más rico que solo el acento). */
        private fun badgeFillFor(section: String?): Int = when {
            section == null                              -> Color.parseColor("#4A3428")
            section.contains("Altas",  ignoreCase=true) -> Color.parseColor("#1B5E20")
            section.contains("Medias", ignoreCase=true) -> Color.parseColor("#BF360C")
            section.contains("Bajas",  ignoreCase=true) -> Color.parseColor("#004D40")
            section.contains("Mitos",  ignoreCase=true) -> Color.parseColor("#4A148C")
            else                                         -> Color.parseColor("#4A3428")
        }

        /** Color central de la aureola radial detrás del modelo 3D. */
        private fun glowColorFor(section: String?): Int = when {
            section == null                              -> Color.parseColor("#D9B992")
            section.contains("Altas",  ignoreCase=true) -> Color.parseColor("#4CAF50")
            section.contains("Medias", ignoreCase=true) -> Color.parseColor("#FF9800")
            section.contains("Bajas",  ignoreCase=true) -> Color.parseColor("#00BCD4")
            section.contains("Mitos",  ignoreCase=true) -> Color.parseColor("#9C27B0")
            else                                         -> Color.parseColor("#D9B992")
        }

        /** Etiqueta abreviada para el badge de sección (uppercase, 10 chars max). */
        private fun sectionLabel(section: String?): String? = when {
            section == null                              -> null
            section.contains("Altas",  ignoreCase=true) -> "T. ALTAS"
            section.contains("Medias", ignoreCase=true) -> "T. MEDIAS"
            section.contains("Bajas",  ignoreCase=true) -> "T. BAJAS"
            section.contains("Mitos",  ignoreCase=true) -> "MITOS"
            else                                         -> section.uppercase().take(10)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────

    private var sceneView: SceneView? = null
    private var rotationAnimator: ValueAnimator? = null
    private var modelNode: ModelNode? = null

    // ─────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_animal_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // ── Extrae todos los argumentos ───────────────────────────────
        val args         = requireArguments()
        val modelUrl     = args.getString(ARG_MODEL_URL)
        val animalName   = args.getString(ARG_ANIMAL_NAME) ?: "Animal"
        val scientific   = args.getString(ARG_SCIENTIFIC)
        val category     = args.getString(ARG_CATEGORY)
        val habitat      = args.getString(ARG_HABITAT)
        val section      = args.getString(ARG_SECTION)
        val displayOrder = args.getInt(ARG_DISPLAY_ORDER, 0)
        val distance     = args.getDouble(ARG_DISTANCE).takeIf { it >= 0 }
        val locationId   = args.getString(ARG_LOCATION_ID)
        val assetId      = args.getString(ARG_ASSET_ID)
        val alreadyFound = args.getBoolean(ARG_ALREADY_FOUND, false)

        // ── Referencias a vistas ──────────────────────────────────────
        val sceneContainer = view.findViewById<FrameLayout>(R.id.adSceneContainer)
        val loadingOverlay = view.findViewById<FrameLayout>(R.id.adLoadingOverlay)
        val capturedBadge  = view.findViewById<LinearLayout>(R.id.adCapturedBadge)
        val fabBack        = view.findViewById<FloatingActionButton>(R.id.adFabBack)
        val infoPanel      = view.findViewById<LinearLayout>(R.id.adInfoPanel)
        val tvName         = view.findViewById<TextView>(R.id.adAnimalName)
        val tvScientific   = view.findViewById<TextView>(R.id.adScientificName)
        val tvOrder        = view.findViewById<TextView>(R.id.adDisplayOrder)
        val accentBar      = view.findViewById<View>(R.id.adAccentBar)
        val tvBadgeCat     = view.findViewById<TextView>(R.id.adBadgeCategory)
        val tvBadgeSec     = view.findViewById<TextView>(R.id.adBadgeSection)
        val tvBadgeDist    = view.findViewById<TextView>(R.id.adBadgeDistance)
        val habitatRow     = view.findViewById<View>(R.id.adHabitatRow)
        val tvHabitat      = view.findViewById<TextView>(R.id.adHabitatValue)
        val tvRangeHint    = view.findViewById<TextView>(R.id.adRangeHint)
        val btnSave        = view.findViewById<MaterialButton>(R.id.adBtnSave)
        val btnClose       = view.findViewById<MaterialButton>(R.id.adBtnClose)

        // ── Colores de la sección del animal ─────────────────────────
        val accentColor = accentColorFor(section)
        val badgeFill   = badgeFillFor(section)

        // ── Aureola radial detrás del modelo (inyectada como primera capa) ──
        insertGlowCircle(sceneContainer, section)

        // ── Textos del panel inferior ─────────────────────────────────
        tvName.text = animalName

        if (!scientific.isNullOrBlank()) {
            tvScientific.text = scientific
            tvScientific.visibility = View.VISIBLE
        }

        if (displayOrder > 0) {
            tvOrder.text = "#%03d".format(displayOrder)
            tvOrder.visibility = View.VISIBLE
        }

        // ── Barra de acento de sección ────────────────────────────────
        accentBar.setBackgroundColor(accentColor)

        // ── Badges de tipo (pills sólidas estilo Pokemon GO) ─────────
        styleBadge(tvBadgeCat, badgeFill, accentColor)
        styleBadge(tvBadgeSec, badgeFill, accentColor)
        styleBadge(tvBadgeDist, badgeFill, accentColor)

        if (!category.isNullOrBlank()) {
            tvBadgeCat.text = category.uppercase()
            tvBadgeCat.visibility = View.VISIBLE
        }

        val sectionTag = sectionLabel(section)
        if (sectionTag != null) {
            tvBadgeSec.text = sectionTag
            tvBadgeSec.visibility = View.VISIBLE
        }

        if (distance != null) {
            val distText = if (distance < 1000) "${distance.roundToInt()} m"
                           else "${"%.1f".format(distance / 1000)} km"
            tvBadgeDist.text = distText
            tvBadgeDist.visibility = View.VISIBLE
        }

        // ── Hábitat ───────────────────────────────────────────────────
        if (!habitat.isNullOrBlank()) {
            tvHabitat.text = habitat
            habitatRow.visibility = View.VISIBLE
        }

        // ── Estado: capturado / en rango / fuera de rango ─────────────
        val isInRange = distance != null && distance <= ENCOUNTER_RADIUS_METERS

        when {
            alreadyFound -> {
                capturedBadge.visibility = View.VISIBLE
                btnSave.isEnabled = false
                btnSave.text = "Ya guardado"
                (btnSave.background as? GradientDrawable)?.setColor(Color.parseColor("#2E7D32"))
                btnSave.backgroundTintList =
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#2E7D32"))
            }
            isInRange -> {
                capturedBadge.visibility = View.GONE
                btnSave.isEnabled = true
                btnSave.text = "Guardar encuentro"
            }
            else -> {
                capturedBadge.visibility = View.GONE
                btnSave.isEnabled = false
                btnSave.text = "Guardar encuentro"
                val remaining = if (distance != null)
                    " (${(distance - ENCOUNTER_RADIUS_METERS).roundToInt()} m mas)"
                else ""
                tvRangeHint.text = "Debes estar a menos de ${ENCOUNTER_RADIUS_METERS.toInt()} m del animal$remaining"
                tvRangeHint.visibility = View.VISIBLE
            }
        }

        // ── Botón guardar ─────────────────────────────────────────────
        btnSave.setOnClickListener {
            // Publica el resultado en el back-stack para que ArMapFragment lo procese
            findNavController().previousBackStackEntry?.savedStateHandle?.apply {
                set(RESULT_SAVE_LOCATION_ID, locationId)
                set(RESULT_SAVE_ASSET_ID, assetId)
                set(RESULT_SAVE_ANIMAL_NAME, animalName)
            }
            btnSave.isEnabled = false
            btnSave.text = "Guardado"
            btnSave.backgroundTintList =
                android.content.res.ColorStateList.valueOf(Color.parseColor("#2E7D32"))
            capturedBadge.visibility = View.VISIBLE
        }

        btnClose.setOnClickListener { findNavController().popBackStack() }
        fabBack.setOnClickListener  { findNavController().popBackStack() }

        // ── SceneView 3D ──────────────────────────────────────────────
        try {
            val sv = SceneView(requireContext())
            try { sv.lifecycle = viewLifecycleOwner.lifecycle } catch (_: Exception) {}
            sv.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            sceneContainer.addView(sv)
            sceneView = sv

            loadModel(sv, modelUrl) { success ->
                loadingOverlay.visibility = View.GONE
                infoPanel.visibility = View.VISIBLE
                if (!success) {
                    Timber.w("AnimalDetailFragment: modelo no disponible")
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "AnimalDetailFragment: SceneView no compatible con este dispositivo")
            loadingOverlay.visibility = View.GONE
            infoPanel.visibility = View.VISIBLE
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rotationAnimator?.cancel()
        rotationAnimator = null
        modelNode = null
        sceneView = null
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Inserta un círculo de gradiente radial como primera capa del contenedor
     * del modelo 3D, usando el color de la sección del animal.
     * El círculo queda centrado y ocupa el 80 % del ancho de la pantalla.
     */
    private fun insertGlowCircle(container: FrameLayout, section: String?) {
        val glow = glowColorFor(section)
        val r = Color.red(glow)
        val g = Color.green(glow)
        val b = Color.blue(glow)
        val displayWidth = resources.displayMetrics.widthPixels
        val size = (displayWidth * 0.80f).toInt()

        val glowDrawable = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            gradientType = GradientDrawable.RADIAL_GRADIENT
            gradientRadius = size / 2f
            colors = intArrayOf(
                Color.argb(90, r, g, b),  // centro: semi-transparente
                Color.argb(30, r, g, b),  // medio: suave
                Color.argb(0,  r, g, b)   // borde: transparente
            )
        }

        val glowView = View(requireContext()).apply {
            background = glowDrawable
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = android.view.Gravity.CENTER
            }
        }

        // Inserta ANTES del SceneView (que se añade después)
        container.addView(glowView, 0)
    }

    /**
     * Aplica fondo de pill redondeada a un TextView de badge.
     * El relleno usa el color de sección con alpha 0xCC y borde con el acento.
     */
    private fun styleBadge(badge: TextView, fillColor: Int, strokeColor: Int) {
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 20f.dpToPx()
            setColor(fillColor)
            setStroke(1f.dpToPx().toInt(), Color.argb(160,
                Color.red(strokeColor), Color.green(strokeColor), Color.blue(strokeColor)))
        }
        badge.background = bg
    }

    /** Convierte dp a px usando la densidad de pantalla del contexto. */
    private fun Float.dpToPx(): Float =
        this * resources.displayMetrics.density

    /** Carga el modelo GLB (local o remoto) en el SceneView y llama al callback al terminar. */
    private fun loadModel(sv: SceneView, modelUrl: String?, onDone: (Boolean) -> Unit) {
        if (modelUrl.isNullOrBlank()) { onDone(false); return }

        viewLifecycleOwner.lifecycleScope.launch {
            runCatching {
                val resolution = ModelResolver.resolve(requireContext(), modelUrl)
                Timber.d("AnimalDetailFragment: cargando $resolution")

                val instance = when (resolution) {
                    is ModelResolution.Local -> withContext(Dispatchers.Main) {
                        sv.modelLoader.loadModelInstance(resolution.assetPath)
                    }
                    is ModelResolution.Remote -> {
                        val fullUrl = ImageUrlHelper.buildUrl(resolution.url) ?: resolution.url
                        downloadAndLoad(sv, fullUrl)
                    }
                }

                instance?.let { inst ->
                    val node = ModelNode(
                        modelInstance = inst,
                        autoAnimate   = true,
                        scaleToUnits  = 1.0f,
                        centerOrigin  = Position(y = -0.5f)
                    ).also { it.isEditable = false }
                    sv.addChildNode(node)
                    modelNode = node
                    startAutoRotation(node)
                }
                instance != null
            }.getOrElse { e ->
                Timber.e(e, "AnimalDetailFragment: error al cargar modelo")
                false
            }.also { success -> onDone(success) }
        }
    }

    /** Descarga el GLB desde la URL autenticada y lo convierte en ModelInstance. */
    private suspend fun downloadAndLoad(sv: SceneView, url: String): io.github.sceneview.model.ModelInstance? =
        withContext(Dispatchers.IO) {
            runCatching {
                val request  = Request.Builder().url(url).build()
                val response = ApiClient.instance.newCall(request).execute()
                if (!response.isSuccessful) return@withContext null
                val bytes  = response.body?.bytes() ?: return@withContext null
                val buffer = ByteBuffer.allocateDirect(bytes.size).apply { put(bytes); rewind() }
                withContext(Dispatchers.Main) {
                    sv.modelLoader.createModelInstance(buffer)
                }
            }.getOrElse { e ->
                Timber.e(e, "AnimalDetailFragment: descarga fallida $url")
                null
            }
        }

    /** Inicia la rotación automática del modelo sobre el eje Y (8 segundos por vuelta). */
    private fun startAutoRotation(node: ModelNode) {
        rotationAnimator?.cancel()
        rotationAnimator = ValueAnimator.ofFloat(0f, 360f).apply {
            duration     = 8_000L
            repeatCount  = ValueAnimator.INFINITE
            repeatMode   = ValueAnimator.RESTART
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener { anim ->
                node.rotation = Rotation(y = anim.animatedValue as Float)
            }
            start()
        }
    }
}
