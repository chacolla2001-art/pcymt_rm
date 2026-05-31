package com.univalle.pedrochacolla.utils.session

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.univalle.pedrochacolla.data.model.UserData
import timber.log.Timber
import java.io.File

class SessionManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    // Encrypted preferences for sensitive data (tokens, passwords)
    private val authPrefs: SharedPreferences = createEncryptedPrefs(context, masterKey)

    // Normal preferences for non-sensitive config
    private val configPrefs: SharedPreferences = context.getSharedPreferences("user_config", Context.MODE_PRIVATE)

    private fun createEncryptedPrefs(context: Context, masterKey: MasterKey): SharedPreferences {
        return try {
            EncryptedSharedPreferences.create(
                context,
                "auth_session_encrypted",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Timber.e(e, "EncryptedSharedPreferences corrupted, clearing and recreating")
            // Delete the corrupted file and retry
            val prefsDir = File(context.filesDir.parent, "shared_prefs")
            File(prefsDir, "auth_session_encrypted.xml").delete()
            EncryptedSharedPreferences.create(
                context,
                "auth_session_encrypted",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    fun saveSession(user: UserData) {
        authPrefs.edit().apply {
            putString("idToken", user.idToken)
            putString("refreshToken", user.refreshToken)
            putString("id", user.id)
            putString("userEmail", user.email)
            putString("name", user.name)
            putString("role", user.role)
            putBoolean("isActive", user.isActive)
            putString("avatarUrl", user.avatarUrl)
            putString("googleId", user.googleId)
            putString("emailVerifiedAt", user.emailVerifiedAt)
            putString("lastLoginAt", user.lastLoginAt)
            putString("createdAt", user.createdAt)
            putString("updatedAt", user.updatedAt)
            putBoolean("mustChangePassword", user.mustChangePassword)
            apply()
        }
        UserSession.currentUser = user
    }

    fun loadSession(): Boolean {
        val token = authPrefs.getString("idToken", null) ?: return false
        val refreshToken = authPrefs.getString("refreshToken", null)
        UserSession.currentUser = UserData(
            idToken = token,
            refreshToken = refreshToken,
            id = authPrefs.getString("id", "") ?: "",
            name = authPrefs.getString("name", "") ?: "",
            email = authPrefs.getString("userEmail", "") ?: "",
            password = null,
            role = authPrefs.getString("role", "user") ?: "user",
            isActive = authPrefs.getBoolean("isActive", true),
            mustChangePassword = authPrefs.getBoolean("mustChangePassword", false),
            googleId = authPrefs.getString("googleId", null),
            avatarUrl = authPrefs.getString("avatarUrl", null),
            emailVerifiedAt = authPrefs.getString("emailVerifiedAt", null),
            lastLoginAt = authPrefs.getString("lastLoginAt", null),
            createdAt = authPrefs.getString("createdAt", null),
            updatedAt = authPrefs.getString("updatedAt", null)
        )
        return true
    }

    fun clearSession() {
        authPrefs.edit().clear().apply()
        UserSession.currentUser = null
    }

    // Remember Me functionality (only stores email, NOT password)
    fun setRememberMe(
        remember: Boolean,
        method: String,
        email: String? = null
    ) {
        configPrefs.edit().apply {
            putBoolean("rememberMe", remember)
            if (remember) {
                putString("loginMethod", method)
                if (method == "email" && email != null) {
                    // Store email in encrypted prefs for security
                    authPrefs.edit().apply {
                        putString("rememberedEmail", email)
                        apply()
                    }
                }
            } else {
                remove("loginMethod")
                authPrefs.edit().apply {
                    remove("rememberedEmail")
                    apply()
                }
            }
            apply()
        }
    }

    fun getRememberMe(): Boolean = configPrefs.getBoolean("rememberMe", false)

    fun isRememberMeEnabled(): Boolean = getRememberMe()

    fun getLoginMethod(): String? = configPrefs.getString("loginMethod", null)

    fun getRememberedEmail(): String? {
        return if (getRememberMe() && configPrefs.getString("loginMethod", "") == "email") {
            authPrefs.getString("rememberedEmail", null)
        } else {
            null
        }
    }

    fun getSavedCredentials(): Pair<String?, String?> {
        return Pair(getRememberedEmail(), null)
    }
}
