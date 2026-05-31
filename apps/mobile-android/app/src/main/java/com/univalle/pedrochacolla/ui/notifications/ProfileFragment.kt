package com.univalle.pedrochacolla.ui.notifications

import android.app.AlertDialog
import android.content.Intent
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
import com.univalle.pedrochacolla.databinding.FragmentProfileBinding
import com.univalle.pedrochacolla.ui.auth.AuthActivity
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.validation.ValidationHelper
import com.univalle.pedrochacolla.utils.window.BannerUtil
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private lateinit var sessionManager: SessionManager

    private val viewModel: ProfileViewModel by viewModels {
        ProfileViewModel.Factory(SessionManager(requireContext()))
    }

    private var loadingDialog: LoadingDialogFragment? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        sessionManager = SessionManager(requireContext())
        sessionManager.loadSession()
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        populateUserData()
        configurePasswordSection()

        binding.btnBack.setOnClickListener { findNavController().popBackStack() }

        binding.btnProfileSaveinfo.setOnClickListener { changePassword() }
        binding.btnDeleteAccount.setOnClickListener { confirmDeleteAccount() }

        binding.btnLogout.setOnClickListener {
            navigateToLogin()
        }

        observeViewModel()
    }

    /** Si el usuario autenticó con Google, la sección de contraseña no aplica. */
    private fun configurePasswordSection() {
        val isGoogleUser = !UserSession.currentUser?.googleId.isNullOrBlank()
        if (isGoogleUser) {
            binding.tvGoogleNotice.visibility = View.VISIBLE
            binding.tilCurrentPassword.visibility = View.GONE
            binding.tilPassword.visibility = View.GONE
            binding.tilRepeatPassword.visibility = View.GONE
            binding.btnProfileSaveinfo.isEnabled = false
        }
    }

    private fun changePassword() {
        val user = UserSession.currentUser
        if (user == null || user.id.isBlank()) {
            showError("Sesión no disponible")
            return
        }

        val email = user.email
        val currentPwd = binding.etCurrentPassword.text.toString()
        val newPwd = binding.editTextText.text.toString()
        val confirmPwd = binding.editTextText2.text.toString()

        val requiredValidation = ValidationHelper.validateRequired(
            "Contraseña actual" to currentPwd,
            "Nueva contraseña" to newPwd,
            "Confirmar contraseña" to confirmPwd
        )
        if (!requiredValidation.isValid) {
            showError(requiredValidation.errorMessage!!)
            return
        }

        if (currentPwd == newPwd) {
            showError("La nueva contraseña debe ser diferente a la actual")
            return
        }

        val matchValidation = ValidationHelper.validatePasswordMatch(newPwd, confirmPwd)
        if (!matchValidation.isValid) {
            showError(matchValidation.errorMessage!!)
            return
        }

        val strengthValidation = ValidationHelper.validatePasswordStrength(newPwd)
        if (!strengthValidation.isValid) {
            showError(strengthValidation.errorMessage!!)
            return
        }

        showLoading()
        viewModel.changePassword(email, currentPwd, newPwd)
    }

    private fun confirmDeleteAccount() {
        val user = UserSession.currentUser
        if (user == null || user.id.isBlank()) {
            showError("Sesión no disponible")
            return
        }

        val isGoogleUser = !user.googleId.isNullOrBlank()
        val currentPassword = binding.etCurrentPassword.text?.toString()?.trim().orEmpty()

        if (!isGoogleUser && currentPassword.isBlank()) {
            showError("Ingresa tu contraseña actual para eliminar la cuenta")
            return
        }

        val message = if (isGoogleUser) {
            "Esta acción eliminará tu cuenta y cerrará tus sesiones activas. No se puede deshacer."
        } else {
            "Esta acción eliminará tu cuenta y cerrará tus sesiones activas. Se usará la contraseña actual para confirmar. No se puede deshacer."
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Eliminar cuenta")
            .setMessage(message)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Eliminar") { _, _ ->
                showLoading()
                viewModel.deleteAccount(currentPassword.takeIf { it.isNotBlank() })
            }
            .show()
    }

    private fun clearPasswordFields() {
        binding.etCurrentPassword.text?.clear()
        binding.editTextText.text?.clear()
        binding.editTextText2.text?.clear()
    }

    private fun showError(message: String) {
        BannerUtil.showBanner(requireActivity(), message)
    }

    private fun showSuccess(message: String) {
        BannerUtil.showBanner(requireActivity(), message)
    }

    private fun showLoading() {
        if (loadingDialog?.isAdded == true) return
        loadingDialog = LoadingDialogFragment.newInstance()
        loadingDialog?.show(parentFragmentManager, "loading")
    }

    private fun hideLoading() {
        loadingDialog?.dismiss()
        loadingDialog = null
    }

    private fun navigateToLogin() {
        sessionManager.clearSession()
        val intent = Intent(requireContext(), AuthActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    when (state) {
                        is ProfileUiState.Loading -> {
                            if (loadingDialog == null) showLoading()
                        }
                        is ProfileUiState.PasswordChanged -> {
                            hideLoading()
                            showSuccess("Contraseña actualizada correctamente")
                            clearPasswordFields()
                        }
                        is ProfileUiState.AccountDeleted -> {
                            hideLoading()
                            showSuccess("Cuenta eliminada correctamente")
                            navigateToLogin()
                        }
                        is ProfileUiState.Error -> {
                            hideLoading()
                            showError("Error: ${state.message}")
                        }
                        else -> Unit
                    }
                }
            }
        }
    }

    private fun populateUserData() {
        val user = UserSession.currentUser ?: return

        fun String?.isValid(): Boolean = this != null && this.isNotBlank() && this != "null"

        if (user.name.isValid()) binding.etProfileUsername.setText(user.name)
        if (user.email.isValid()) binding.etProfileEmail.setText(user.email)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
