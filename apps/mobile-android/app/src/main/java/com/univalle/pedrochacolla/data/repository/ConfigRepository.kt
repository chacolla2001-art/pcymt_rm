package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.AppConfig
import com.univalle.pedrochacolla.data.remote.RetrofitClient
import timber.log.Timber

/**
 * ConfigRepository - Fetches public configuration from backend
 * Used to get WEB_CLIENT_ID and other config values
 */
class ConfigRepository {
    private val api = RetrofitClient.configApi

    suspend fun getConfig(): Result<AppConfig> {
        Timber.d("getConfig: Fetching public configuration from backend")
        return try {
            val response = api.getConfig()
            if (response.isSuccessful && response.body()?.success == true) {
                val config = response.body()?.data
                if (config != null) {
                    Timber.d("getConfig: Success - webClientId=${config.google?.webClientId?.take(20)}...")
                    Result.success(config)
                } else {
                    Timber.w("getConfig: No config data in response")
                    Result.failure(Exception("No configuration data"))
                }
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getConfig: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getConfig: Network error")
            Result.failure(e)
        }
    }

    /**
     * Get an ARCore session token for keyless authorization.
     * Required for hosting cloud anchors with TTL > 1 day.
     */
    suspend fun getArcoreToken(): Result<String> {
        Timber.d("getArcoreToken: Requesting ARCore session token from backend")
        return try {
            val response = api.getArcoreToken()
            if (response.isSuccessful && response.body()?.success == true) {
                val token = response.body()?.data?.token
                if (!token.isNullOrEmpty()) {
                    Timber.d("getArcoreToken: Token obtained, length=${token.length}")
                    Result.success(token)
                } else {
                    Timber.w("getArcoreToken: Empty token in response")
                    Result.failure(Exception("Empty ARCore token"))
                }
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getArcoreToken: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getArcoreToken: Network error")
            Result.failure(e)
        }
    }
}
