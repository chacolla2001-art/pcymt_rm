package com.univalle.pedrochacolla.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.FragmentEmailVerificationPendingBinding
import com.univalle.pedrochacolla.utils.loading_screen.LoadingDialogFragment
import com.univalle.pedrochacolla.utils.window.BannerUtil
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class EmailVerificationPendingFragment : Fragment() {

    private var _binding: FragmentEmailVerificationPendingBinding? = null
    private val binding get() = _binding!!
    private val viewModel by viewModels<AuthViewModel>()
    private var loadingDialog: LoadingDialogFragment? = null

    private val email: String by lazy {
        arguments?.getString("email").orEmpty()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEmailVerificationPendingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvVerificationDescription.text =
            "Enviamos un enlace de verificación a $email. Abre tu correo, verifica tu cuenta y luego vuelve aquí para actualizar el estado."

        binding.btnResendVerification.setOnClickListener { resendVerification() }
        binding.btnRefreshVerification.setOnClickListener { refreshVerification() }
        binding.btnBackToLogin.setOnClickListener {
            findNavController().navigate(
                R.id.action_EmailVerificationPendingFragment_to_LoginFragment,
                bundleOf("prefill_email" to email)
            )
        }
    }

    private fun resendVerification() {
        if (email.isBlank()) return
        lifecycleScope.launch {
            showLoading()
            val result = viewModel.resendVerificationEmail(email)
            hideLoading()
            result
                .onSuccess {
                    BannerUtil.showBanner(requireActivity(), "Te enviamos un nuevo correo de verificación.")
                }
                .onFailure {
                    BannerUtil.showBanner(requireActivity(), it.message ?: "No se pudo reenviar el correo.")
                }
        }
    }

    private fun refreshVerification() {
        if (email.isBlank()) return
        lifecycleScope.launch {
            showLoading()
            val result = viewModel.checkEmailVerification(email)
            hideLoading()
            result
                .onSuccess { verified ->
                    if (verified) {
                        BannerUtil.showBanner(requireActivity(), "Correo verificado. Ahora ya puedes iniciar sesión.")
                        findNavController().navigate(
                            R.id.action_EmailVerificationPendingFragment_to_LoginFragment,
                            bundleOf("prefill_email" to email)
                        )
                    } else {
                        BannerUtil.showBanner(requireActivity(), "Tu correo todavía no ha sido verificado.")
                    }
                }
                .onFailure {
                    BannerUtil.showBanner(requireActivity(), it.message ?: "No se pudo actualizar el estado.")
                }
        }
    }

    private fun showLoading() {
        if (loadingDialog == null) {
            loadingDialog = LoadingDialogFragment.newInstance()
            loadingDialog?.show(parentFragmentManager, "loading")
        }
    }

    private fun hideLoading() {
        loadingDialog?.dismiss()
        loadingDialog = null
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
