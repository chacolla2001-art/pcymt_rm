package com.univalle.pedrochacolla.ui.armap

import android.animation.ValueAnimator
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import com.google.android.material.button.MaterialButton
import com.bumptech.glide.Glide
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.card.MaterialCardView
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import androidx.lifecycle.lifecycleScope
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

/**
 * AnimalEncounterBottomSheet — Hoja de encuentro al estilo Pokémon Go.
 *
 * Se muestra al tocar el marcador de un animal en el mapa.
 * Muestra la información del animal y permite guardarlo si está a rango.
 */
class AnimalEncounterBottomSheet : BottomSheetDialogFragment() {

    companion object {
        const val TAG = "AnimalEncounterBottomSheet"

        private const val ARG_LOCATION_ID     = "location_id"
        private const val ARG_ASSET_ID        = "asset_id"
        private const val ARG_ANIMAL_NAME     = "animal_name"
        private const val ARG_SCIENTIFIC_NAME = "scientific_name"
        private const val ARG_CATEGORY        = "category"
        private const val ARG_HABITAT         = "habitat"
        private const val ARG_SECTION         = "section"
        private const val ARG_ICON_URL        = "icon_url"
        private const val ARG_MODEL_URL       = "model_url"
        private const val ARG_DISTANCE        = "distance_meters"
        private const val ARG_ALREADY_FOUND   = "already_found"
        private const val ARG_FROM_AR          = "from_ar"

        /**
         * Crea una instancia con todos los datos del animal.
         */
        fun newInstance(lwa: LocationWithAsset): AnimalEncounterBottomSheet {
            return AnimalEncounterBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_LOCATION_ID, lwa.location.id)
                    putString(ARG_ASSET_ID, lwa.asset?.id)
                    putString(ARG_ANIMAL_NAME, lwa.asset?.name ?: lwa.location.name)
                    putString(ARG_SCIENTIFIC_NAME, lwa.asset?.scientificName)
                    putString(ARG_CATEGORY, lwa.asset?.category)
                    putString(ARG_HABITAT, lwa.asset?.habitat)
                    putString(ARG_SECTION, lwa.location.section)
                    putString(ARG_ICON_URL, lwa.asset?.iconUrl)
                    putString(ARG_MODEL_URL, lwa.asset?.modelUrl)
                    lwa.distanceMeters?.let { putDouble(ARG_DISTANCE, it) }
                    putBoolean(ARG_ALREADY_FOUND, lwa.alreadyFound)
                }
            }
        }

        /**
         * Crea una instancia desde AR (Realidad Mixta).
         * No muestra el modelo 3D girando y muestra botón "Regresar" en vez de "Ver en Realidad Mixta".
         */
        fun newInstanceFromAr(
            location: com.univalle.pedrochacolla.data.model.Location,
            asset: com.univalle.pedrochacolla.data.model.VirtualAsset?,
            alreadyFound: Boolean
        ): AnimalEncounterBottomSheet {
            return AnimalEncounterBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_LOCATION_ID, location.id)
                    putString(ARG_ASSET_ID, asset?.id)
                    putString(ARG_ANIMAL_NAME, asset?.name ?: location.name)
                    putString(ARG_SCIENTIFIC_NAME, asset?.scientificName)
                    putString(ARG_CATEGORY, asset?.category)
                    putString(ARG_HABITAT, asset?.habitat)
                    putString(ARG_SECTION, location.section)
                    putString(ARG_ICON_URL, asset?.iconUrl)
                    putString(ARG_MODEL_URL, asset?.modelUrl)
                    putBoolean(ARG_ALREADY_FOUND, alreadyFound)
                    putBoolean(ARG_FROM_AR, true)
                }
            }
        }

        /**
         * Devuelve el par de colores [start, end] del gradiente según la sección del animal.
         */
        private fun gradientColorsForSection(section: String?): Pair<Int, Int> = when {
            section == null                              -> Pair(Color.parseColor("#2C1810"), Color.parseColor("#4A3428"))
            section.contains("Altas",  ignoreCase=true) -> Pair(Color.parseColor("#1B3A1B"), Color.parseColor("#2D5A2D"))
            section.contains("Medias", ignoreCase=true) -> Pair(Color.parseColor("#4A2800"), Color.parseColor("#7A4400"))
            section.contains("Bajas",  ignoreCase=true) -> Pair(Color.parseColor("#004030"), Color.parseColor("#005C44"))
            section.contains("Mitos",  ignoreCase=true) -> Pair(Color.parseColor("#1E104A"), Color.parseColor("#3D1F7A"))
            else                                         -> Pair(Color.parseColor("#2C1810"), Color.parseColor("#4A3428"))
        }

        /** Color de borde del card según la sección. */
        private fun accentColorForSection(section: String?): Int = when {
            section == null                              -> Color.parseColor("#D9B992")
            section.contains("Altas",  ignoreCase=true) -> Color.parseColor("#66BB6A")
            section.contains("Medias", ignoreCase=true) -> Color.parseColor("#FFA726")
            section.contains("Bajas",  ignoreCase=true) -> Color.parseColor("#26A69A")
            section.contains("Mitos",  ignoreCase=true) -> Color.parseColor("#AB47BC")
            else                                         -> Color.parseColor("#D9B992")
        }
    }

    /** Listener para que el Fragment padre maneje la acción de guardar */
    var onSaveEncounter: ((locationId: String?, assetId: String?, animalName: String) -> Unit)? = null

    /**
     * Listener para abrir el visor 3D completo del animal.
     * Parámetros: modelUrl, animalName, scientificName, category, habitat, distance, locationId, assetId, alreadyFound
     */
    var onViewIn3D: ((
        modelUrl: String?,
        animalName: String,
        scientificName: String?,
        category: String?,
        habitat: String?,
        distance: Double?,
        locationId: String?,
        assetId: String?,
        alreadyFound: Boolean
    ) -> Unit)? = null

    /** true si el dispositivo es compatible con ARCore/Realidad Mixta */
    var isArCompatible: Boolean = false

    /** true cuando el usuario es admin — desbloquea el botón de guardar sin importar la distancia */
    var isAdminMode: Boolean = false

    private var sceneView3D: SceneView? = null
    private var rotationAnimator: ValueAnimator? = null

    /** Listener para navegar directamente a Realidad Mixta */
    var onGoToArMixto: (() -> Unit)? = null

    /** Listener para el botón "Regresar" (cuando se abre desde AR) */
    var onGoBack: (() -> Unit)? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.bottom_sheet_animal_encounter, container, false)

    override fun onStart() {
        super.onStart()
        // Pantalla completa: ventana MATCH_PARENT + sheet expandido sin fondo
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        (dialog as? BottomSheetDialog)?.let { bsd ->
            val sheet = bsd.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
            sheet?.setBackgroundResource(android.R.color.transparent)
            sheet?.let {
                it.layoutParams?.height = ViewGroup.LayoutParams.MATCH_PARENT
                it.requestLayout()
                val behavior = BottomSheetBehavior.from(it)
                behavior.state = BottomSheetBehavior.STATE_EXPANDED
                behavior.skipCollapsed = true
                behavior.isDraggable = false
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val args           = requireArguments()
        val locationId    = args.getString(ARG_LOCATION_ID)
        val assetId       = args.getString(ARG_ASSET_ID)
        val animalName    = args.getString(ARG_ANIMAL_NAME) ?: "Animal"
        val scientificName= args.getString(ARG_SCIENTIFIC_NAME)
        val category      = args.getString(ARG_CATEGORY)
        val habitat       = args.getString(ARG_HABITAT)
        val section       = args.getString(ARG_SECTION)
        val iconUrl       = args.getString(ARG_ICON_URL)
        val modelUrl      = args.getString(ARG_MODEL_URL)
        val distance      = if (args.containsKey(ARG_DISTANCE)) args.getDouble(ARG_DISTANCE) else null
        val alreadyFound  = args.getBoolean(ARG_ALREADY_FOUND, false)
        val isFromAr      = args.getBoolean(ARG_FROM_AR, false)

        // ── Vistas ──────────────────────────────────────────────────
        val headerSection   = view.findViewById<View>(R.id.headerSection)
        val tvCapturedBadge = view.findViewById<TextView>(R.id.tvCapturedBadge)
        val cardIcon        = view.findViewById<MaterialCardView>(R.id.cardEncounterIcon)
        val ivAnimalIcon    = view.findViewById<ImageView>(R.id.ivEncounterIcon)
        val sceneContainer  = view.findViewById<FrameLayout>(R.id.sceneContainer3D)
        val tvAnimalName    = view.findViewById<TextView>(R.id.tvEncounterAnimalName)
        val tvScientific    = view.findViewById<TextView>(R.id.tvEncounterScientific)
        val rowCategory     = view.findViewById<View>(R.id.rowCategory)
        val tvCategory      = view.findViewById<TextView>(R.id.tvEncounterCategory)
        val cellSection     = view.findViewById<View>(R.id.cellSection)
        val tvSectionName   = view.findViewById<TextView>(R.id.tvSection)
        val cellDistance    = view.findViewById<View>(R.id.chipEncounterDistance)
        val tvDistValue     = view.findViewById<TextView>(R.id.tvEncounterDistanceValue)
        val rowHabitat      = view.findViewById<View>(R.id.rowHabitat)
        val tvHabitat       = view.findViewById<TextView>(R.id.tvEncounterHabitat)
        val tvRangeHint     = view.findViewById<TextView>(R.id.tvEncounterRangeHint)
        val btnSave         = view.findViewById<Button>(R.id.btnSaveEncounter)
        val btnView3D       = view.findViewById<MaterialButton>(R.id.btnViewIn3D)
        val btnArMixto      = view.findViewById<MaterialButton>(R.id.btnGoToArMixto)

        // Cerrar modal
        view.findViewById<ImageButton>(R.id.btnCloseSheet)?.setOnClickListener { dismiss() }

        // ── Gradiente del header según sección ───────────────────────
        val (colorStart, colorEnd) = gradientColorsForSection(section)
        val accentColor            = accentColorForSection(section)
        val headerGradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(colorStart, colorEnd)
        ).also { it.cornerRadii = floatArrayOf(16f, 16f, 16f, 16f, 0f, 0f, 0f, 0f) }
        headerSection.background = headerGradient
        cardIcon.strokeColor = accentColor

        // Barra de acento debajo del nombre (color de sección)
        view.findViewById<View>(R.id.dividerInfoCard)?.let { bar ->
            val accentShape = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 8f
                setColor(accentColor)
            }
            bar.background = accentShape
        }

        // ── Imagen del animal (fallback 2D si no hay modelo 3D) ───────────────────
        if (!iconUrl.isNullOrBlank()) {
            Glide.with(this)
                .load(ImageUrlHelper.buildUrl(iconUrl))
                .placeholder(R.drawable.ic_profile_placeholder)
                .error(R.drawable.ic_profile_placeholder)
                .centerInside()
                .into(ivAnimalIcon)
        }

        // ── Visor 3D en el hero (se omite cuando se abre desde AR) ────────────────
        if (!isFromAr && !modelUrl.isNullOrBlank() && sceneContainer != null) {
            try {
                val sv = SceneView(requireContext())
                try { sv.lifecycle = viewLifecycleOwner.lifecycle } catch (_: Exception) {}
                sv.layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
                sceneContainer.addView(sv)
                sceneView3D = sv

                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        val instance = load3DModel(sv, modelUrl)
                        if (instance != null) {
                            val node = ModelNode(
                                modelInstance = instance,
                                autoAnimate = true,
                                scaleToUnits = 1.0f,
                                centerOrigin = Position(y = 0f)
                            ).also { it.isEditable = false }
                            withContext(Dispatchers.Main) {
                                sv.addChildNode(node)
                                cardIcon.visibility = View.GONE
                                sceneContainer.visibility = View.VISIBLE
                                // Auto-rotation
                                rotationAnimator = ValueAnimator.ofFloat(0f, 360f).apply {
                                    duration = 8_000L
                                    repeatCount = ValueAnimator.INFINITE
                                    interpolator = LinearInterpolator()
                                    addUpdateListener { anim ->
                                        node.rotation = Rotation(y = anim.animatedValue as Float)
                                    }
                                    start()
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Timber.w(e, "AnimalEncounterBottomSheet: 3D load failed, using icon fallback")
                    }
                }
            } catch (e: Exception) {
                Timber.w(e, "AnimalEncounterBottomSheet: SceneView init failed")
            }
        }

        // ── Textos ───────────────────────────────────────────────────
        tvAnimalName.text = animalName
        tvScientific.text = scientificName ?: ""
        tvScientific.visibility = if (scientificName.isNullOrBlank()) View.GONE else View.VISIBLE

        if (!category.isNullOrBlank()) {
            tvCategory.text = category
            rowCategory.visibility = View.VISIBLE
        } else {
            rowCategory.visibility = View.GONE
        }

        if (!section.isNullOrBlank()) {
            tvSectionName.text = section
            cellSection.visibility = View.VISIBLE
        } else {
            cellSection.visibility = View.GONE
        }

        if (!habitat.isNullOrBlank()) {
            tvHabitat.text = habitat
            rowHabitat.visibility = View.VISIBLE
        } else {
            rowHabitat.visibility = View.GONE
        }

        // ── Distancia ────────────────────────────────────────────────
        if (distance != null) {
            val distText = if (distance < 1000) "${distance.roundToInt()} m"
                           else "${"%.1f".format(distance / 1000)} km"
            tvDistValue.text = distText
            cellDistance.visibility = View.VISIBLE
        } else {
            cellDistance.visibility = View.GONE
        }

        // ── Estado: ya encontrado / en rango / fuera de rango (admin siempre puede guardar) ──
        // Desde AR el usuario ya está cerca del ancla, así que siempre puede guardar.
        val isInRange = isFromAr || (distance != null && distance <= ENCOUNTER_RADIUS_METERS)

        when {
            alreadyFound -> {
                tvCapturedBadge.visibility = View.VISIBLE
                cardIcon.strokeColor = Color.parseColor("#00C853")
                btnSave.isEnabled = false
                btnSave.text = "Ya guardado"
                tvRangeHint.visibility = View.GONE
            }
            isInRange || isAdminMode -> {
                tvCapturedBadge.visibility = View.GONE
                cardIcon.strokeColor = Color.parseColor("#FF6D00")
                btnSave.isEnabled = true
                btnSave.text = if (isAdminMode && !isInRange) "Guardar (Admin)" else "Guardar encuentro"
                tvRangeHint.visibility = View.GONE
            }
            else -> {
                tvCapturedBadge.visibility = View.GONE
                btnSave.isEnabled = false
                btnSave.text = "Acercate mas"
                val remaining = if (distance != null) {
                    " (${(distance - ENCOUNTER_RADIUS_METERS).roundToInt()} m más)"
                } else ""
                tvRangeHint.text = "Debes estar a menos de ${ENCOUNTER_RADIUS_METERS.toInt()} m$remaining"
                tvRangeHint.visibility = View.VISIBLE
            }
        }
        // ── Botón contextual: Realidad Mixta o Regresar ───────────────────────
        if (isFromAr) {
            // Desde AR: mostrar botón "Regresar" que cierra la ventana
            btnArMixto.visibility = View.VISIBLE
            btnArMixto.text = "Regresar"
            btnArMixto.setIconResource(R.drawable.ic_arrow_back)
            btnArMixto.setOnClickListener {
                onGoBack?.invoke()
                dismiss()
            }
        } else {
            // Desde el mapa: mostrar "Ver en Realidad Mixta" si es compatible
            btnArMixto.visibility = if (isArCompatible) View.VISIBLE else View.GONE
            btnArMixto.setOnClickListener {
                onGoToArMixto?.invoke()
                dismiss()
            }
        }
        // ── Ver modelo 3D ────────────────────────────────────────────
        btnView3D.setOnClickListener {
            onViewIn3D?.invoke(
                modelUrl, animalName, scientificName, category, habitat,
                distance, locationId, assetId, alreadyFound
            )
            dismiss()
        }

        // ── Acción de guardar ────────────────────────────────────────
        btnSave.setOnClickListener {
            onSaveEncounter?.invoke(locationId, assetId, animalName)
            dismiss()
        }
    }

    /**
     * Carga el modelo GLB desde assets locales o URL remota autenticada.
     * Retorna null si la carga falla (el fallback icon se mostrará).
     */
    private suspend fun load3DModel(
        sv: SceneView,
        modelUrl: String
    ): io.github.sceneview.model.ModelInstance? {
        return try {
            val resolution = ModelResolver.resolve(requireContext(), modelUrl)
            when (resolution) {
                is ModelResolution.Local -> withContext(Dispatchers.Main) {
                    sv.modelLoader.loadModelInstance(resolution.assetPath)
                }
                is ModelResolution.Remote -> {
                    val fullUrl = ImageUrlHelper.buildUrl(resolution.url) ?: resolution.url
                    withContext(Dispatchers.IO) {
                        val request = Request.Builder().url(fullUrl).build()
                        val response = ApiClient.instance.newCall(request).execute()
                        if (!response.isSuccessful) return@withContext null
                        val bytes = response.body?.bytes() ?: return@withContext null
                        val buffer = ByteBuffer.allocateDirect(bytes.size).apply {
                            put(bytes); rewind()
                        }
                        withContext(Dispatchers.Main) {
                            sv.modelLoader.createModelInstance(buffer)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Timber.w(e, "AnimalEncounterBottomSheet: load3DModel error for $modelUrl")
            null
        }
    }

    /**
     * Actualiza el banner y el botón para reflejar que el encuentro fue guardado.
     * Se llama desde el Fragment padre al recibir [EncounterSaveState.Success].
     */
    fun markAsSaved() {
        view?.let { v ->
            val tvCapturedBadge = v.findViewById<TextView>(R.id.tvCapturedBadge)
            val cardIcon        = v.findViewById<MaterialCardView>(R.id.cardEncounterIcon)
            val btnSave         = v.findViewById<Button>(R.id.btnSaveEncounter)
            val tvHint          = v.findViewById<TextView>(R.id.tvEncounterRangeHint)

            tvCapturedBadge?.visibility = View.VISIBLE
            cardIcon?.strokeColor = Color.parseColor("#00C853")
            btnSave?.isEnabled = false
            btnSave?.text = "Ya guardado"
            tvHint?.visibility = View.GONE
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rotationAnimator?.cancel()
        rotationAnimator = null
        sceneView3D = null
    }
}
