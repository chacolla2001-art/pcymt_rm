package com.univalle.pedrochacolla.utils.validation

/**
 * Validation Helper - DRY implementation
 * Centralized validation logic
 */
object ValidationHelper {

    data class ValidationResult(
        val isValid: Boolean,
        val errorMessage: String? = null
    ) {
        companion object {
            fun success() = ValidationResult(true)
            fun error(message: String) = ValidationResult(false, message)
        }
    }

    fun validateRequired(vararg fields: Pair<String, String>): ValidationResult {
        val emptyFields = fields.filter { it.second.isBlank() }
        return if (emptyFields.isEmpty()) {
            ValidationResult.success()
        } else {
            ValidationResult.error("${emptyFields.joinToString { it.first }} no pueden estar vacíos")
        }
    }

    fun validatePasswordMatch(password: String, confirmPassword: String): ValidationResult {
        return if (password == confirmPassword) {
            ValidationResult.success()
        } else {
            ValidationResult.error("Las contraseñas no coinciden")
        }
    }

    fun validatePasswordStrength(password: String): ValidationResult {
        if (password.isEmpty()) return ValidationResult.success()

        val hasMinLength = password.length >= 12
        val hasUppercase = password.any { it.isUpperCase() }
        val hasLowercase = password.any { it.isLowerCase() }
        val hasDigit = password.any { it.isDigit() }
        val hasSymbol = password.any { !it.isLetterOrDigit() }

        val isStrong = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSymbol

        return if (isStrong) {
            ValidationResult.success()
        } else {
            ValidationResult.error("Contraseña insegura: mínimo 12 caracteres, mayúsculas, minúsculas, números y símbolos")
        }
    }

    fun validateEmail(email: String): ValidationResult {
        val emailRegex = "[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}".toRegex()
        return if (email.matches(emailRegex)) {
            ValidationResult.success()
        } else {
            ValidationResult.error("Email inválido")
        }
    }

    fun validateFileSize(fileSizeBytes: Long, maxSizeMB: Int): ValidationResult {
        val maxSizeBytes = maxSizeMB * 1024 * 1024
        return if (fileSizeBytes <= maxSizeBytes) {
            ValidationResult.success()
        } else {
            ValidationResult.error("El archivo es demasiado grande. Máximo $maxSizeMB MB")
        }
    }
}
