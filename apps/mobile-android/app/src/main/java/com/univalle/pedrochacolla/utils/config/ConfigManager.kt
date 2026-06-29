package com.univalle.pedrochacolla.utils.config

import com.univalle.pedrochacolla.data.model.AppConfig
import com.univalle.pedrochacolla.data.repository.ConfigRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber

/**
 * ConfigManager - Singleton that manages app configuration fetched from backend
 * 
 * Must be initialized at app startup before Google Sign In is used:
 * ```
 * lifecycleScope.launch {
 *     ConfigManager.initialize()
 * }
 * ```
 */
object ConfigManager {
    private var config: AppConfig? = null
    private var initialized = false
    private var initError: String? = null

    /**
     * Initialize configuration from backend
     * Should be called once at app startup
     */
    suspend fun initialize(): Result<AppConfig> {
        if (initialized && config != null) {
            return Result.success(config!!)
        }

        return withContext(Dispatchers.IO) {
            try {
                val repository = ConfigRepository()
                val result = repository.getConfig()
                
                if (result.isSuccess) {
                    config = result.getOrNull()
                    initialized = true
                    initError = null
                    Timber.d("ConfigManager: Initialized successfully")
                    Result.success(config!!)
                } else {
                    initError = result.exceptionOrNull()?.message
                    Timber.e("ConfigManager: Failed to initialize - $initError")
                    result
                }
            } catch (e: Exception) {
                initError = e.message
                Timber.e(e, "ConfigManager: Exception during initialization")
                Result.failure(e)
            }
        }
    }

    /**
     * Get the Google Web Client ID for OAuth
     * Returns null if not initialized or not available
     */
    fun getWebClientId(): String? {
        return config?.google?.webClientId
    }

    /**
     * Check if Google Auth is enabled on backend
     */
    fun isGoogleAuthEnabled(): Boolean {
        return config?.features?.googleAuthEnabled == true
    }

    /**
     * Check if Maps feature is enabled
     */
    fun isMapsEnabled(): Boolean {
        return config?.features?.mapsEnabled == true
    }

    /**
     * Get Cloud Anchor TTL in days (1-365)
     * Returns 1 if not configured
     */
    fun getCloudAnchorTtlDays(): Int {
        return config?.arcore?.cloudAnchorTtlDays ?: 1
    }

    /**
     * Get initialization error if any
     */
    fun getInitError(): String? = initError

    /**
     * Check if config is loaded
     */
    fun isInitialized(): Boolean = initialized && config != null

    /**
     * Force re-initialization (for retry)
     */
    fun reset() {
        config = null
        initialized = false
        initError = null
    }

    /**
     * Force a fresh fetch of configuration from backend.
     * Unlike [initialize], this always hits the network even if already cached.
     * Useful before hosting cloud anchors to ensure the latest TTL is used.
     */
    suspend fun refresh(): Result<AppConfig> {
        reset()
        return initialize()
    }

    /**
     * Get an ARCore session token for keyless authorization.
     * Required for cloud anchors with TTL > 1 day.
     * Always fetches a fresh token from the backend.
     */
    suspend fun getArcoreToken(): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                val repository = ConfigRepository()
                repository.getArcoreToken()
            } catch (e: Exception) {
                Timber.e(e, "ConfigManager: Failed to get ARCore token")
                Result.failure(e)
            }
        }
    }
}
