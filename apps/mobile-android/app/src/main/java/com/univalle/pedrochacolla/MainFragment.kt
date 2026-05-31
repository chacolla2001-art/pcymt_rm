package com.univalle.pedrochacolla

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.univalle.pedrochacolla.adapters.SectionAdapter
import com.univalle.pedrochacolla.ui.home.CollectionViewModel
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import kotlinx.coroutines.launch

class MainFragment : Fragment(R.layout.fragment_main) {

    private val viewModel: CollectionViewModel by viewModels { CollectionViewModel.Factory() }
    private var loadingDialog: LoadingDialogFragment? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val rvSections = view.findViewById<RecyclerView>(R.id.rvSections).apply {
            layoutManager = LinearLayoutManager(requireContext())
        }

        // Back navigation
        view.findViewById<View>(R.id.btnBackCollection).setOnClickListener {
            findNavController().popBackStack()
        }

        val layoutCompleted = view.findViewById<View>(R.id.layoutCompleted)
        val btnResetProgress = view.findViewById<View>(R.id.btnResetProgress)
        btnResetProgress.setOnClickListener { viewModel.resetProgress() }

        observeState(rvSections, layoutCompleted)
        viewModel.loadCollection()
    }

    private fun observeState(rvSections: RecyclerView, layoutCompleted: View) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    if (state.isLoading) {
                        if (loadingDialog == null) {
                            loadingDialog = LoadingDialogFragment.newInstance().also {
                                it.show(childFragmentManager, "loading")
                            }
                        }
                    } else {
                        loadingDialog?.dismiss()
                        loadingDialog = null
                    }

                    // Mostrar banner cuando se completa el álbum
                    layoutCompleted.visibility = if (state.isCompleted) View.VISIBLE else View.GONE

                    if (state.sections.isNotEmpty()) {
                        val adapter = rvSections.adapter as? SectionAdapter
                            ?: SectionAdapter(state.interactedIds) { icon ->
                                (requireActivity() as MainActivity).navigateToAr(findNavController())
                            }.also { rvSections.adapter = it }
                        adapter.updateInteractedIds(state.interactedIds)
                        adapter.submitList(state.sections)
                    }

                    if (!state.isLoading && state.sections.isEmpty() && state.error == null) {
                        Toast.makeText(requireContext(), "No hay puntos activos para mostrar.", Toast.LENGTH_SHORT).show()
                    }

                    state.error?.let {
                        Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }
}
