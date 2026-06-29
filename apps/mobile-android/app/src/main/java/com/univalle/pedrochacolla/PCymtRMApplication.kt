package com.univalle.pedrochacolla

import android.app.Application
import com.univalle.pedrochacolla.data.remote.ApiClient
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

/**
 * PCymtRMApplication - Main Application class with Hilt dependency injection
 *
 * @HiltAndroidApp triggers Hilt's code generation including:
 * - Application-level component
 * - Component hierarchy
 * - Module installation
 *
 * This enables dependency injection throughout the app
 *
 * Also initializes Timber for structured logging across the app
 */
@HiltAndroidApp
class PCymtRMApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        ApiClient.init(this) // Must be first — TokenAuthenticator needs applicationContext
        setupLogging()
    }

    /**
     * Setup Timber logging trees
     * - DEBUG: Full logging with debug tree
     * - RELEASE: Crashlytics tree for production error reporting
     */
    private fun setupLogging() {
        if (BuildConfig.DEBUG) {
            // Debug build - verbose logging
            Timber.plant(Timber.DebugTree())
            Timber.d("Timber initialized in DEBUG mode")
        } else {
            // Release build - only log errors to Crashlytics
            Timber.plant(CrashlyticsTree())
            Timber.d("Timber initialized in RELEASE mode with Crashlytics")
        }
    }

    /**
     * Custom Timber tree for production builds
     * Logs errors and warnings to Crashlytics (or other crash reporting service)
     */
    private class CrashlyticsTree : Timber.Tree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            // Only log warnings, errors, and exceptions in production
            if (priority < android.util.Log.WARN) return

            // TODO: Replace with actual Crashlytics logging when Firebase is configured
            // FirebaseCrashlytics.getInstance().apply {
            //     setCustomKey("priority", priority)
            //     tag?.let { setCustomKey("tag", it) }
            //     log(message)
            //     t?.let { recordException(it) }
            // }

            // Placeholder: Log to system log for now
            android.util.Log.println(priority, tag ?: "PCymtRM", message)
            t?.printStackTrace()
        }
    }
}
