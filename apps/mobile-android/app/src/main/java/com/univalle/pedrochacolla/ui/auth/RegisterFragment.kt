package com.univalle.pedrochacolla.ui.auth

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
import androidx.core.os.bundleOf
import androidx.navigation.fragment.findNavController
import com.google.android.material.textfield.TextInputLayout
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.UserData
import com.univalle.pedrochacolla.databinding.FragmentRegisterBinding
import com.univalle.pedrochacolla.utils.auth.GoogleSignInHelper
import com.univalle.pedrochacolla.utils.config.ConfigManager
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.validation.ValidationHelper
import com.univalle.pedrochacolla.utils.window.BannerUtil
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * RegisterFragment - Handles new user registration
 */
@AndroidEntryPoint
class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!

    private val viewModel by viewModels<AuthViewModel>()

    private var loadingDialog: LoadingDialogFragment? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        observeRegistrationState()
    }

    private fun setupClickListeners() {
        binding.btnGoLogin.setOnClickListener {
            findNavController().navigate(R.id.action_RegisterFragment_to_LoginFragment)
        }
        binding.btnRegister.setOnClickListener { registerUser() }
        binding.btnLoginGoogle.setOnClickListener { launchGoogleSignIn() }
    }

    private fun registerUser() {
        val fields = collectFormFields()

        if (!validateFields(fields)) return

        val user = createUserFromFields(fields)
        checkExistenceAndRegister(user, fields)
    }

    private data class FormFields(
        val email: String,
        val password: String,
        val confirmPassword: String,
        val name: String
    )

    private fun collectFormFields() = FormFields(
        email = binding.etRegisterEmail.text.toString().trim(),
        password = binding.etRegisterPassword.text.toString().trim(),
        confirmPassword = binding.etRegisterPassword2.text.toString().trim(),
        name = binding.etRegisterUsername.text.toString().trim()
    )

    private fun validateFields(fields: FormFields): Boolean {
        var isValid = true

        fun checkField(layout: TextInputLayout, isEmpty: Boolean, message: String) {
            if (isEmpty) {
                layout.error = message
                if (isValid) layout.requestFocus()
                isValid = false
            } else {
                layout.error = null
            }
        }

        checkField(binding.tilRegisterUsername, fields.name.isEmpty(), "Nombre obligatorio")
        checkField(binding.tilRegisterEmail, fields.email.isEmpty(), "Correo obligatorio")
        checkField(binding.tilRegisterPassword, fields.password.isEmpty(), "Contraseña obligatoria")
        checkField(binding.tilRegisterPassword2, fields.confirmPassword.isEmpty(), "Confirma tu contraseña")

        if (isValid) {
            val emailValidation = ValidationHelper.validateEmail(fields.email)
            if (!emailValidation.isValid) {
                binding.tilRegisterEmail.error = emailValidation.errorMessage
                isValid = false
            }

            val strengthValidation = ValidationHelper.validatePasswordStrength(fields.password)
            if (!strengthValidation.isValid) {
                binding.tilRegisterPassword.error = strengthValidation.errorMessage
                isValid = false
            }

            val matchValidation = ValidationHelper.validatePasswordMatch(fields.password, fields.confirmPassword)
            if (!matchValidation.isValid) {
                binding.tilRegisterPassword2.error = matchValidation.errorMessage
                isValid = false
            }
        }

        return isValid
    }

    private fun createUserFromFields(fields: FormFields): UserData {
        return UserData(
            email = fields.email,
            password = fields.password,
            name = fields.name
        )
    }

    private fun checkExistenceAndRegister(user: UserData, fields: FormFields) {
        lifecycleScope.launch {
            showLoading()

            val emailExists = viewModel.checkEmailExists(fields.email).getOrNull() == true

            when {
                emailExists -> {
                    loadingDialog?.dismiss()
                    loadingDialog = null
                    binding.tilRegisterEmail.error = "Este correo ya está registrado"
                    BannerUtil.showBanner(
                        requireActivity(),
                        "Este correo ya está registrado. Inicia sesión o recupera tu contraseña."
                    )
                }
                else -> viewModel.registerUser(user)
            }
        }
    }

    private fun launchGoogleSignIn() {
        showLoading()

        lifecycleScope.launch {
            if (!ConfigManager.isInitialized()) {
                Timber.d("RegisterFragment: Config not loaded, initializing...")
                val result = ConfigManager.initialize()
                if (result.isFailure) {
                    loadingDialog?.dismiss()
                    loadingDialog = null
                    BannerUtil.showBanner(
                        requireActivity(),
                        "No se pudo conectar al servidor. Verifica tu conexión a internet."
                    )
                    return@launch
                }
            }

            GoogleSignInHelper(
                context = requireContext(),
                activity = requireActivity(),
                onTokenReceived = { idToken ->
                    viewModel.loginWithGoogle(idToken, false)
                },
                onError = { errorMessage ->
                    loadingDialog?.dismiss()
                    loadingDialog = null
                    BannerUtil.showBanner(requireActivity(), errorMessage)
                }
            ).launch()
        }
    }

    private fun observeRegistrationState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    when (state) {
                        is AuthUiState.Loading -> showLoading()
                        is AuthUiState.EmailVerificationRequired -> onEmailVerificationRequired(state.email)
                        is AuthUiState.LoginSuccess -> onRegisterSuccess()
                        is AuthUiState.Error -> onRegisterError(state.message)
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

    private fun onRegisterSuccess() {
        loadingDialog?.dismiss()
        loadingDialog = null
        BannerUtil.showBanner(requireActivity(), "Cuenta creada correctamente")
        startActivity(Intent(requireContext(), MainActivity::class.java))
        requireActivity().finish()
    }

    private fun onEmailVerificationRequired(email: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        findNavController().navigate(
            R.id.EmailVerificationPendingFragment,
            bundleOf("email" to email)
        )
    }

    private fun onRegisterError(message: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        BannerUtil.showBanner(requireActivity(), message)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
