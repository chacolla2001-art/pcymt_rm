package com.univalle.pedrochacolla.data.remote.error

import kotlinx.coroutines.delay
import timber.log.Timber
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * RetryPolicy - Retry logic for network operations
 *
 * Automatically retries failed operations with exponential backoff
 * for transient errors (network issues, timeouts)
 *
 * Usage in Repository:
 * ```
 * suspend fun getData(): Result<Data> = retryWithPolicy {
 *     val response = api.getData()
 *     if (response.isSuccessful) {
 *         Result.success(response.body()!!)
 *     } else {
 *         Result.failure(response.toApiError())
 *     }
 * }
 * ```
 */

/**
 * Configuration for retry policy
 */
data class RetryConfig(
    val maxAttempts: Int = 3,
    val initialDelayMs: Long = 1000, // 1 second
    val maxDelayMs: Long = 10000, // 10 seconds
    val factor: Double = 2.0 // Exponential backoff factor
) {
    companion object {
        val DEFAULT = RetryConfig()
        val AGGRESSIVE = RetryConfig(maxAttempts = 5, initialDelayMs = 500)
        val CONSERVATIVE = RetryConfig(maxAttempts = 2, initialDelayMs = 2000)
    }
}

/**
 * Execute operation with retry policy
 *
 * @param config Retry configuration (default: 3 attempts with exponential backoff)
 * @param operation Suspending operation to retry
 * @return Result<T> from operation (or final failure)
 */
suspend fun <T> retryWithPolicy(
    config: RetryConfig = RetryConfig.DEFAULT,
    operation: suspend () -> Result<T>
): Result<T> {
    var currentDelay = config.initialDelayMs
    var lastException: Throwable? = null

    repeat(config.maxAttempts) { attempt ->
        try {
            Timber.d("retryWithPolicy: Attempt ${attempt + 1}/${config.maxAttempts}")

            val result = operation()

            // Check if result failed with retryable error
            result.onFailure { error ->
                if (error is ApiError && error.isRetryable()) {
                    Timber.w("retryWithPolicy: Retryable error - ${error.message}")
                    lastException = error

                    if (attempt < config.maxAttempts - 1) {
                        Timber.d("retryWithPolicy: Waiting ${currentDelay}ms before retry")
                        delay(currentDelay)
                        currentDelay = (currentDelay * config.factor).toLong().coerceAtMost(config.maxDelayMs)
                        return@repeat // Continue to next retry
                    }
                } else {
                    // Non-retryable error - fail immediately
                    Timber.w("retryWithPolicy: Non-retryable error, failing immediately")
                    return result
                }
            }

            // Success or non-retryable error
            result.onSuccess {
                if (attempt > 0) {
                    Timber.i("retryWithPolicy: Success after ${attempt + 1} attempts")
                }
            }

            return result

        } catch (e: Exception) {
            lastException = e

            // Check if exception is retryable
            val isRetryable = when (e) {
                is SocketTimeoutException,
                is UnknownHostException,
                is IOException -> true
                else -> false
            }

            if (!isRetryable) {
                Timber.e(e, "retryWithPolicy: Non-retryable exception")
                return Result.failure(ApiError.fromThrowable(e))
            }

            Timber.w(e, "retryWithPolicy: Retryable exception on attempt ${attempt + 1}")

            if (attempt < config.maxAttempts - 1) {
                Timber.d("retryWithPolicy: Waiting ${currentDelay}ms before retry")
                delay(currentDelay)
                currentDelay = (currentDelay * config.factor).toLong().coerceAtMost(config.maxDelayMs)
            }
        }
    }

    // All retries exhausted
    Timber.e("retryWithPolicy: All ${config.maxAttempts} attempts failed")
    return Result.failure(
        lastException?.let { ApiError.fromThrowable(it) }
            ?: ApiError.Unknown("All retry attempts failed")
    )
}

/**
 * Check if exception should be retried
 */
fun Throwable.isRetryable(): Boolean {
    return when (this) {
        is SocketTimeoutException,
        is UnknownHostException,
        is IOException -> true
        is ApiError -> this.isRetryable()
        else -> false
    }
}
