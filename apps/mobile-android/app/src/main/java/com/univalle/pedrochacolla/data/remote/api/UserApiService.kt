package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

/**
 * User Management API endpoints
 */
interface UserApiService {
    @GET("api/users/{id}")
    suspend fun getUserById(
        @Path("id") id: String
    ): Response<ApiResponse<UserResponse>>

    @PUT("api/users/{id}")
    suspend fun updateUser(
        @Path("id") id: String,
        @Body updates: Map<String, @JvmSuppressWildcards Any>
    ): Response<ApiResponse<UserResponse>>

    @Multipart
    @PATCH("api/users/{id}/profile-picture")
    suspend fun updateProfilePhoto(
        @Path("id") id: String,
        @Part photo: MultipartBody.Part
    ): Response<ApiResponse<Map<String, String>>>

    @POST("api/users/check-email")
    suspend fun checkEmailExists(
        @Body request: Map<String, String>
    ): Response<Map<String, Boolean>>

    /**
     * Request password recovery - sends email with new password
     */
    @POST("api/users/recover-password")
    suspend fun recoverPassword(
        @Body request: RecoverPasswordRequest
    ): Response<ApiResponse<Unit>>

    /**
     * Verify current password
     */
    @POST("api/users/verify-password")
    suspend fun verifyPassword(
        @Body request: VerifyPasswordRequest
    ): Response<ApiResponse<Unit>>

    /**
     * Change password
     */
    @POST("api/users/change-password")
    suspend fun changePassword(
        @Body request: ChangePasswordRequest
    ): Response<ApiResponse<Unit>>

    @HTTP(method = "DELETE", path = "api/users/me", hasBody = true)
    suspend fun deleteAccount(
        @Body request: DeleteAccountRequest
    ): Response<ApiResponse<Unit>>
}

data class RecoverPasswordRequest(
    val email: String
)

data class VerifyPasswordRequest(
    val email: String,
    val password: String
)

data class ChangePasswordRequest(
    val email: String,
    val currentPassword: String,
    val newPassword: String
)

data class DeleteAccountRequest(
    val currentPassword: String? = null
)
