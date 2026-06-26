package com.univalle.pedrochacolla.data.remote.error

import com.univalle.pedrochacolla.data.model.ApiResponse
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Response
import timber.log.Timber

private data class ParsedApiError(
    val message: String?,
    val code: String?,
    val fieldErrors: Map<String, String>?,
)

/**
 * Convert Retrofit Response to ApiError using shared API error codes.
 */
fun <T> Response<T>.toApiError(): ApiError {
    val httpCode = this.code()
    val errorBody = this.errorBody()?.string()

    Timber.w("toApiError: HTTP $httpCode - ${errorBody?.take(200)}")

    val parsed = parseErrorBody(errorBody)
    val code = parsed.code ?: ApiErrorCodes.codeFromHttpStatus(httpCode)
    val message = ApiErrorCodes.messageFor(code, parsed.message)
    val firstFieldMessage = parsed.fieldErrors?.values?.firstOrNull { it.isNotBlank() }
    val userMessage = firstFieldMessage ?: message

    return when (httpCode) {
        400 -> ApiError.BadRequest(
            message = userMessage,
            apiCode = code,
            fieldErrors = parsed.fieldErrors,
            cause = Exception("HTTP 400")
        )

        401 -> ApiError.Unauthorized(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 401")
        )

        403 -> ApiError.Forbidden(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 403")
        )

        404 -> ApiError.NotFound(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 404")
        )

        408 -> ApiError.Timeout(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 408")
        )

        409 -> ApiError.Conflict(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 409")
        )

        422 -> ApiError.ValidationError(
            message = userMessage,
            apiCode = code,
            fieldErrors = parsed.fieldErrors,
            cause = Exception("HTTP 422")
        )

        429 -> ApiError.RateLimited(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP 429")
        )

        in 500..599 -> {
            if (httpCode == 503 || code == ApiErrorCodes.DATABASE_UNAVAILABLE || code == ApiErrorCodes.SERVICE_UNAVAILABLE) {
                ApiError.ServiceUnavailable(
                    message = userMessage,
                    apiCode = code,
                    cause = Exception("HTTP $httpCode")
                )
            } else {
                ApiError.ServerError(
                    message = userMessage,
                    apiCode = code,
                    cause = Exception("HTTP $httpCode")
                )
            }
        }

        else -> ApiError.Unknown(
            message = userMessage,
            apiCode = code,
            cause = Exception("HTTP $httpCode")
        )
    }
}

private fun parseErrorBody(errorBody: String?): ParsedApiError {
    if (errorBody.isNullOrBlank()) {
        return ParsedApiError(null, null, null)
    }

    return try {
        val json = JSONObject(errorBody)
        ParsedApiError(
            message = json.optString("message", "").takeIf { it.isNotEmpty() },
            code = json.optString("code", "").takeIf { it.isNotEmpty() },
            fieldErrors = parseFieldErrors(json),
        )
    } catch (e: Exception) {
        ParsedApiError(null, null, null)
    }
}

private fun parseFieldErrors(json: JSONObject): Map<String, String>? {
    if (!json.has("errors")) return null

    return try {
        when (val errors = json.get("errors")) {
            is JSONArray -> {
                val map = linkedMapOf<String, String>()
                for (i in 0 until errors.length()) {
                    val item = errors.optJSONObject(i) ?: continue
                    val field = item.optString("field", "").ifBlank { "field_$i" }
                    val message = item.optString("message", "")
                    if (message.isNotBlank()) {
                        map[field] = message
                    }
                }
                map.takeIf { it.isNotEmpty() }
            }

            is JSONObject -> {
                val map = linkedMapOf<String, String>()
                errors.keys().forEach { key ->
                    val message = errors.optString(key, "")
                    if (message.isNotBlank()) {
                        map[key] = message
                    }
                }
                map.takeIf { it.isNotEmpty() }
            }

            else -> null
        }
    } catch (e: Exception) {
        null
    }
}

fun <T> ApiResponse<T>.toBusinessError(): ApiError {
    Timber.w("toBusinessError: API returned success=false - ${this.message}")
    return ApiError.BusinessError(
        message = this.message ?: "Error en la operación",
        apiCode = this.code,
        cause = Exception("Business Error")
    )
}

fun ApiError.getUserMessage(): String = this.message

fun ApiError.shouldShowRetry(): Boolean = this.isRetryable()

fun ApiError.shouldLogout(): Boolean = this.requiresLogout()
