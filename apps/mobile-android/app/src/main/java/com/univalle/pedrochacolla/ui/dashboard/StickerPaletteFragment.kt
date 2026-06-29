package com.univalle.pedrochacolla.ui.dashboard

import android.app.AlertDialog
import android.app.Dialog
import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.slider.Slider
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.STICKER_CATALOG
import com.univalle.pedrochacolla.data.model.StickerDefinition

/**
 * Bottom sheet with sticker catalog grid and property editors.
 * Uses [StickerEditState] from the manager to control UI enable/disable.
 * Turns off edit mode when the palette is dismissed.
 */
class StickerPaletteFragment : BottomSheetDialogFragment() {

    /** Must be set before showing */
    var stickerManager: StickerManager? = null

    /** Called when edit mode changes */
    var onEditModeChanged: ((Boolean) -> Unit)? = null

    /** Called when the map should refresh */
    var onMapInvalidate: (() -> Unit)? = null

    private var adapter: StickerAdapter? = null
    private var switchEditMode: MaterialSwitch? = null
    private var propertiesPanel: View? = null
    private var sliderScale: Slider? = null
    private var sliderRotation: Slider? = null
    private var sliderOpacity: Slider? = null
    private var tvScaleValue: TextView? = null
    private var tvRotationValue: TextView? = null
    private var tvOpacityValue: TextView? = null
    private var tvSelectedName: TextView? = null
    private var btnDelete: View? = null
    private var tvStatusHint: TextView? = null
    private var filteredCatalog = STICKER_CATALOG.toMutableList()
    /** Saved reference to previous listener (from DashboardFragment) so we can restore it */
    private var previousChangeListener: (() -> Unit)? = null

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.behavior.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            peekHeight = 400
            isHideable = true
        }
        return dialog
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.fragment_sticker_palette, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val mgr = stickerManager ?: run {
            dismiss()
            return
        }

        // === Bind views ===
        switchEditMode = view.findViewById(R.id.switch_edit_mode)
        propertiesPanel = view.findViewById(R.id.sticker_properties_panel)
        tvSelectedName = view.findViewById(R.id.tv_selected_sticker_name)
        sliderScale = view.findViewById(R.id.slider_scale)
        sliderRotation = view.findViewById(R.id.slider_rotation)
        sliderOpacity = view.findViewById(R.id.slider_opacity)
        tvScaleValue = view.findViewById(R.id.tv_scale_value)
        tvRotationValue = view.findViewById(R.id.tv_rotation_value)
        tvOpacityValue = view.findViewById(R.id.tv_opacity_value)
        btnDelete = view.findViewById(R.id.btn_delete_sticker)
        tvStatusHint = view.findViewById(R.id.tv_status_hint)

        // === Edit mode switch — fix visibility on dark background ===
        switchEditMode?.apply {
            thumbTintList = android.content.res.ColorStateList.valueOf(Color.WHITE)
            trackTintList = android.content.res.ColorStateList(
                arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
                intArrayOf(0xFF2196F3.toInt(), 0xFF666666.toInt())
            )
        }
        switchEditMode?.isChecked = mgr.editMode
        switchEditMode?.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                mgr.enterEditMode()
            } else {
                mgr.exitEditMode()
            }
            onEditModeChanged?.invoke(isChecked)
            updateUI()
        }

        // === Search ===
        val etSearch = view.findViewById<EditText>(R.id.et_search_sticker)
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { filterCatalog(s?.toString() ?: "") }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // === Sticker grid ===
        val rvGrid = view.findViewById<RecyclerView>(R.id.rv_sticker_grid)
        rvGrid.layoutManager = GridLayoutManager(requireContext(), 4)
        adapter = StickerAdapter(mgr) { def -> onStickerSelected(def) }
        rvGrid.adapter = adapter
        adapter?.submitList(filteredCatalog.toList())
        // Restore visual selection if a key was previously selected
        mgr.selectedStickerKey?.let { adapter?.setSelectedKey(it) }

        // === Slider listeners ===
        sliderScale?.addOnChangeListener { _, value, fromUser ->
            if (fromUser && mgr.state == StickerEditState.SELECTED) {
                tvScaleValue?.text = String.format("%.1f", value)
                mgr.selectedInstanceId?.let { id ->
                    mgr.updateSticker(id, scale = value)
                    onMapInvalidate?.invoke()
                }
            }
        }
        sliderRotation?.addOnChangeListener { _, value, fromUser ->
            if (fromUser && mgr.state == StickerEditState.SELECTED) {
                tvRotationValue?.text = "${value.toInt()}°"
                mgr.selectedInstanceId?.let { id ->
                    mgr.updateSticker(id, rotation = value)
                    onMapInvalidate?.invoke()
                }
            }
        }
        sliderOpacity?.addOnChangeListener { _, value, fromUser ->
            if (fromUser && mgr.editMode) {
                tvOpacityValue?.text = "${(value * 100).toInt()}%"
                mgr.activeLayerId?.let { layerId ->
                    mgr.updateLayerOpacity(layerId, value)
                    onMapInvalidate?.invoke()
                }
            }
        }

        // === Delete sticker button ===
        btnDelete?.setOnClickListener {
            if (mgr.state == StickerEditState.SELECTED) {
                mgr.selectedInstanceId?.let { id ->
                    mgr.removeSticker(id)
                    onMapInvalidate?.invoke()
                }
            }
        }

        // === Listen for state changes (e.g. sticker tapped on map while palette is open) ===
        // Save previous listener (DashboardFragment) and chain with our own
        previousChangeListener = mgr.onChangeListener
        mgr.onChangeListener = {
            // Call DashboardFragment's listener first (banner updates)
            previousChangeListener?.invoke()
            // Then update palette UI
            val frag = this@StickerPaletteFragment
            frag.activity?.runOnUiThread {
                if (frag.isAdded && frag.view != null) {
                    updateUI()
                }
            }
        }

        updateUI()
    }

    private fun onStickerSelected(def: StickerDefinition) {
        val mgr = stickerManager ?: return
        if (!mgr.editMode) return
        mgr.selectStickerForPlacement(def.key)
        adapter?.setSelectedKey(def.key)
        // Auto-dismiss palette so user can tap the map directly.
        // onDestroyView preserves PLACING state (not reset to VIEWING).
        dismiss()
    }

    private fun filterCatalog(query: String) {
        filteredCatalog = if (query.isBlank()) {
            STICKER_CATALOG.toMutableList()
        } else {
            val q = query.lowercase()
            STICKER_CATALOG.filter {
                it.name.lowercase().contains(q) || it.key.lowercase().contains(q)
            }.toMutableList()
        }
        adapter?.submitList(filteredCatalog.toList())
    }

    /**
     * Update all UI elements based on the current [StickerEditState].
     * This is the single source of truth for what is enabled/visible.
     */
    private fun updateUI() {
        val mgr = stickerManager ?: return
        val currentState = mgr.state

        // Status hint text
        tvStatusHint?.let { hint ->
            hint.visibility = View.VISIBLE
            hint.text = when (currentState) {
                StickerEditState.VIEWING -> "Modo visualización — activa Editar para modificar stickers"
                StickerEditState.IDLE -> "Selecciona un sticker del catálogo para colocarlo"
                StickerEditState.PLACING -> "Toca el mapa para colocar el sticker seleccionado"
                StickerEditState.SELECTED -> "Arrastra, escala o modifica el sticker seleccionado"
                StickerEditState.DRAGGING -> "Arrastrando sticker..."
            }
        }

        // Properties panel: only visible when a sticker instance is selected in edit mode
        val instance = mgr.selectedInstanceId?.let { mgr.getSticker(it) }
        if (instance != null && (currentState == StickerEditState.SELECTED || currentState == StickerEditState.DRAGGING)) {
            propertiesPanel?.visibility = View.VISIBLE
            val def = STICKER_CATALOG.find { it.key == instance.stickerKey }
            tvSelectedName?.text = def?.name ?: instance.stickerKey

            sliderScale?.value = instance.scale.coerceIn(0.1f, 5.0f)
            tvScaleValue?.text = String.format("%.1f", instance.scale)

            sliderRotation?.value = instance.rotation.coerceIn(0f, 360f)
            tvRotationValue?.text = "${instance.rotation.toInt()}°"

            val layerOpacity = mgr.getActiveLayer()?.opacity ?: 1.0f
            sliderOpacity?.value = layerOpacity.coerceIn(0f, 1f)
            tvOpacityValue?.text = "${(layerOpacity * 100).toInt()}%"

            // Enable sliders only in SELECTED state (not during drag)
            val slidersEnabled = currentState == StickerEditState.SELECTED
            sliderScale?.isEnabled = slidersEnabled
            sliderRotation?.isEnabled = slidersEnabled
            sliderOpacity?.isEnabled = slidersEnabled
            btnDelete?.isEnabled = true
            btnDelete?.alpha = 1.0f
        } else {
            propertiesPanel?.visibility = View.GONE
        }

        // Delete button disabled when not in SELECTED state
        if (currentState != StickerEditState.SELECTED) {
            btnDelete?.isEnabled = false
            btnDelete?.alpha = 0.5f
        }
    }

    /**
     * When the palette is dismissed, do NOT change edit mode.
     * The FAB in DashboardFragment handles toggling edit mode off.
     * Just restore the listener and clean up view references.
     */
    override fun onDestroyView() {
        val mgr = stickerManager
        // Restore DashboardFragment's listener when palette is dismissed
        mgr?.onChangeListener = previousChangeListener
        previousChangeListener = null
        // Null out view references to prevent leaks
        switchEditMode = null
        propertiesPanel = null
        sliderScale = null
        sliderRotation = null
        sliderOpacity = null
        tvScaleValue = null
        tvRotationValue = null
        tvOpacityValue = null
        tvSelectedName = null
        btnDelete = null
        tvStatusHint = null
        adapter = null
        super.onDestroyView()
    }

    companion object {
        const val TAG = "StickerPaletteFragment"

        fun newInstance(): StickerPaletteFragment = StickerPaletteFragment()
    }
}
