package com.univalle.pedrochacolla.data.model

import com.univalle.pedrochacolla.data.remote.api.RegisterRequest

data class UserData(
    val idToken: String? = null,
    val refreshToken: String? = null,
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val password: String? = null,
    val role: String = "user",
    val isActive: Boolean = true,
    val mustChangePassword: Boolean = false,
    val googleId: String? = null,
    val avatarUrl: String? = null,
    val emailVerifiedAt: String? = null,
    val lastLoginAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
) {
    /**
     * Para el registro en el backend, usa un objeto tipado
     * compatible con Retrofit (evita wildcards en Map<String, Any>).
     */
    fun toRegisterRequest(): RegisterRequest = RegisterRequest(
        name = name,
        email = email,
        password_hash = password ?: "",
        role = role,
        is_active = isActive,
        google_id = googleId?.takeIf { it.isNotBlank() },
        avatar_url = avatarUrl?.takeIf { it.isNotBlank() }
    )

}
