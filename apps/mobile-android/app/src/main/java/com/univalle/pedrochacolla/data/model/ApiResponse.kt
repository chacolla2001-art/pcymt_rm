package com.univalle.pedrochacolla.data.model

/**
 * Generic API response wrapper
 * Matches backend format: { success: boolean, data: T, message?: string }
 */
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val message: String? = null
)
