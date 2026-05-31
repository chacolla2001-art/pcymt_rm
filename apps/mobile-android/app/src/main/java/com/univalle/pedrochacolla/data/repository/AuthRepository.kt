package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.remote.RetrofitClient
import com.univalle.pedrochacolla.data.remote.api.AuthResponse
import com.univalle.pedrochacolla.data.remote.api.ChangePasswordRequest
import com.univalle.pedrochacolla.data.remote.api.DeleteAccountRequest
import com.univalle.pedrochacolla.data.remote.api.EmailRequest
import com.univalle.pedrochacolla.data.remote.api.ForgotPasswordRequest
import com.univalle.pedrochacolla.data.remote.api.RefreshTokenRequest
import com.univalle.pedrochacolla.data.remote.api.RegisterResponse
import com.univalle.pedrochacolla.data.remote.api.RegisterRequest
import com.univalle.pedrochacolla.data.remote.api.UserResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import timber.log.Timber
import java.io.File

/**
 * AuthRepository - Handles authentication operations
 * Uses Retrofit for API calls with automatic token injection via AuthInterceptor
 *
 * SECURITY NOTE: Logging deliberately avoids sensitive data (passwords, tokens)
 */
class AuthRepository {
    private val authApi = RetrofitClient.authApi
    private val userApi = RetrofitClient.userApi

    suspend fun loginWithGoogleIdToken(idToken: String): Result<Pair<String, AuthResponse>> =
        withContext(Dispatchers.IO) {
            Timber.d("loginWithGoogle: Attempting Google login")
            try {
                val request = mapOf("idToken" to idToken)
                val response = authApi.loginWithGoogle(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    val authData = response.body()?.data
                    if (authData == null) {
                        Timber.e("loginWithGoogle: No auth data in response")
                        return@withContext Result.failure(Exception("Invalid response format"))
                    }
                    Timber.i("loginWithGoogle: Success - user ${authData.user.name} logged in")
                    Result.success(Pair(authData.token, authData))
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("loginWithGoogle: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "loginWithGoogle: Network error")
                Result.failure(e)
            }
        }

    suspend fun loginWithEmail(email: String, password: String): Result<Pair<String, AuthResponse>> =
        withContext(Dispatchers.IO) {
            Timber.d("loginWithEmail: Attempting email login for $email")  // Safe to log email
            try {
                val credentials = mapOf(
                    "email" to email,
                    "password" to password,  // Never logged
                    "platform" to "mobile"
                )
                val response = authApi.loginWithEmail(credentials)

                if (response.isSuccessful && response.body()?.success == true) {
                    val authData = response.body()?.data
                    if (authData == null) {
                        Timber.e("loginWithEmail: No auth data in response")
                        return@withContext Result.failure(Exception("Invalid response format"))
                    }
                    Timber.i("loginWithEmail: Success - user ${authData.user.name} logged in")
                    Result.success(Pair(authData.token, authData))
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("loginWithEmail: API error - $errorMsg for $email")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "loginWithEmail: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun registerUser(data: RegisterRequest): Result<RegisterResponse> =
        withContext(Dispatchers.IO) {
            val email = data.email
            Timber.d("registerUser: Attempting registration for $email")
            try {
                val response = authApi.register(data)

                if (response.isSuccessful && response.body()?.success == true) {
                    val authData = response.body()?.data
                    if (authData == null) {
                        Timber.e("registerUser: No auth data in response")
                        return@withContext Result.failure(Exception("Invalid response format"))
                    }
                    Timber.i("registerUser: Success - registration created for $email")
                    Result.success(authData)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("registerUser: API error - $errorMsg for $email")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "registerUser: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun resendVerificationEmail(email: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            Timber.d("resendVerificationEmail: Requesting resend for $email")
            try {
                val response = authApi.resendVerification(EmailRequest(email))
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(Unit)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "resendVerificationEmail: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun checkEmailVerification(email: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            Timber.d("checkEmailVerification: Checking verification for $email")
            try {
                val response = authApi.checkVerification(EmailRequest(email))
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(response.body()?.data?.verified == true)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "checkEmailVerification: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun forgotPassword(email: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            Timber.d("forgotPassword: Requesting password recovery for $email")
            try {
                val request = ForgotPasswordRequest(email)
                val response = authApi.forgotPassword(request)

                if (response.isSuccessful) {
                    Timber.i("forgotPassword: Request sent successfully for $email")
                    Result.success(Unit)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("forgotPassword: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "forgotPassword: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun logout(): Result<Unit> =
        try {
            Timber.d("logout: Logging out user")
            val response = authApi.logout()
            if (response.isSuccessful && response.body()?.success == true) {
                Timber.i("logout: Success - user logged out")
                Result.success(Unit)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("logout: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "logout: Network error")
            Result.failure(e)
        }

    suspend fun refreshToken(refreshToken: String): Result<Pair<String, String?>> =
        withContext(Dispatchers.IO) {
            Timber.d("refreshToken: Attempting to refresh access token")
            try {
                val request = RefreshTokenRequest(refreshToken)
                val response = authApi.refreshToken(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data == null) {
                        Timber.e("refreshToken: No data in response")
                        return@withContext Result.failure(Exception("Invalid response format"))
                    }
                    Timber.i("refreshToken: Success - tokens refreshed")
                    Result.success(Pair(data.token, data.refreshToken))
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("refreshToken: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "refreshToken: Network error")
                Result.failure(e)
            }
        }

    suspend fun getCurrentUser(): Result<UserResponse> {
        return try {
            Timber.d("getCurrentUser: Fetching current user data")
            val response = authApi.getCurrentUser()
            if (response.isSuccessful && response.body()?.success == true) {
                val userData = response.body()?.data
                if (userData == null) {
                    Timber.e("getCurrentUser: No user data in response")
                    return Result.failure(Exception("User data not found"))
                }
                Timber.d("getCurrentUser: Success - fetched data for ${userData.name}")
                Result.success(userData)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getCurrentUser: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getCurrentUser: Network error")
            Result.failure(e)
        }
    }

    suspend fun updateUser(userId: String, updatedData: Map<String, Any>): Result<UserResponse> {
        return try {
            Timber.d("updateUser: Updating user id=$userId with fields: ${updatedData.keys}")
            val response = userApi.updateUser(userId, updatedData)
            if (response.isSuccessful && response.body()?.success == true) {
                val userData = response.body()?.data
                if (userData == null) {
                    Timber.e("updateUser: No user data in response")
                    return Result.failure(Exception("User data not found"))
                }
                Timber.i("updateUser: Success - updated user ${userData.name}")
                Result.success(userData)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("updateUser: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "updateUser: Network error for userId=$userId")
            Result.failure(e)
        }
    }

    suspend fun uploadProfilePhoto(userId: String, file: File): Result<String> =
        withContext(Dispatchers.IO) {
            Timber.d("uploadProfilePhoto: Uploading photo for userId=$userId, size=${file.length()} bytes")
            try {
                val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
                val photoPart = MultipartBody.Part.createFormData("profile_picture_url", file.name, requestFile)

                val response = userApi.updateProfilePhoto(userId, photoPart)

                if (response.isSuccessful && response.body()?.success == true) {
                    val avatarUrl = response.body()?.data?.get("avatar_url")
                        ?: response.body()?.data?.get("profile_picture_url")
                    if (avatarUrl == null) {
                        Timber.e("uploadProfilePhoto: No avatar URL in response")
                        return@withContext Result.failure(Exception("Avatar URL not found"))
                    }
                    Timber.i("uploadProfilePhoto: Success - photo uploaded")
                    Result.success(avatarUrl)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("uploadProfilePhoto: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "uploadProfilePhoto: Network error for userId=$userId")
                Result.failure(e)
            }
        }

    suspend fun emailExists(email: String): Result<Boolean> =
        try {
            val request = mapOf("email" to email)
            val response = userApi.checkEmailExists(request)

            if (response.isSuccessful) {
                val exists = response.body()?.get("exists") ?: false
                Result.success(exists)
            } else {
                Result.failure(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }

    suspend fun changePassword(
        email: String,
        currentPassword: String,
        newPassword: String
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            Timber.d("changePassword: Attempting password change for $email")
            try {
                val request = ChangePasswordRequest(
                    email = email,
                    currentPassword = currentPassword,
                    newPassword = newPassword
                )
                val response = userApi.changePassword(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    Timber.i("changePassword: Password changed successfully for $email")
                    Result.success(Unit)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("changePassword: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "changePassword: Network error for $email")
                Result.failure(e)
            }
        }

    suspend fun deleteAccount(currentPassword: String?): Result<Unit> =
        withContext(Dispatchers.IO) {
            Timber.d("deleteAccount: Attempting self-delete")
            try {
                val response = userApi.deleteAccount(
                    DeleteAccountRequest(currentPassword = currentPassword?.takeIf { it.isNotBlank() })
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    Timber.i("deleteAccount: Account deleted successfully")
                    Result.success(Unit)
                } else {
                    val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                    Timber.w("deleteAccount: API error - $errorMsg")
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Timber.e(e, "deleteAccount: Network error")
                Result.failure(e)
            }
        }

}
