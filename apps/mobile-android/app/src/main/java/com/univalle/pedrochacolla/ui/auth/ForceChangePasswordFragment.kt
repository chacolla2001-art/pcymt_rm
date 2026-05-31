package com.univalle.pedrochacolla.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.databinding.FragmentForceChangePasswordBinding
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.window.BannerUtil
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * ForceChangePasswordFragment - Shown when a user logs in with a temporary password
 * (must_change_password = true). The user cannot skip this screen.
 */
@AndroidEntryPoint
class ForceChangePasswordFragment : Fragment() {

    private var _binding: FragmentForceChangePasswordBinding? = null
    private val binding get() = _binding!!

    private val viewModel by viewModels<AuthViewModel>()
    private var loadingDialog: LoadingDialogFragment? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentForceChangePasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        blockBackNavigation()
        setupClickListeners()
        observeState()
    }

    /** Prevent the user from going back to avoid skipping the password change. */
    private fun blockBackNavigation() {
        requireActivity().onBackPressedDispatcher.addCallback(
            viewLifecycleOwner,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    BannerUtil.showBanner(
                        requireActivity(),
                        "Debes establecer una nueva contraseña para continuar."
                    )
                }
            }
        )
    }

    private fun setupClickListeners() {
        binding.btnChangePassword.setOnClickListener { attemptChangePassword() }
        binding.btnLogout.setOnClickListener { logoutAndGoToLogin() }
    }

    private fun attemptChangePassword() {
        val newPassword = binding.etNewPassword.text?.toString()?.trim() ?: ""
        val confirmPassword = binding.etConfirmPassword.text?.toString()?.trim() ?: ""

        if (!validateFields(newPassword, confirmPassword)) return

        viewModel.forceChangePassword(newPassword)
    }

    private fun validateFields(newPassword: String, confirmPassword: String): Boolean {
        var isValid = true

        if (newPassword.length < 8) {
            binding.tilNewPassword.error = "La contraseña debe tener al menos 8 caracteres"
            isValid = false
        } else if (!newPassword.any { it.isLetter() } || !newPassword.any { it.isDigit() }) {
            binding.tilNewPassword.error = "Debe contener al menos una letra y un número"
            isValid = false
        } else {
            binding.tilNewPassword.error = null
        }

        if (confirmPassword != newPassword) {
            binding.tilConfirmPassword.error = "Las contraseñas no coinciden"
            isValid = false
        } else {
            binding.tilConfirmPassword.error = null
        }

        return isValid
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    when (state) {
                        is AuthUiState.Loading -> showLoading()
                        is AuthUiState.LoginSuccess -> onPasswordChanged()
                        is AuthUiState.Error -> onError(state.message)
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

    private fun onPasswordChanged() {
        loadingDialog?.dismiss()
        loadingDialog = null
        Timber.i("ForceChangePasswordFragment: Password changed successfully — navigating to MainActivity")
        startActivity(Intent(requireContext(), MainActivity::class.java))
        requireActivity().finish()
    }

    private fun onError(message: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        BannerUtil.showBanner(requireActivity(), message)
    }

    private fun logoutAndGoToLogin() {
        UserSession.clear()
        SessionManager(requireContext()).clearSession()
        requireActivity().recreate()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
