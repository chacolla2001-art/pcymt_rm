package com.univalle.pedrochacolla.ui.dashboard

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Spinner
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.slider.Slider
import com.google.android.material.switchmaterial.SwitchMaterial
import com.univalle.pedrochacolla.R

/**
 * Panel de escena ambiental del mapa: referencias espaciales animadas y lluvia.
 */
class MapScenePanelFragment : BottomSheetDialogFragment() {

    companion object {
        const val TAG = "MapScenePanel"

        fun newInstance(): MapScenePanelFragment = MapScenePanelFragment()
    }

    data class SceneState(
        val showSpatialReferences: Boolean,
        val showRain: Boolean,
        val rainIntensity: Float,
        val rainSize: Float,
        val rainSectionIndex: Int,
        val animSpeed: Float,
    )

    var initialState: SceneState = SceneState(true, false, 0.45f, 1f, -1, 1f)
    var rainZoneLabels: List<String> = emptyList()
    var onSceneChanged: ((SceneState) -> Unit)? = null

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.behavior.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            peekHeight = 520
            isHideable = true
        }
        return dialog
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View = inflater.inflate(R.layout.fragment_map_scene_panel, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val switchRefs = view.findViewById<SwitchMaterial>(R.id.switch_spatial_refs)
        val switchRain = view.findViewById<SwitchMaterial>(R.id.switch_rain)
        val sliderRain = view.findViewById<Slider>(R.id.slider_rain_intensity)
        val sliderRainSize = view.findViewById<Slider>(R.id.slider_rain_size)
        val spinnerZone = view.findViewById<Spinner>(R.id.spinner_rain_zone)
        val sliderAnim = view.findViewById<Slider>(R.id.slider_anim_speed)

        switchRefs.isChecked = initialState.showSpatialReferences
        switchRain.isChecked = initialState.showRain
        sliderRain.value = initialState.rainIntensity * 100f
        sliderRainSize.value = initialState.rainSize * 100f
        sliderAnim.value = initialState.animSpeed * 100f

        val zoneOptions = buildList {
            add(getString(R.string.map_scene_rain_zone_all))
            addAll(rainZoneLabels)
        }
        spinnerZone.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            zoneOptions,
        )
        spinnerZone.setSelection((initialState.rainSectionIndex + 1).coerceIn(0, zoneOptions.lastIndex))

        fun selectedSectionIndex(): Int = spinnerZone.selectedItemPosition - 1

        fun emit() {
            onSceneChanged?.invoke(
                SceneState(
                    showSpatialReferences = switchRefs.isChecked,
                    showRain = switchRain.isChecked,
                    rainIntensity = sliderRain.value / 100f,
                    rainSize = sliderRainSize.value / 100f,
                    rainSectionIndex = selectedSectionIndex(),
                    animSpeed = sliderAnim.value / 100f,
                ),
            )
        }

        switchRefs.setOnCheckedChangeListener { _, _ -> emit() }
        switchRain.setOnCheckedChangeListener { _, _ -> emit() }
        sliderRain.addOnChangeListener { _, _, _ -> emit() }
        sliderRainSize.addOnChangeListener { _, _, _ -> emit() }
        sliderAnim.addOnChangeListener { _, _, _ -> emit() }
        spinnerZone.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, v: View?, position: Int, id: Long) = emit()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }
}
