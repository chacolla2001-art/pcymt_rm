package com.univalle.pedrochacolla.data.remote

import android.content.Context
import com.univalle.pedrochacolla.utils.constants.Constants
import com.univalle.pedrochacolla.utils.session.AuthEvent
import com.univalle.pedrochacolla.utils.session.AuthEventBus
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import org.json.JSONObject
import timber.log.Timber

/**
 * TokenAuthenticator — OkHttp Authenticator for transparent JWT token refresh.
 *
 * Invoked automatically by OkHttp whenever a protected request returns HTTP 401.
 *
 * Flow:
 *  1. Skip non-retryable cases (auth endpoints, already-retried requests, no refresh token).
 *  2. Attempt a synchronous token refresh against  POST api/auth/refresh.
 *  3. On success → update session + retry original request with new access token.
 *  4. On failure → clear session + emit SessionExpired so MainActivity navigates to login.
 *
 * A dedicated single-use OkHttpClient (no interceptors, no authenticator) is used for
 * the refresh call to avoid re-entering this authenticator.
 */
class TokenAuthenticator(private val context: Context) : Authenticator {

    companion object {
        /** Auth endpoints that should never trigger token refresh */
        private val SKIP_AUTH_URLS = listOf(
            "api/auth/login",
            "api/auth/register",
            "api/auth/google",
            "api/auth/refresh",
            "api/users/recover-password"
        )

        /** Header used as a "retry sentinel" to avoid infinite loops */
        private const val RETRY_HEADER = "X-Retry-Auth"

        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        private const val REFRESH_PATH = "api/auth/refresh"
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        val url = response.request.url.toString()

        // 1. Never intercept auth/public endpoints
        if (SKIP_AUTH_URLS.any { url.contains(it) }) {
            Timber.d("TokenAuthenticator: Skipping auth endpoint — $url")
            return null
        }

        // 2. Already retried once → give up to avoid infinite loop
        if (response.request.header(RETRY_HEADER) != null) {
            Timber.w("TokenAuthenticator: Already retried for $url — expiring session")
            expireSession()
            return null
        }

        // 3. No refresh token stored → nothing we can do
        val refreshToken = UserSession.currentUser?.refreshToken
        if (refreshToken.isNullOrBlank()) {
            Timber.w("TokenAuthenticator: No refresh token available — expiring session")
            expireSession()
            return null
        }

        // 4. Attempt synchronous refresh
        Timber.d("TokenAuthenticator: 401 received — attempting token refresh")
        val newToken = tryRefreshToken(refreshToken)

        return if (newToken != null) {
            Timber.i("TokenAuthenticator: Token refreshed — retrying original request")
            response.request.newBuilder()
                .removeHeader("Authorization")
                .addHeader("Authorization", "Bearer $newToken")
                .addHeader(RETRY_HEADER, "1") // mark as retried
                .build()
        } else {
            Timber.w("TokenAuthenticator: Refresh failed — expiring session")
            expireSession()
            null
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Private helpers
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Synchronously hit POST api/auth/refresh using a plain OkHttpClient
     * (no AuthInterceptor, no TokenAuthenticator) to prevent re-entry.
     *
     * @return new access token string on success, null on any failure.
     */
    private fun tryRefreshToken(refreshToken: String): String? {
        return try {
            val client = OkHttpClient.Builder().build() // minimal client — no interceptors

            val body = """{"refreshToken":"$refreshToken"}"""
                .toRequestBody(JSON_MEDIA_TYPE)

            val request = Request.Builder()
                .url("${Constants.URL_BASE.trimEnd('/')}/${REFRESH_PATH}")
                .post(body)
                .build()

            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                Timber.w("TokenAuthenticator: Refresh HTTP ${response.code} — cannot renew token")
                return null
            }

            val responseBody = response.body?.string() ?: return null
            val json = JSONObject(responseBody)
            val data = json.optJSONObject("data") ?: return null

            val newToken = data.optString("token").takeIf { it.isNotEmpty() } ?: return null
            val newRefreshToken = data.optString("refreshToken").takeIf { it.isNotEmpty() }

            // Persist updated tokens so subsequent requests use the new ones
            val currentUser = UserSession.currentUser ?: return null
            val updatedUser = currentUser.copy(
                idToken = newToken,
                refreshToken = newRefreshToken ?: currentUser.refreshToken
            )
            SessionManager(context).saveSession(updatedUser)

            newToken
        } catch (e: Exception) {
            Timber.e(e, "TokenAuthenticator: Exception during token refresh")
            null
        }
    }

    /**
     * Clears the local session and broadcasts [AuthEvent.SessionExpired].
     * MainActivity observes this event and navigates the user to AuthActivity.
     */
    private fun expireSession() {
        SessionManager(context).clearSession()
        AuthEventBus.emit(AuthEvent.SessionExpired)
    }
}
