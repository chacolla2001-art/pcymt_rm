package com.univalle.pedrochacolla.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.univalle.pedrochacolla.R

class PoiInfoBottomSheet : BottomSheetDialogFragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View = inflater.inflate(R.layout.bottom_sheet_poi_info, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val name = requireArguments().getString(ARG_NAME).orEmpty()
        val summary = requireArguments().getString(ARG_SUMMARY).orEmpty()
        view.findViewById<TextView>(R.id.tvPoiName).text = name
        view.findViewById<TextView>(R.id.tvPoiSummary).text =
            summary.ifBlank { name }
    }

    companion object {
        private const val ARG_NAME = "name"
        private const val ARG_SUMMARY = "summary"
        const val TAG = "PoiInfoBottomSheet"

        fun newInstance(name: String, summary: String): PoiInfoBottomSheet =
            PoiInfoBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_NAME, name)
                    putString(ARG_SUMMARY, summary)
                }
            }
    }
}
