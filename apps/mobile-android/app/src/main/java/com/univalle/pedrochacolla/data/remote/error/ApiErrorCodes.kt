package com.univalle.pedrochacolla.data.remote.error

/**
 * API error codes — keep in sync with shared/constants/api-error-codes.json
 */
object ApiErrorCodes {
    const val VALIDATION_ERROR = "VALIDATION_ERROR"
    const val NOT_FOUND = "NOT_FOUND"
    const val UNAUTHORIZED = "UNAUTHORIZED"
    const val FORBIDDEN = "FORBIDDEN"
    const val CONFLICT = "CONFLICT"
    const val RATE_LIMITED = "RATE_LIMITED"
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
    const val TOKEN_EXPIRED = "TOKEN_EXPIRED"
    const val TOKEN_INVALID = "TOKEN_INVALID"
    const val SESSION_EXPIRED = "SESSION_EXPIRED"
    const val DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    const val SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    const val TIMEOUT_ERROR = "TIMEOUT_ERROR"
    const val NETWORK_ERROR = "NETWORK_ERROR"

    private val messagesEs = mapOf(
        VALIDATION_ERROR to "Los datos proporcionados no son válidos",
        NOT_FOUND to "El recurso solicitado no fue encontrado",
        UNAUTHORIZED to "Credenciales inválidas o sesión expirada",
        FORBIDDEN to "No tienes permisos para realizar esta acción",
        CONFLICT to "El recurso ya existe o hay un conflicto",
        RATE_LIMITED to "Has excedido el límite de solicitudes. Intenta más tarde",
        INTERNAL_ERROR to "Error interno del servidor. Intenta más tarde",
        TOKEN_EXPIRED to "Tu sesión ha expirado. Inicia sesión nuevamente",
        TOKEN_INVALID to "Token de autenticación inválido",
        SESSION_EXPIRED to "Tu sesión ha expirado. Inicia sesión nuevamente",
        DATABASE_UNAVAILABLE to "El servicio de base de datos no está disponible temporalmente",
        SERVICE_UNAVAILABLE to "El servicio no está disponible temporalmente",
        TIMEOUT_ERROR to "La solicitud tardó demasiado. Intenta nuevamente",
        NETWORK_ERROR to "Error de conexión. Verifica tu conexión a internet",
    )

    private val httpStatusToCode = mapOf(
        400 to VALIDATION_ERROR,
        401 to UNAUTHORIZED,
        403 to FORBIDDEN,
        404 to NOT_FOUND,
        408 to TIMEOUT_ERROR,
        409 to CONFLICT,
        422 to VALIDATION_ERROR,
        429 to RATE_LIMITED,
        500 to INTERNAL_ERROR,
        502 to SERVICE_UNAVAILABLE,
        503 to SERVICE_UNAVAILABLE,
        504 to TIMEOUT_ERROR,
    )

    fun codeFromHttpStatus(status: Int): String =
        httpStatusToCode[status] ?: INTERNAL_ERROR

    fun messageFor(code: String?, apiMessage: String? = null): String {
        if (!apiMessage.isNullOrBlank()) return apiMessage
        if (!code.isNullOrBlank()) {
            messagesEs[code]?.let { return it }
        }
        return messagesEs[INTERNAL_ERROR]!!
    }
}
