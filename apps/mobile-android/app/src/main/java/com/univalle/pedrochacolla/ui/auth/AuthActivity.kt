package com.univalle.pedrochacolla.ui.auth

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.navigation.findNavController
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.navigateUp
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.ActivityAuthBinding
import com.univalle.pedrochacolla.utils.session.SessionManager
import dagger.hilt.android.AndroidEntryPoint

/**
 * AuthActivity - Entry point for authentication flow
 * Handles login and registration fragments
 */
@AndroidEntryPoint
class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private lateinit var appBarConfiguration: AppBarConfiguration

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (!allGranted) {
            Toast.makeText(
                this,
                "La app necesita permisos de cámara y ubicación para funcionar correctamente",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (tryAutoLogin()) return

        // Always inflate the layout first so the Activity has a content view
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)
        requestPermissionsIfNeeded()

        setupNavigation()
    }

    private fun tryAutoLogin(): Boolean {
        val sessionManager = SessionManager(this)
        // Standard mobile-app behaviour: always stay logged in if a saved token exists.
        // The user must explicitly log out to clear the session.
        if (sessionManager.loadSession()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return true
        }
        return false
    }

    private fun setupNavigation() {
        val navController = findNavController(R.id.nav_host_fragment_auth)
        appBarConfiguration = AppBarConfiguration(navController.graph)
    }

    override fun onSupportNavigateUp(): Boolean {
        val navController = findNavController(R.id.nav_host_fragment_auth)
        return navController.navigateUp(appBarConfiguration) || super.onSupportNavigateUp()
    }

    private fun requestPermissionsIfNeeded() {
        val requiredPermissions = listOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        val permissionsToRequest = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
}
