package com.univalle.pedrochacolla

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.findNavController
import com.univalle.pedrochacolla.databinding.ActivityMainBinding
import com.univalle.pedrochacolla.ui.ar.ArFragment
import com.univalle.pedrochacolla.ui.auth.AuthActivity
import com.univalle.pedrochacolla.utils.ar.ArDeviceCompatibility
import com.univalle.pedrochacolla.utils.ar.InteractionTracker
import com.univalle.pedrochacolla.utils.session.AuthEvent
import com.univalle.pedrochacolla.utils.session.AuthEventBus
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    /** Flag to track AR mode and prevent redundant calls */
    private var isInArMode = false

    /** Cached AR device compatibility result (checked once per Activity lifecycle) */
    private var arCompatibility: ArDeviceCompatibility.CompatibilityResult? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        InteractionTracker.init(this)
        val navController = findNavController(R.id.nav_host_fragment_activity_main)

        // Centralized AR mode management: only manage immersive mode here
        navController.addOnDestinationChangedListener { _, destination, _ ->
            if (destination.id == R.id.navigation_ar || destination.id == R.id.navigation_ar_simple) {
                if (!isInArMode) {
                    isInArMode = true
                }
            } else {
                if (isInArMode) {
                    isInArMode = false
                }
            }
        }

        observeAuthEvents()
    }

    /**
     * Observes [AuthEventBus] for session expiry signals emitted by [TokenAuthenticator].
     * When the access token is invalid and cannot be refreshed, the user is sent back to
     * [AuthActivity] with the entire back-stack cleared.
     */
    private fun observeAuthEvents() {
        lifecycleScope.launch {
            AuthEventBus.events.collect { event ->
                when (event) {
                    is AuthEvent.SessionExpired -> {
                        Timber.w("MainActivity: Session expired — redirecting to login")
                        Toast.makeText(
                            this@MainActivity,
                            "Tu sesión ha expirado. Por favor inicia sesión nuevamente.",
                            Toast.LENGTH_LONG
                        ).show()
                        navigateToLogin()
                    }
                }
            }
        }
    }

    /**
     * Navigates to [AuthActivity] and clears the entire back-stack so the user
     * cannot press Back to return to a protected screen.
     */
    private fun navigateToLogin() {
        val intent = Intent(this, AuthActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }

    // Navigation is handled directly via NavController; no BottomNavigationView in game UX.

    /**
     * Checks device compatibility before navigating to the AR experience.
     *
     * Two tiers:
     *  - COMPATIBLE (verified device + ARCore) → Realidad Mixta (cloud anchors)
     *  - Everything else (DEVICE_NOT_VERIFIED / ARCORE_NOT_AVAILABLE / CHECK_FAILED)
     *    → Realidad Aumentada (Camera2 + SceneView, sin ARCore/cloud anchors)
     *
     * The result is cached for the Activity lifecycle — no repeated checks.
     */
    fun navigateToAr(navController: NavController, source: String = ArFragment.SOURCE_DEFAULT) {
        val result = getArCompatibility()

        when (result) {
            ArDeviceCompatibility.CompatibilityResult.COMPATIBLE -> {
                navController.navigate(
                    R.id.navigation_ar,
                    android.os.Bundle().apply {
                        putString(ArFragment.ARG_SOURCE, source)
                    }
                )
            }

            else -> {
                // Dispositivo no verificado, ARCore no disponible, o check fallido.
                // Todos usan Realidad Aumentada simple (Camera2 + SceneView).
                navController.navigate(R.id.navigation_ar_simple)
            }
        }
    }

    /**
     * Returns the cached AR compatibility result. Performs the check on first call.
     *
     * NOTE: This may be called during layout inflation (before binding is initialized),
     * so we guard binding access with isInitialized. The nav label is applied explicitly
     * in onCreate once binding is ready.
     */
    fun getArCompatibility(): ArDeviceCompatibility.CompatibilityResult {
        return arCompatibility ?: ArDeviceCompatibility.checkCompatibility(this).also {
            arCompatibility = it
            Timber.i("AR compatibility check: %s", it.name)
        }
    }

    private fun updateArNavLabel(result: ArDeviceCompatibility.CompatibilityResult) {
        // AR item was removed from bottom nav; label update is no longer needed
    }
}
