package com.univalle.pedrochacolla.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.univalle.pedrochacolla.data.model.PredefinedAvatar
import com.univalle.pedrochacolla.data.repository.AuthRepository
import com.univalle.pedrochacolla.data.repository.ConfigRepository
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File

sealed class ProfileUiState {
    object Idle : ProfileUiState()
    object Loading : ProfileUiState()
    object UpdateSuccess : ProfileUiState()
    object PasswordChanged : ProfileUiState()
    object AccountDeleted : ProfileUiState()
    data class PhotoUpdated(val newUrl: String) : ProfileUiState()
    data class AvatarsLoaded(val avatars: List<PredefinedAvatar>) : ProfileUiState()
    data class AvatarUpdated(val newUrl: String) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
}

class ProfileViewModel(
    private val repository: AuthRepository = AuthRepository(),
    private val configRepository: ConfigRepository = ConfigRepository(),
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _avatars = MutableStateFlow<List<PredefinedAvatar>>(emptyList())
    val avatars: StateFlow<List<PredefinedAvatar>> = _avatars

    private val _state = MutableStateFlow<ProfileUiState>(ProfileUiState.Idle)
    val state: StateFlow<ProfileUiState> = _state

    fun updateProfile(userId: String, updatedData: Map<String, Any>) {
        viewModelScope.launch {
            _state.value = ProfileUiState.Loading

            repository.updateUser(userId, updatedData)
                .onSuccess {
                    val current = UserSession.currentUser ?: return@onSuccess

                    val updatedUser = current.copy(
                        name = updatedData["name"] as? String ?: current.name,
                        email = updatedData["email"] as? String ?: current.email,
                        password = updatedData["password"] as? String ?: current.password
                    )

                    UserSession.currentUser = updatedUser
                    sessionManager.saveSession(updatedUser)
                    _state.value = ProfileUiState.UpdateSuccess
                }
                .onFailure {
                    _state.value = ProfileUiState.Error(it.message ?: "Error al actualizar perfil")
                }
        }
    }

    fun changePassword(email: String, currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _state.value = ProfileUiState.Loading

            repository.changePassword(email, currentPassword, newPassword)
                .onSuccess {
                    _state.value = ProfileUiState.PasswordChanged
                }
                .onFailure {
                    _state.value = ProfileUiState.Error(it.message ?: "Error al cambiar la contraseña")
                }
        }
    }

    fun deleteAccount(currentPassword: String?) {
        viewModelScope.launch {
            _state.value = ProfileUiState.Loading

            repository.deleteAccount(currentPassword)
                .onSuccess {
                    sessionManager.clearSession()
                    _state.value = ProfileUiState.AccountDeleted
                }
                .onFailure {
                    _state.value = ProfileUiState.Error(it.message ?: "Error al eliminar la cuenta")
                }
        }
    }

    fun loadAvatars() {
        viewModelScope.launch {
            configRepository.getConfig()
                .onSuccess { config ->
                    val list = config.avatars.orEmpty()
                    _avatars.value = list
                    _state.value = ProfileUiState.AvatarsLoaded(list)
                }
        }
    }

    fun setAvatar(userId: String, avatarId: String) {
        viewModelScope.launch {
            _state.value = ProfileUiState.Loading

            repository.setPredefinedAvatar(userId, avatarId)
                .onSuccess { newUrl ->
                    val updatedUser = UserSession.currentUser?.copy(avatarUrl = newUrl)
                        ?: return@onSuccess

                    UserSession.currentUser = updatedUser
                    sessionManager.saveSession(updatedUser)
                    _state.value = ProfileUiState.AvatarUpdated(newUrl)
                }
                .onFailure {
                    _state.value = ProfileUiState.Error(it.message ?: "Error al cambiar avatar")
                }
        }
    }

    fun updatePhoto(userId: String, imageFile: File) {
        viewModelScope.launch {
            _state.value = ProfileUiState.Loading

            repository.uploadProfilePhoto(userId, imageFile)
                .onSuccess { newUrl ->
                    val updatedUser = UserSession.currentUser?.copy(avatarUrl = newUrl)
                        ?: return@onSuccess

                    UserSession.currentUser = updatedUser
                    sessionManager.saveSession(updatedUser)
                    _state.value = ProfileUiState.PhotoUpdated(newUrl)
                }
                .onFailure {
                    _state.value = ProfileUiState.Error(it.message ?: "Error subiendo foto")
                }

            if (imageFile.exists()) {
                imageFile.delete()
            }
        }
    }

    class Factory(private val sessionManager: SessionManager) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            ProfileViewModel(sessionManager = sessionManager) as T
    }
}
