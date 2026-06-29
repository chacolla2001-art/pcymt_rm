package com.univalle.pedrochacolla.ui.auth

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object LoginSuccess : AuthUiState()
    object MustChangePassword : AuthUiState()
    object RegisterSuccess : AuthUiState()
    data class EmailVerificationRequired(val email: String) : AuthUiState()
    object UpdateSuccess : AuthUiState()
    object ForgotPasswordSuccess : AuthUiState()
    data class Error(val message: String) : AuthUiState()
    data class PhotoUpdated(val newUrl: String) : AuthUiState()
}
