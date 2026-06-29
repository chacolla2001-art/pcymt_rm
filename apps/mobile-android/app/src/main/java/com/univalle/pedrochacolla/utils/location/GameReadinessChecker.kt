package com.univalle.pedrochacolla.utils.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.core.content.ContextCompat

/**
 * Checks whether the device has all the prerequisites needed for the
 * park game experience (GPS + internet + location permission).
 *
 * Usage:
 * ```
 * val issues = GameReadinessChecker.check(context)
 * if (issues.isNotEmpty()) {
 *     // Show dialog / banner with issues
 * }
 * ```
 */
object GameReadinessChecker {

    /** One problem that prevents the game from working correctly. */
    data class Issue(
        val type: IssueType,
        val title: String,
        val description: String
    )

    enum class IssueType {
        /** Fine-location permission has not been granted. */
        PERMISSION_LOCATION,
        /** GPS (or any location provider) is turned off in system settings. */
        GPS_DISABLED,
        /** No internet connection (WiFi or mobile data). */
        NO_INTERNET
    }

    /**
     * Run all checks and return a list of [Issue]s.
     * An empty list means the device is ready to play.
     */
    fun check(context: Context): List<Issue> {
        val issues = mutableListOf<Issue>()

        // 1. Location permission
        val fineGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted) {
            issues += Issue(
                type = IssueType.PERMISSION_LOCATION,
                title = "Permiso de ubicación",
                description = "La app necesita acceso a tu ubicación para mostrar tu posición en el mapa y encontrar animales."
            )
        }

        // 2. GPS / location services enabled
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val gpsEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
        val networkLocEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
        if (!gpsEnabled && !networkLocEnabled) {
            issues += Issue(
                type = IssueType.GPS_DISABLED,
                title = "GPS desactivado",
                description = "Activa la ubicación (GPS) en los ajustes de tu teléfono para poder jugar."
            )
        }

        // 3. Internet connectivity
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val hasInternet = cm?.let { manager ->
            val network = manager.activeNetwork ?: return@let false
            val caps = manager.getNetworkCapabilities(network) ?: return@let false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        } ?: false
        if (!hasInternet) {
            issues += Issue(
                type = IssueType.NO_INTERNET,
                title = "Sin conexión a internet",
                description = "Necesitas conexión a internet (WiFi o datos móviles) para cargar el mapa y los animales."
            )
        }

        return issues
    }

    /** Convenience: true when all prerequisites are met. */
    fun isReady(context: Context): Boolean = check(context).isEmpty()
}
