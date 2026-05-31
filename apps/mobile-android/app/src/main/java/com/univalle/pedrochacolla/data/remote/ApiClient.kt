package com.univalle.pedrochacolla.data.remote

import android.content.Context
import com.univalle.pedrochacolla.BuildConfig
import com.univalle.pedrochacolla.utils.constants.Constants
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

/**
 * Singleton HTTP client with proper configuration and logging.
 *
 * Must be initialised early in the app lifecycle via [init] (called from
 * PCymtRMApplication.onCreate) before any network request is made.
 * This is required so that [TokenAuthenticator] has access to applicationContext
 * for session management.
 */
object ApiClient {

    private lateinit var appContext: Context

    /**
     * Initialise the client with the application context.
     * Must be called once from [com.univalle.pedrochacolla.PCymtRMApplication.onCreate].
     */
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    /**
     * Lazily built OkHttpClient.
     * [init] must be called before this value is first accessed.
     */
    val instance: OkHttpClient by lazy {
        check(::appContext.isInitialized) {
            "ApiClient.init(context) must be called in Application.onCreate() before using ApiClient.instance"
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY // Full logging in debug
            } else {
                HttpLoggingInterceptor.Level.NONE // No logging in release
            }
            redactHeader("Authorization") // Prevent token leaks in logs
        }

        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())         // 1. Inject Bearer token
            .addInterceptor(loggingInterceptor)         // 2. Log requests (debug only)
            .authenticator(TokenAuthenticator(appContext)) // 3. Handle 401 → refresh / expire
            .connectTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }
}
