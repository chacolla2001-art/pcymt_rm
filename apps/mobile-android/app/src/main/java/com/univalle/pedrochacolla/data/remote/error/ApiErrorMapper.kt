package com.univalle.pedrochacolla.data.remote.error

import com.univalle.pedrochacolla.data.model.ApiResponse
import org.json.JSONObject
import retrofit2.Response
import timber.log.Timber

/**
 * ApiErrorMapper - Extension functions to convert Retrofit responses to ApiError
 *
 * Usage in Repository:
 * ```
 * val response = api.getData()
 * if (!response.isSuccessful) {
 *     return Result.failure(response.toApiError())
 * }
 * ```
 */

/**
 * Convert Retrofit Response to ApiError
 *
 * Classifies errors into specific types based on:
 * - HTTP status code (401, 403, 404, 500, etc.)
 * - Response body (API message if available)
 * - Network errors (timeout, no connection)
 *
 * @return ApiError with appropriate subtype
 */
fun <T> Response<T>.toApiError(): ApiError {
    val code = this.code()
    val errorBody = this.errorBody()?.string()

    Timber.w("toApiError: HTTP $code - ${errorBody?.take(200)}")

    // Try to extract message from API response
    val apiMessage = try {
        errorBody?.let {
            val json = JSONObject(it)
            json.optString("message", "").takeIf { msg -> msg.isNotEmpty() }
        }
    } catch (e: Exception) {
        null
    }

    return when (code) {
        400 -> ApiError.BadRequest(
            message = apiMessage ?: "Solicitud inválida",
            cause = Exception("HTTP 400")
        )

        401 -> ApiError.Unauthorized(
            message = apiMessage ?: "Sesión expirada. Inicia sesión nuevamente",
            cause = Exception("HTTP 401")
        )

        403 -> ApiError.Forbidden(
            message = apiMessage ?: "No tienes permiso para realizar esta acción",
            cause = Exception("HTTP 403")
        )

        404 -> ApiError.NotFound(
            message = apiMessage ?: "Recurso no encontrado",
            cause = Exception("HTTP 404")
        )

        409 -> ApiError.Conflict(
            message = apiMessage ?: "El recurso ya existe",
            cause = Exception("HTTP 409")
        )

        422 -> {
            // Try to extract field errors for validation
            val fieldErrors = try {
                errorBody?.let {
                    val json = JSONObject(it)
                    val errorsJson = json.optJSONObject("errors")
                    errorsJson?.let { errors ->
                        val map = mutableMapOf<String, String>()
                        errors.keys().forEach { key ->
                            map[key] = errors.optString(key)
                        }
                        map
                    }
                }
            } catch (e: Exception) {
                null
            }

            ApiError.ValidationError(
                message = apiMessage ?: "Datos de entrada inválidos",
                fieldErrors = fieldErrors,
                cause = Exception("HTTP 422")
            )
        }

        in 500..599 -> {
            if (code == 503) {
                ApiError.ServiceUnavailable(
                    message = apiMessage ?: "Servicio temporalmente no disponible",
                    cause = Exception("HTTP $code")
                )
            } else {
                ApiError.ServerError(
                    message = apiMessage ?: "Error del servidor. Intenta de nuevo más tarde",
                    cause = Exception("HTTP $code")
                )
            }
        }

        else -> ApiError.Unknown(
            message = apiMessage ?: "Error desconocido (HTTP $code)",
            cause = Exception("HTTP $code")
        )
    }
}

/**
 * Convert ApiResponse<T> to ApiError when success=false
 *
 * Use when response.isSuccessful == true but response.body()?.success == false
 *
 * @return ApiError.BusinessError with API message
 */
fun <T> ApiResponse<T>.toBusinessError(): ApiError {
    Timber.w("toBusinessError: API returned success=false - ${this.message}")
    return ApiError.BusinessError(
        message = this.message ?: "Error en la operación",
        cause = Exception("Business Error")
    )
}

/**
 * Handle ApiError in ViewModel and return user-friendly message
 *
 * Usage:
 * ```
 * result.onFailure { error ->
 *     val userMessage = (error as? ApiError)?.getUserMessage() ?: error.message
 *     _state.value = ErrorState(userMessage)
 * }
 * ```
 */
fun ApiError.getUserMessage(): String {
    return this.message
}

/**
 * Determine if error should show retry button
 */
fun ApiError.shouldShowRetry(): Boolean {
    return this.isRetryable()
}

/**
 * Determine if error should trigger logout
 */
fun ApiError.shouldLogout(): Boolean {
    return this.requiresLogout()
}
