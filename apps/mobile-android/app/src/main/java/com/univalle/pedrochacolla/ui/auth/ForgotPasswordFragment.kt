package com.univalle.pedrochacolla.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.FragmentForgotPasswordBinding
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.validation.ValidationHelper
import com.univalle.pedrochacolla.utils.window.BannerUtil
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * ForgotPasswordFragment - Handles password recovery via email
 */
@AndroidEntryPoint
class ForgotPasswordFragment : Fragment() {

    private var _binding: FragmentForgotPasswordBinding? = null
    private val binding get() = _binding!!

    private val viewModel by viewModels<AuthViewModel>()

    private var loadingDialog: LoadingDialogFragment? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentForgotPasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupClickListeners()
        observeState()
    }

    private fun setupClickListeners() {
        binding.btnSendRecovery.setOnClickListener { sendRecovery() }
        binding.btnBackToLogin.setOnClickListener {
            findNavController().navigate(R.id.action_ForgotPasswordFragment_to_LoginFragment)
        }
    }

    private fun sendRecovery() {
        val email = binding.etForgotEmail.text.toString().trim()

        if (email.isEmpty()) {
            binding.tilForgotEmail.error = "El correo es obligatorio"
            binding.etForgotEmail.requestFocus()
            return
        }

        val emailValidation = ValidationHelper.validateEmail(email)
        if (!emailValidation.isValid) {
            binding.tilForgotEmail.error = emailValidation.errorMessage
            return
        }

        binding.tilForgotEmail.error = null
        viewModel.forgotPassword(email)
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    when (state) {
                        is AuthUiState.Loading -> showLoading()
                        is AuthUiState.ForgotPasswordSuccess -> onRecoverySuccess()
                        is AuthUiState.Error -> onRecoveryError(state.message)
                        else -> Unit
                    }
                }
            }
        }
    }

    private fun showLoading() {
        if (loadingDialog == null) {
            loadingDialog = LoadingDialogFragment.newInstance()
            loadingDialog?.show(parentFragmentManager, "loading")
        }
    }

    private fun onRecoverySuccess() {
        loadingDialog?.dismiss()
        loadingDialog = null
        BannerUtil.showBanner(
            requireActivity(),
            "Si el correo existe, recibirás una contraseña temporal"
        )
        findNavController().navigate(R.id.action_ForgotPasswordFragment_to_LoginFragment)
    }

    private fun onRecoveryError(message: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        BannerUtil.showBanner(requireActivity(), message)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
