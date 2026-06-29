package com.univalle.pedrochacolla.ui.collection

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.AnchorIcon

class AnimalActionBottomSheet : BottomSheetDialogFragment() {

    var onShowOnMap: ((AnchorIcon) -> Unit)? = null
    var onOpenAr: ((AnchorIcon) -> Unit)? = null

    private val icon: AnchorIcon by lazy {
        AnchorIcon(
            anchorId = requireArguments().getString(ARG_ANCHOR_ID).orEmpty(),
            iconUrl = requireArguments().getString(ARG_ICON_URL).orEmpty(),
            latitude = requireArguments().getDouble(ARG_LAT),
            longitude = requireArguments().getDouble(ARG_LNG),
            description = requireArguments().getString(ARG_DESCRIPTION).orEmpty(),
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View = inflater.inflate(R.layout.bottom_sheet_animal_action, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        view.findViewById<android.widget.TextView>(R.id.tvAnimalName).text =
            icon.description.ifBlank { "Animal" }
        view.findViewById<MaterialButton>(R.id.btnShowOnMap).setOnClickListener {
            onShowOnMap?.invoke(icon)
            dismiss()
        }
        view.findViewById<MaterialButton>(R.id.btnOpenAr).setOnClickListener {
            onOpenAr?.invoke(icon)
            dismiss()
        }
    }

    companion object {
        private const val ARG_ANCHOR_ID = "anchorId"
        private const val ARG_ICON_URL = "iconUrl"
        private const val ARG_LAT = "lat"
        private const val ARG_LNG = "lng"
        private const val ARG_DESCRIPTION = "description"
        const val TAG = "AnimalActionBottomSheet"

        fun newInstance(icon: AnchorIcon): AnimalActionBottomSheet =
            AnimalActionBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_ANCHOR_ID, icon.anchorId)
                    putString(ARG_ICON_URL, icon.iconUrl)
                    putDouble(ARG_LAT, icon.latitude)
                    putDouble(ARG_LNG, icon.longitude)
                    putString(ARG_DESCRIPTION, icon.description)
                }
            }
    }
}
