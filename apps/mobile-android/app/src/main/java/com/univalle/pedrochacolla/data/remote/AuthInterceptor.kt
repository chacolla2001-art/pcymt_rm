package com.univalle.pedrochacolla.data.remote

import com.univalle.pedrochacolla.utils.session.UserSession
import okhttp3.Interceptor
import okhttp3.Response

/**
 * AuthInterceptor - Auto-injects JWT tokens into all API requests
 *
 * This interceptor automatically adds the Authorization header with the
 * current user's JWT token from UserSession, eliminating the need to
 * manually pass tokens to every API call.
 *
 * Supports both access tokens and refresh tokens.
 *
 * Usage: Add to OkHttpClient in ApiClient/RetrofitClient
 */
class AuthInterceptor : Interceptor {
    
    companion object {
        /** URLs that should not include the auth token */
        private val SKIP_AUTH_URLS = listOf(
            "api/auth/login",
            "api/auth/register",
            "api/auth/google",
            "api/auth/refresh",
            "api/users/recover-password"
        )
    }
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val url = request.url.toString()
        
        // Skip auth header for public endpoints
        if (SKIP_AUTH_URLS.any { url.contains(it) }) {
            return chain.proceed(request)
        }
        
        val token = UserSession.currentUser?.idToken
        val authenticatedRequest = if (!token.isNullOrEmpty()) {
            request.newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        
        return chain.proceed(authenticatedRequest)
    }
}
