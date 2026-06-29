package com.univalle.pedrochacolla.data.remote.error

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * ApiError - Sealed class for error classification (sync: shared/constants/api-error-codes.json)
 */
sealed class ApiError(
    override val message: String,
    open val apiCode: String? = null,
    override val cause: Throwable? = null,
) : Exception(message, cause) {

    data class NetworkError(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.NETWORK_ERROR),
        override val apiCode: String? = ApiErrorCodes.NETWORK_ERROR,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class Timeout(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.TIMEOUT_ERROR),
        override val apiCode: String? = ApiErrorCodes.TIMEOUT_ERROR,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class BadRequest(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.VALIDATION_ERROR),
        override val apiCode: String? = ApiErrorCodes.VALIDATION_ERROR,
        val fieldErrors: Map<String, String>? = null,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class Unauthorized(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.UNAUTHORIZED),
        override val apiCode: String? = ApiErrorCodes.UNAUTHORIZED,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class Forbidden(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.FORBIDDEN),
        override val apiCode: String? = ApiErrorCodes.FORBIDDEN,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class NotFound(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.NOT_FOUND),
        override val apiCode: String? = ApiErrorCodes.NOT_FOUND,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class Conflict(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.CONFLICT),
        override val apiCode: String? = ApiErrorCodes.CONFLICT,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class ValidationError(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.VALIDATION_ERROR),
        override val apiCode: String? = ApiErrorCodes.VALIDATION_ERROR,
        val fieldErrors: Map<String, String>? = null,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class RateLimited(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.RATE_LIMITED),
        override val apiCode: String? = ApiErrorCodes.RATE_LIMITED,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class ServerError(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.INTERNAL_ERROR),
        override val apiCode: String? = ApiErrorCodes.INTERNAL_ERROR,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class ServiceUnavailable(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.SERVICE_UNAVAILABLE),
        override val apiCode: String? = ApiErrorCodes.SERVICE_UNAVAILABLE,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class BusinessError(
        override val message: String,
        override val apiCode: String? = null,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    data class Unknown(
        override val message: String = ApiErrorCodes.messageFor(ApiErrorCodes.INTERNAL_ERROR),
        override val apiCode: String? = null,
        override val cause: Throwable? = null,
    ) : ApiError(message, apiCode, cause)

    fun isRetryable(): Boolean {
        return when (this) {
            is NetworkError,
            is Timeout,
            is ServerError,
            is ServiceUnavailable,
            is RateLimited -> true
            else -> false
        }
    }

    fun requiresLogout(): Boolean {
        if (this !is Unauthorized) return false
        return apiCode == null ||
            apiCode == ApiErrorCodes.UNAUTHORIZED ||
            apiCode == ApiErrorCodes.TOKEN_EXPIRED ||
            apiCode == ApiErrorCodes.TOKEN_INVALID ||
            apiCode == ApiErrorCodes.SESSION_EXPIRED
    }

    companion object {
        fun fromThrowable(throwable: Throwable): ApiError {
            return when (throwable) {
                is SocketTimeoutException -> Timeout(cause = throwable)
                is UnknownHostException,
                is IOException -> NetworkError(cause = throwable)
                else -> Unknown(
                    message = throwable.message ?: ApiErrorCodes.messageFor(ApiErrorCodes.INTERNAL_ERROR),
                    cause = throwable,
                )
            }
        }
    }
}
