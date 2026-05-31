package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import retrofit2.Response
import retrofit2.http.*

/**
 * Authentication API endpoints
 */
interface AuthApiService {
    @POST("api/auth/google")
    suspend fun loginWithGoogle(
        @Body request: Map<String, String>
    ): Response<ApiResponse<AuthResponse>>

    @POST("api/auth/login")
    suspend fun loginWithEmail(
        @Body credentials: Map<String, String>
    ): Response<ApiResponse<AuthResponse>>

    @POST("api/auth/register")
    suspend fun register(
        @Body userData: RegisterRequest
    ): Response<ApiResponse<RegisterResponse>>

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(
        @Body request: ForgotPasswordRequest
    ): Response<ApiResponse<Unit>>

    @POST("api/auth/logout")
    suspend fun logout(): Response<ApiResponse<Unit>>

    @GET("api/auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<UserResponse>>

    @POST("api/auth/refresh")
    suspend fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Response<ApiResponse<AuthResponse>>

    @POST("api/auth/resend-verification")
    suspend fun resendVerification(
        @Body request: EmailRequest
    ): Response<ApiResponse<Unit>>

    @POST("api/auth/check-verification")
    suspend fun checkVerification(
        @Body request: EmailRequest
    ): Response<ApiResponse<VerificationStatusResponse>>
}

data class RefreshTokenRequest(
    val refreshToken: String
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password_hash: String,
    val role: String = "user",
    val is_active: Boolean = true,
    val google_id: String? = null,
    val avatar_url: String? = null
)

data class ForgotPasswordRequest(
    val email: String
)

data class EmailRequest(
    val email: String
)

data class AuthResponse(
    val token: String,
    val refreshToken: String? = null,
    val expiresIn: String? = null,
    val user: UserResponse
)

data class RegisterResponse(
    val requiresEmailVerification: Boolean = false,
    val email: String,
    val user: RegistrationUserResponse? = null
)

data class RegistrationUserResponse(
    val id: String,
    val name: String?,
    val email: String
)

data class VerificationStatusResponse(
    val verified: Boolean
)

data class UserResponse(
    val id: String,
    val name: String?,
    val email: String,
    val role: String,
    val is_active: Boolean,
    val must_change_password: Boolean = false,
    val google_id: String?,
    val avatar_url: String?,
    val email_verified_at: String?,
    val last_login_at: String?,
    val created_at: String?,
    val updated_at: String?
)
