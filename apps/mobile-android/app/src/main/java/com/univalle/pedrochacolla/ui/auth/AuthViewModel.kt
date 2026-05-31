package com.univalle.pedrochacolla.ui.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.UserData
import com.univalle.pedrochacolla.data.repository.AuthRepository
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.univalle.pedrochacolla.data.remote.api.AuthResponse
import com.univalle.pedrochacolla.data.remote.api.UserResponse
import timber.log.Timber
import java.io.File
import javax.inject.Inject

/**
 * AuthViewModel - Handles authentication logic for login, registration, and profile updates
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: AuthRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val state: StateFlow<AuthUiState> = _state

    private val session = SessionManager(context)

    init {
        Timber.d("AuthViewModel initialized")
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGIN METHODS
    // ═══════════════════════════════════════════════════════════════

    fun loginWithGoogle(idToken: String, remember: Boolean) {
        Timber.d("loginWithGoogle: Starting Google login (remember=$remember)")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            Timber.d("loginWithGoogle: State -> Loading")

            repository.loginWithGoogleIdToken(idToken)
                .onSuccess { (token, authData) ->
                    Timber.i("loginWithGoogle: Login successful")
                    handleLoginSuccess(token, authData, remember, "google")
                }
                .onFailure {
                    Timber.e(it, "loginWithGoogle: Login failed")
                    _state.value = AuthUiState.Error(mapLoginError(it))
                }
        }
    }

    fun loginWithEmailAndPassword(email: String, password: String, remember: Boolean) {
        Timber.d("loginWithEmailAndPassword: Starting email login for $email (remember=$remember)")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            Timber.d("loginWithEmailAndPassword: State -> Loading")

            repository.loginWithEmail(email, password)
                .onSuccess { (token, authData) ->
                    Timber.i("loginWithEmailAndPassword: Login successful for $email")
                    handleLoginSuccess(token, authData, remember, "email", email, password)
                }
                .onFailure {
                    Timber.e(it, "loginWithEmailAndPassword: Login failed for $email")
                    if (isEmailVerificationRequired(it)) {
                        _state.value = AuthUiState.EmailVerificationRequired(email)
                    } else {
                        _state.value = AuthUiState.Error(mapLoginError(it))
                    }
                }
        }
    }

    private fun handleLoginSuccess(
        token: String,
        authData: AuthResponse,
        remember: Boolean,
        method: String,
        email: String? = null,
        password: String? = null
    ) {
        Timber.d("handleLoginSuccess: Processing login success for method=$method")
        val userResponse = authData.user

        val user = extractUserFromResponse(token, authData.refreshToken, userResponse)
        session.saveSession(user)
        Timber.i("handleLoginSuccess: Session saved for user ${user.name}")

        if (method == "email" && email != null) {
            // Always persist the session (standard mobile-app behaviour).
            // rememberMe is used only to pre-fill the email field on next launch.
            session.setRememberMe(true, method, email)
            Timber.d("handleLoginSuccess: Remember Me set for $email")
        } else {
            session.setRememberMe(true, method)
            Timber.d("handleLoginSuccess: Remember Me set for $method")
        }

        if (user.mustChangePassword) {
            Timber.w("handleLoginSuccess: User must change password, redirecting")
            _state.value = AuthUiState.MustChangePassword
        } else {
            _state.value = AuthUiState.LoginSuccess
            Timber.d("handleLoginSuccess: State -> LoginSuccess")
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTRATION
    // ═══════════════════════════════════════════════════════════════

    fun registerUser(user: UserData) {
        Timber.d("registerUser: Starting registration for ${user.email}")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            Timber.d("registerUser: State -> Loading")

            repository.registerUser(user.toRegisterRequest())
                .onSuccess { registerData ->
                    Timber.i("registerUser: Registration successful for ${user.email}")
                    if (registerData.requiresEmailVerification) {
                        _state.value = AuthUiState.EmailVerificationRequired(registerData.email)
                    } else {
                        _state.value = AuthUiState.RegisterSuccess
                    }
                }
                .onFailure {
                    Timber.e(it, "registerUser: Registration error")
                    _state.value = AuthUiState.Error(mapRegistrationError(it))
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROFILE UPDATE
    // ═══════════════════════════════════════════════════════════════

    fun updateUserProfile(userId: String, updatedData: Map<String, Any>) {
        Timber.d("updateUserProfile: Updating profile for userId=$userId with fields: ${updatedData.keys}")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            Timber.d("updateUserProfile: State -> Loading")

            repository.updateUser(userId, updatedData)
                .onSuccess {
                    val current = UserSession.currentUser ?: return@onSuccess

                    val updatedUser = current.copy(
                        name = updatedData["name"] as? String ?: current.name,
                        email = updatedData["email"] as? String ?: current.email,
                        password = updatedData["password"] as? String ?: current.password
                    )

                    UserSession.currentUser = updatedUser
                    session.saveSession(updatedUser)
                    Timber.i("updateUserProfile: Success - profile updated and session saved")
                    _state.value = AuthUiState.UpdateSuccess
                    Timber.d("updateUserProfile: State -> UpdateSuccess")
                }
                .onFailure {
                    Timber.e(it, "updateUserProfile: Profile update failed")
                    _state.value = AuthUiState.Error(it.message ?: "Error al actualizar perfil")
                }
        }
    }

    fun updatePhoto(userId: String, imageFile: File) {
        Timber.d("updatePhoto: Uploading photo for userId=$userId, size=${imageFile.length()} bytes")

        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            Timber.d("updatePhoto: State -> Loading")

            repository.uploadProfilePhoto(userId, imageFile)
                .onSuccess { newUrl ->
                    val updatedUser = UserSession.currentUser?.copy(avatarUrl = newUrl)
                        ?: return@onSuccess

                    UserSession.currentUser = updatedUser
                    session.saveSession(updatedUser)
                    Timber.i("updatePhoto: Success - photo updated to: $newUrl")
                    _state.value = AuthUiState.PhotoUpdated(newUrl)
                    Timber.d("updatePhoto: State -> PhotoUpdated")
                }
                .onFailure {
                    Timber.e(it, "updatePhoto: Photo upload failed")
                    _state.value = AuthUiState.Error(it.message ?: "Error subiendo foto")
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSWORD RECOVERY
    // ═══════════════════════════════════════════════════════════════

    fun forgotPassword(email: String) {
        Timber.d("forgotPassword: Requesting recovery for $email")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading
            repository.forgotPassword(email)
                .onSuccess {
                    Timber.i("forgotPassword: Recovery request sent for $email")
                    _state.value = AuthUiState.ForgotPasswordSuccess
                }
                .onFailure {
                    Timber.e(it, "forgotPassword: Failed for $email")
                    _state.value = AuthUiState.Error(it.message ?: "Error al recuperar contraseña")
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION CHECKS
    // ═══════════════════════════════════════════════════════════════

    suspend fun checkEmailExists(email: String) = repository.emailExists(email)
    suspend fun resendVerificationEmail(email: String) = repository.resendVerificationEmail(email)
    suspend fun checkEmailVerification(email: String) = repository.checkEmailVerification(email)

    // ═══════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════

    private fun extractUserFromResponse(token: String, refreshToken: String?, user: UserResponse) = UserData(
        idToken = token,
        refreshToken = refreshToken,
        id = user.id ?: "",
        name = user.name ?: "Usuario",
        email = user.email ?: "",
        password = null,
        role = user.role ?: "user",
        isActive = user.is_active,
        mustChangePassword = user.must_change_password,
        googleId = user.google_id,
        avatarUrl = user.avatar_url,
        emailVerifiedAt = user.email_verified_at,
        lastLoginAt = user.last_login_at,
        createdAt = user.created_at,
        updatedAt = user.updated_at
    )

    // ═══════════════════════════════════════════════════════════════
    // FORCE PASSWORD CHANGE (after forgot password flow)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Change password for users flagged with must_change_password = true.
     * On success emits LoginSuccess (the flag is cleared by the backend on password update).
     */
    fun forceChangePassword(newPassword: String) {
        val userId = UserSession.currentUser?.id ?: run {
            _state.value = AuthUiState.Error("Sesión no encontrada. Vuelve a iniciar sesión.")
            return
        }

        Timber.d("forceChangePassword: Changing password for userId=$userId")
        viewModelScope.launch {
            _state.value = AuthUiState.Loading

            repository.updateUser(userId, mapOf("password_hash" to newPassword))
                .onSuccess {
                    val updated = UserSession.currentUser?.copy(mustChangePassword = false)
                    if (updated != null) {
                        UserSession.currentUser = updated
                        session.saveSession(updated)
                    }
                    Timber.i("forceChangePassword: Password changed successfully")
                    _state.value = AuthUiState.LoginSuccess
                }
                .onFailure {
                    Timber.e(it, "forceChangePassword: Failed")
                    _state.value = AuthUiState.Error(it.message ?: "Error al cambiar la contraseña")
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR MAPPING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Traduce errores técnicos del backend a mensajes amigables en español.
     */
    private fun mapLoginError(error: Throwable): String {
        val msg = error.message ?: ""
        return when {
            isEmailVerificationRequired(error) ->
                "Debes verificar tu correo antes de iniciar sesión."
            msg.contains("Invalid email or password", ignoreCase = true) ||
            msg.contains("HTTP 401", ignoreCase = true) ||
            msg.contains("401") ->
                "Correo electrónico o contraseña incorrectos"
            msg.contains("inactive", ignoreCase = true) ->
                "Tu cuenta está inactiva. Contacta al administrador."
            msg.contains("not found", ignoreCase = true) ||
            msg.contains("404") ->
                "No existe una cuenta con ese correo electrónico"
            msg.contains("UnknownHostException", ignoreCase = true) ||
            msg.contains("Unable to resolve host", ignoreCase = true) ||
            msg.contains("SocketTimeoutException", ignoreCase = true) ||
            msg.contains("timeout", ignoreCase = true) ->
                "Sin conexión a internet. Verifica tu red e intenta de nuevo."
            else -> "Error al iniciar sesión. Intenta de nuevo."
        }
    }

    private fun mapRegistrationError(error: Throwable): String {
        val msg = error.message ?: ""
        return when {
            msg.contains("already registered", ignoreCase = true) ||
            msg.contains("ya está registrado", ignoreCase = true) ||
            msg.contains("HTTP 409", ignoreCase = true) ||
            msg.contains("409") ->
                "Este correo ya está registrado. Inicia sesión o recupera tu contraseña."
            msg.contains("protected account", ignoreCase = true) ->
                "Este correo pertenece a una cuenta protegida y no puede registrarse nuevamente."
            msg.contains("UnknownHostException", ignoreCase = true) ||
            msg.contains("Unable to resolve host", ignoreCase = true) ||
            msg.contains("SocketTimeoutException", ignoreCase = true) ||
            msg.contains("timeout", ignoreCase = true) ->
                "Sin conexión a internet. Verifica tu red e intenta de nuevo."
            else -> "No se pudo crear la cuenta. Intenta de nuevo."
        }
    }

    private fun isEmailVerificationRequired(error: Throwable): Boolean {
        val msg = error.message ?: ""
        return msg.contains("email not verified", ignoreCase = true) ||
            msg.contains("verify your email", ignoreCase = true)
    }
}
