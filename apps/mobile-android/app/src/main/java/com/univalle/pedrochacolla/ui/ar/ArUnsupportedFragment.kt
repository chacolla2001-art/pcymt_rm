package com.univalle.pedrochacolla.ui.ar

import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.FragmentArUnsupportedBinding
import com.univalle.pedrochacolla.utils.ar.ArDeviceCompatibility
import timber.log.Timber

/**
 * Shown when the user taps the AR tab but their device is not in the
 * verified-compatible list (or ARCore is unavailable).
 *
 * Displays:
 *  - A clear message explaining why AR is unavailable
 *  - Device requirements
 *  - Technical device details (for support/debugging)
 *  - A button to navigate back to the home screen
 */
class ArUnsupportedFragment : Fragment() {

    private var _binding: FragmentArUnsupportedBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentArUnsupportedBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        Timber.i("AR unsupported fragment shown for device: %s %s (%s)",
            Build.MANUFACTURER, Build.MODEL, Build.HARDWARE)

        setupReason()
        setupDeviceDetails()
        setupListeners()
    }

    private fun setupReason() {
        // Get the reason passed via navigation args, or re-check
        val result = arguments?.getString(ARG_REASON)?.let { reasonKey ->
            try {
                ArDeviceCompatibility.CompatibilityResult.valueOf(reasonKey)
            } catch (_: Exception) {
                null
            }
        } ?: ArDeviceCompatibility.checkCompatibility(requireContext())

        val reason = ArDeviceCompatibility.getIncompatibilityReason(result)
        if (reason.isNotEmpty()) {
            binding.tvArUnsupportedReason.text = reason
        }
    }

    private fun setupDeviceDetails() {
        val details = buildString {
            appendLine("Fabricante: ${Build.MANUFACTURER}")
            appendLine("Modelo: ${Build.MODEL}")
            appendLine("Dispositivo: ${Build.DEVICE}")
            appendLine("Hardware: ${Build.HARDWARE}")
            appendLine("Placa: ${Build.BOARD}")
            appendLine("Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        }
        binding.tvArDeviceDetails.text = details
    }

    private fun setupListeners() {
        binding.toolbarArUnsupported.setNavigationOnClickListener {
            findNavController().navigate(R.id.navigation_stats)
        }

        binding.btnArUnsupportedBack.setOnClickListener {
            findNavController().navigate(R.id.navigation_stats)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val ARG_REASON = "ar_incompatibility_reason"
    }
}
