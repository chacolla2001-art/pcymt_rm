package com.univalle.pedrochacolla.utils.validation

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Unit tests for ValidationHelper
 *
 * Tests all validation methods with edge cases:
 * - Required fields validation
 * - Email validation
 * - Password strength validation
 * - Password match validation
 * - File size validation
 */
class ValidationHelperTest {

    // ═══════════════════════════════════════════════════════════════
    // REQUIRED FIELDS VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validateRequired with all non-empty fields should return success`() {
        // Given
        val field1 = "Name" to "John Doe"
        val field2 = "Email" to "john@example.com"
        val field3 = "Password" to "password123"

        // When
        val result = ValidationHelper.validateRequired(field1, field2, field3)

        // Then
        assertTrue(result.isValid)
        assertEquals(null, result.errorMessage)
    }

    @Test
    fun `validateRequired with empty field should return error`() {
        // Given
        val field1 = "Name" to "John Doe"
        val field2 = "Email" to ""
        val field3 = "Password" to "password123"

        // When
        val result = ValidationHelper.validateRequired(field1, field2, field3)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("Email") == true)
    }

    @Test
    fun `validateRequired with blank field (spaces only) should return error`() {
        // Given
        val field = "Name" to "   "

        // When
        val result = ValidationHelper.validateRequired(field)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("Name") == true)
    }

    @Test
    fun `validateRequired with multiple empty fields should list all in error`() {
        // Given
        val field1 = "Name" to ""
        val field2 = "Email" to ""
        val field3 = "Password" to "test"

        // When
        val result = ValidationHelper.validateRequired(field1, field2, field3)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("Name") == true)
        assertTrue(result.errorMessage?.contains("Email") == true)
    }

    @Test
    fun `validateRequired with no fields should return success`() {
        // When
        val result = ValidationHelper.validateRequired()

        // Then
        assertTrue(result.isValid)
    }

    // ═══════════════════════════════════════════════════════════════
    // EMAIL VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validateEmail with valid email should return success`() {
        // Given
        val validEmails = listOf(
            "test@example.com",
            "user.name@domain.com",
            "user_123@test.co.uk",
            "test-email@sub.domain.com"
        )

        // When/Then
        validEmails.forEach { email ->
            val result = ValidationHelper.validateEmail(email)
            assertTrue(result.isValid, "Failed for: $email")
        }
    }

    @Test
    fun `validateEmail with invalid email should return error`() {
        // Given
        val invalidEmails = listOf(
            "notanemail",
            "@example.com",
            "user@",
            "user name@example.com",
            "user@example",
            "user@@example.com",
            ""
        )

        // When/Then
        invalidEmails.forEach { email ->
            val result = ValidationHelper.validateEmail(email)
            assertFalse(result.isValid, "Should fail for: $email")
            assertEquals("Email inválido", result.errorMessage)
        }
    }

    @Test
    fun `validateEmail with email containing special characters should return error`() {
        // Given
        val email = "user!#\$%@example.com"

        // When
        val result = ValidationHelper.validateEmail(email)

        // Then
        assertFalse(result.isValid)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSWORD STRENGTH VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validatePasswordStrength with strong password should return success`() {
        // Given - min 12 chars, has uppercase, lowercase, digit, symbol
        val strongPasswords = listOf(
            "StrongPass123!",
            "MyP@ssw0rd2024",
            "Secure#Pass123",
            "Compl3x!P@ssword"
        )

        // When/Then
        strongPasswords.forEach { password ->
            val result = ValidationHelper.validatePasswordStrength(password)
            assertTrue(result.isValid, "Failed for: $password")
        }
    }

    @Test
    fun `validatePasswordStrength with weak password missing uppercase should return error`() {
        // Given - no uppercase
        val password = "weakpass123!"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("mayúsculas") == true)
    }

    @Test
    fun `validatePasswordStrength with weak password missing lowercase should return error`() {
        // Given - no lowercase
        val password = "WEAKPASS123!"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validatePasswordStrength with weak password missing digit should return error`() {
        // Given - no digit
        val password = "WeakPassword!"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validatePasswordStrength with weak password missing symbol should return error`() {
        // Given - no symbol
        val password = "WeakPassword123"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validatePasswordStrength with password shorter than 12 chars should return error`() {
        // Given - only 11 chars
        val password = "Short123!Ab"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("12 caracteres") == true)
    }

    @Test
    fun `validatePasswordStrength with empty password should return success (allow empty for optional)`() {
        // Given
        val password = ""

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        // Empty is allowed (for cases where password might be optional in update forms)
        assertTrue(result.isValid)
    }

    @Test
    fun `validatePasswordStrength with exactly 12 chars and all requirements should succeed`() {
        // Given - exactly 12 chars
        val password = "Pass123!word"

        // When
        val result = ValidationHelper.validatePasswordStrength(password)

        // Then
        assertTrue(result.isValid)
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSWORD MATCH VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validatePasswordMatch with matching passwords should return success`() {
        // Given
        val password = "MyPassword123!"
        val confirmPassword = "MyPassword123!"

        // When
        val result = ValidationHelper.validatePasswordMatch(password, confirmPassword)

        // Then
        assertTrue(result.isValid)
    }

    @Test
    fun `validatePasswordMatch with non-matching passwords should return error`() {
        // Given
        val password = "MyPassword123!"
        val confirmPassword = "DifferentPassword123!"

        // When
        val result = ValidationHelper.validatePasswordMatch(password, confirmPassword)

        // Then
        assertFalse(result.isValid)
        assertEquals("Las contraseñas no coinciden", result.errorMessage)
    }

    @Test
    fun `validatePasswordMatch with case difference should return error`() {
        // Given
        val password = "MyPassword"
        val confirmPassword = "mypassword"

        // When
        val result = ValidationHelper.validatePasswordMatch(password, confirmPassword)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validatePasswordMatch with whitespace difference should return error`() {
        // Given
        val password = "MyPassword"
        val confirmPassword = "MyPassword "

        // When
        val result = ValidationHelper.validatePasswordMatch(password, confirmPassword)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validatePasswordMatch with both empty should return success`() {
        // Given
        val password = ""
        val confirmPassword = ""

        // When
        val result = ValidationHelper.validatePasswordMatch(password, confirmPassword)

        // Then
        assertTrue(result.isValid)
    }

    // ═══════════════════════════════════════════════════════════════
    // FILE SIZE VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validateFileSize with file under limit should return success`() {
        // Given - 5MB file, 10MB limit
        val fileSizeBytes = 5L * 1024 * 1024
        val maxSizeMB = 10

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertTrue(result.isValid)
    }

    @Test
    fun `validateFileSize with file exactly at limit should return success`() {
        // Given - exactly 10MB
        val fileSizeBytes = 10L * 1024 * 1024
        val maxSizeMB = 10

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertTrue(result.isValid)
    }

    @Test
    fun `validateFileSize with file over limit should return error`() {
        // Given - 15MB file, 10MB limit
        val fileSizeBytes = 15L * 1024 * 1024
        val maxSizeMB = 10

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertFalse(result.isValid)
        assertTrue(result.errorMessage?.contains("demasiado grande") == true)
        assertTrue(result.errorMessage?.contains("10 MB") == true)
    }

    @Test
    fun `validateFileSize with zero byte file should return success`() {
        // Given
        val fileSizeBytes = 0L
        val maxSizeMB = 10

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertTrue(result.isValid)
    }

    @Test
    fun `validateFileSize with 1 byte over limit should return error`() {
        // Given - just 1 byte over
        val maxSizeMB = 1
        val fileSizeBytes = (1L * 1024 * 1024) + 1

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertFalse(result.isValid)
    }

    @Test
    fun `validateFileSize with very large limit should work correctly`() {
        // Given - 500MB file, 1000MB limit
        val fileSizeBytes = 500L * 1024 * 1024
        val maxSizeMB = 1000

        // When
        val result = ValidationHelper.validateFileSize(fileSizeBytes, maxSizeMB)

        // Then
        assertTrue(result.isValid)
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION RESULT TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `ValidationResult success factory should create valid result`() {
        // When
        val result = ValidationHelper.ValidationResult.success()

        // Then
        assertTrue(result.isValid)
        assertEquals(null, result.errorMessage)
    }

    @Test
    fun `ValidationResult error factory should create invalid result with message`() {
        // When
        val result = ValidationHelper.ValidationResult.error("Test error")

        // Then
        assertFalse(result.isValid)
        assertEquals("Test error", result.errorMessage)
    }
}
