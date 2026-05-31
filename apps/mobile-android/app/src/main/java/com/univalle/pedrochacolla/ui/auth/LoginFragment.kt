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
import com.univalle.pedrochacolla.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.FragmentLoginBinding
import com.univalle.pedrochacolla.utils.auth.GoogleSignInHelper
import com.univalle.pedrochacolla.utils.config.ConfigManager
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.window.BannerUtil
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * LoginFragment - Handles user login via email/password or Google
 */
@AndroidEntryPoint
class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    private var loadingDialog: LoadingDialogFragment? = null

    private val viewModel by viewModels<AuthViewModel>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        setupFieldValidation()
        observeAuthState()
        prefillEmailIfProvided()
        
        // Initialize ConfigManager to fetch WEB_CLIENT_ID from backend
        initializeConfig()
    }

    private fun prefillEmailIfProvided() {
        val email = arguments?.getString("prefill_email").orEmpty()
        if (email.isNotBlank()) {
            binding.etEmailLoginInput.setText(email)
        }
    }
    
    private fun initializeConfig() {
        lifecycleScope.launch {
            Timber.d("LoginFragment: Initializing ConfigManager...")
            val result = ConfigManager.initialize()
            if (result.isSuccess) {
                Timber.d("LoginFragment: Config loaded, Google Auth enabled: ${ConfigManager.isGoogleAuthEnabled()}")
            } else {
                Timber.w("LoginFragment: Failed to load config - ${result.exceptionOrNull()?.message}")
            }
        }
    }

    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener { attemptLogin() }
        binding.btnContinueGoogle.setOnClickListener { launchGoogleSignIn() }
        binding.btnGoRegister.setOnClickListener {
            findNavController().navigate(R.id.action_LoginFragment_to_RegisterFragment)
        }
        binding.btnForgotPassword.setOnClickListener {
            findNavController().navigate(R.id.action_LoginFragment_to_ForgotPasswordFragment)
        }
    }

    private fun setupFieldValidation() {
        binding.etEmailLoginInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) binding.etEmailLogin.error = null
        }
        binding.etPasswordLoginInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) binding.etPasswordLogin.error = null
        }
    }

    private fun attemptLogin() {
        val email = binding.etEmailLoginInput.text.toString().trim()
        val password = binding.etPasswordLoginInput.text.toString().trim()

        if (!validateFields(email, password)) return

        viewModel.loginWithEmailAndPassword(email, password, false)
    }

    private fun validateFields(email: String, password: String): Boolean {
        var isValid = true

        if (email.isEmpty()) {
            binding.etEmailLogin.error = "El correo es obligatorio"
            binding.etEmailLoginInput.requestFocus()
            isValid = false
        } else {
            binding.etEmailLogin.error = null
        }

        if (password.isEmpty()) {
            binding.etPasswordLogin.error = "La contraseña es obligatoria"
            if (isValid) binding.etPasswordLoginInput.requestFocus()
            isValid = false
        } else {
            binding.etPasswordLogin.error = null
        }

        return isValid
    }

    private fun launchGoogleSignIn() {
        showLoading()
        
        // Ensure config is loaded before attempting Google Sign In
        lifecycleScope.launch {
            if (!ConfigManager.isInitialized()) {
                Timber.d("LoginFragment: Config not loaded, initializing...")
                val result = ConfigManager.initialize()
                if (result.isFailure) {
                    loadingDialog?.dismiss()
                    loadingDialog = null
                    BannerUtil.showBanner(
                        requireActivity(),
                        "No se pudo conectar al servidor.\n\n" +
                        "Verifica tu conexión a internet y que el servidor esté disponible."
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

    private fun observeAuthState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    when (state) {
                        is AuthUiState.Loading -> showLoading()
                        is AuthUiState.LoginSuccess -> onLoginSuccess()
                        is AuthUiState.MustChangePassword -> onMustChangePassword()
                        is AuthUiState.EmailVerificationRequired -> onEmailVerificationRequired(state.email)
                        is AuthUiState.Error -> onLoginError(state.message)
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

    private fun onLoginSuccess() {
        loadingDialog?.dismiss()
        loadingDialog = null
        startActivity(Intent(requireContext(), MainActivity::class.java))
        requireActivity().finish()
    }

    private fun onMustChangePassword() {
        loadingDialog?.dismiss()
        loadingDialog = null
        findNavController().navigate(R.id.action_LoginFragment_to_ForceChangePasswordFragment)
    }

    private fun onEmailVerificationRequired(email: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        findNavController().navigate(
            R.id.EmailVerificationPendingFragment,
            bundleOf("email" to email)
        )
    }

    private fun onLoginError(message: String) {
        loadingDialog?.dismiss()
        loadingDialog = null
        binding.etEmailLoginInput.setText("")
        binding.etPasswordLoginInput.setText("")
        binding.etEmailLoginInput.requestFocus()
        BannerUtil.showBanner(requireActivity(), message)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
