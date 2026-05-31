package com.univalle.pedrochacolla.ui.home

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.adapters.AnimalTrophyAdapter
import com.univalle.pedrochacolla.databinding.FragmentCollectionBinding
import com.univalle.pedrochacolla.ui.auth.AuthActivity
import com.univalle.pedrochacolla.utils.device.DeviceCapabilityManager
import com.univalle.pedrochacolla.utils.session.UserSession
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class StatsFragment : Fragment() {

    private var _binding: FragmentCollectionBinding? = null
    private val binding get() = _binding!!

    private val viewModel: HomeViewModel by viewModels()
    private lateinit var trophyAdapter: AnimalTrophyAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCollectionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupTrophyRecyclerView()
        setupNavigationButtons()
        setupCelebrationOverlay()
        applyDeviceTierUi()
        observeState()
        viewModel.loadStats()
    }

    private fun setupTrophyRecyclerView() {
        trophyAdapter = AnimalTrophyAdapter()
        binding.rvAnimalTrophies.apply {
            adapter = trophyAdapter
            layoutManager = LinearLayoutManager(
                requireContext(),
                LinearLayoutManager.HORIZONTAL,
                false
            )
        }
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    val b = _binding ?: return@collect

                    b.tvWelcome.text = "¡Bienvenido, ${state.userName}!"

                    if (state.isLoading || state.isResetting) {
                        b.tvStats.visibility = View.GONE
                        b.progressStats.visibility = View.VISIBLE
                        b.loadingOverlay.visibility = View.VISIBLE
                        b.celebrationOverlay.visibility = View.GONE
                    } else {
                        b.loadingOverlay.visibility = View.GONE
                        b.tvStats.visibility = View.VISIBLE
                        b.tvStats.text = "Has encontrado ${state.foundCount} de ${state.totalCount} figuras"
                    }

                    // Update animal count badge
                    b.tvAnimalCount.text = "${state.foundCount} / ${state.totalCount}"

                    // Update trophy strip
                    trophyAdapter.submitList(state.animals)

                    // Show/hide celebration overlay
                    if (state.allFound && !state.isLoading && !state.isResetting) {
                        showCelebrationOverlay()
                    } else if (!state.allFound || state.isLoading || state.isResetting) {
                        b.celebrationOverlay.visibility = View.GONE
                    }

                    // Show error as Snackbar and clear it from state
                    state.error?.let { msg ->
                        Snackbar.make(b.root, msg, Snackbar.LENGTH_LONG).show()
                        viewModel.clearError()
                    }
                }
            }
        }
    }

    private fun setupCelebrationOverlay() {
        // "REINICIAR JUEGO" → muestra panel de confirmación inline (sin dialog)
        binding.btnResetGame.setOnClickListener {
            binding.celebrationContent.visibility = View.GONE
            binding.celebrationConfirm.visibility = View.VISIBLE
        }

        // Confirmar reinicio
        binding.btnConfirmReset.setOnClickListener {
            binding.celebrationConfirm.visibility = View.GONE
            viewModel.resetGame()
        }

        // Cancelar reinicio → vuelve al panel de felicitación
        binding.tvCancelReset.setOnClickListener {
            binding.celebrationConfirm.visibility = View.GONE
            binding.celebrationContent.visibility = View.VISIBLE
        }

        // "Omitir" → cierra el overlay
        binding.tvCelebrationClose.setOnClickListener {
            binding.celebrationOverlay.visibility = View.GONE
        }
    }

    private fun showCelebrationOverlay() {
        val b = _binding ?: return
        if (b.celebrationOverlay.visibility == View.VISIBLE) return
        // Ensure we start with the main panel, not the confirm panel
        b.celebrationContent.visibility = View.VISIBLE
        b.celebrationConfirm.visibility = View.GONE
        b.celebrationOverlay.visibility = View.VISIBLE
        // Fade in animation on trophy emoji
        val ctx = context ?: return
        val bounceAnim = AnimationUtils.loadAnimation(ctx, android.R.anim.fade_in)
        b.tvCelebrationTrophy.startAnimation(bounceAnim)
        b.celebrationOverlay.alpha = 0f
        b.celebrationOverlay.animate()
            .alpha(1f)
            .setDuration(450)
            .start()
    }

    private fun setupNavigationButtons() {
        binding.cardCollection.setOnClickListener {
            findNavController().navigate(R.id.navigation_collection)
        }
        binding.cardMap.setOnClickListener {
            findNavController().navigate(R.id.navigation_map)
        }
        binding.cardProfile.setOnClickListener {
            findNavController().navigate(R.id.navigation_profile)
        }

        // Modo Explorador (Pokémon Go style) — disponible para todos los dispositivos
        binding.cardExplorer.setOnClickListener {
            findNavController().navigate(R.id.navigation_ar_map)
        }

    }

    private fun applyDeviceTierUi() {
        val isLowEnd = DeviceCapabilityManager.isLowEnd(requireContext())
        val isAdmin = UserSession.currentUser?.role == "admin"

        // Show admin notice card for admin users
        binding.cardAdminNotice.visibility =
            if (isAdmin) android.view.View.VISIBLE else android.view.View.GONE

        if (isLowEnd || !isAdmin) {
            // Hide Realidad Mixta card — low-end device or non-admin user
            // UI adjustments for hiding the mixed-reality card can go here
            return
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}


