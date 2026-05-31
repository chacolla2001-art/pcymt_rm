package com.univalle.pedrochacolla.data.remote.error

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * ApiError - Sealed class for error classification
 *
 * Provides type-safe error handling with specific error types:
 * - Network errors (timeout, no connection)
 * - HTTP errors (401, 403, 404, 500, etc.)
 * - Business logic errors (from API)
 * - Unexpected errors
 *
 * Usage in UI:
 * ```
 * when (error) {
 *     is ApiError.Unauthorized -> logout()
 *     is ApiError.Timeout -> showRetryButton()
 *     is ApiError.NetworkError -> showOfflineMessage()
 *     is ApiError.ServerError -> showGenericError()
 * }
 * ```
 */
sealed class ApiError(
    override val message: String,
    override val cause: Throwable? = null
) : Exception(message, cause) {

    // ═══════════════════════════════════════════════════════════════
    // NETWORK ERRORS (No Internet, Timeout, etc.)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Network unavailable or unreachable
     * UI Action: Show offline message + retry button
     */
    data class NetworkError(
        override val message: String = "No hay conexión a internet",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * Request timeout (SocketTimeoutException)
     * UI Action: Show timeout message + retry button
     */
    data class Timeout(
        override val message: String = "La solicitud tardó demasiado. Intenta de nuevo",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    // ═══════════════════════════════════════════════════════════════
    // HTTP CLIENT ERRORS (4xx)
    // ═══════════════════════════════════════════════════════════════

    /**
     * HTTP 400 Bad Request
     * UI Action: Show validation errors to user
     */
    data class BadRequest(
        override val message: String = "Solicitud inválida",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 401 Unauthorized (Token expired, invalid, or missing)
     * UI Action: Force logout + navigate to login screen
     */
    data class Unauthorized(
        override val message: String = "Sesión expirada. Inicia sesión nuevamente",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 403 Forbidden (User doesn't have permission)
     * UI Action: Show "No tienes permiso" message, disable action
     */
    data class Forbidden(
        override val message: String = "No tienes permiso para realizar esta acción",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 404 Not Found
     * UI Action: Show "Recurso no encontrado" message
     */
    data class NotFound(
        override val message: String = "Recurso no encontrado",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 409 Conflict (e.g., email already exists, duplicate data)
     * UI Action: Show specific conflict message
     */
    data class Conflict(
        override val message: String = "El recurso ya existe",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 422 Unprocessable Entity (Validation errors)
     * UI Action: Show field-specific validation errors
     */
    data class ValidationError(
        override val message: String = "Datos de entrada inválidos",
        val fieldErrors: Map<String, String>? = null,
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    // ═══════════════════════════════════════════════════════════════
    // HTTP SERVER ERRORS (5xx)
    // ═══════════════════════════════════════════════════════════════

    /**
     * HTTP 500 Internal Server Error
     * UI Action: Show generic error + retry button
     */
    data class ServerError(
        override val message: String = "Error del servidor. Intenta de nuevo más tarde",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    /**
     * HTTP 503 Service Unavailable
     * UI Action: Show maintenance message
     */
    data class ServiceUnavailable(
        override val message: String = "Servicio temporalmente no disponible",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    // ═══════════════════════════════════════════════════════════════
    // BUSINESS LOGIC ERRORS (Custom API errors)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Custom business logic error from API (success=false)
     * UI Action: Display API message to user
     */
    data class BusinessError(
        override val message: String,
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    // ═══════════════════════════════════════════════════════════════
    // UNEXPECTED ERRORS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Unknown/unexpected error (catch-all)
     * UI Action: Show generic error message
     */
    data class Unknown(
        override val message: String = "Error desconocido. Intenta de nuevo",
        override val cause: Throwable? = null
    ) : ApiError(message, cause)

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Check if error is retryable (network issues, timeouts, server errors)
     */
    fun isRetryable(): Boolean {
        return when (this) {
            is NetworkError,
            is Timeout,
            is ServerError,
            is ServiceUnavailable -> true
            else -> false
        }
    }

    /**
     * Check if error requires logout (unauthorized)
     */
    fun requiresLogout(): Boolean {
        return this is Unauthorized
    }

    companion object {
        /**
         * Create ApiError from Throwable
         */
        fun fromThrowable(throwable: Throwable): ApiError {
            return when (throwable) {
                is SocketTimeoutException -> Timeout(cause = throwable)
                is UnknownHostException,
                is IOException -> NetworkError(cause = throwable)
                else -> Unknown(
                    message = throwable.message ?: "Error desconocido",
                    cause = throwable
                )
            }
        }
    }
}
