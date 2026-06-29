package com.univalle.pedrochacolla.ui.ar

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.FragmentArSimpleBinding
import dagger.hilt.android.AndroidEntryPoint

/**
 * ArSimpleFragment - Placeholder for the removed AR Simple mode.
 * The button and navigation entry remain but the functionality is disabled.
 */
@AndroidEntryPoint
class ArSimpleFragment : Fragment() {

    private var _binding: FragmentArSimpleBinding? = null
    private val binding get() = _binding!!

    private val viewModel by viewModels<ArSimpleViewModel>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentArSimpleBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnBack.setOnClickListener {
            findNavController().navigate(R.id.navigation_stats)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}