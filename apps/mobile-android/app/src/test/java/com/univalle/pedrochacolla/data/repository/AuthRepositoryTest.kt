package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.User
import com.univalle.pedrochacolla.data.remote.api.AuthApiService
import com.univalle.pedrochacolla.data.remote.dto.ApiResponse
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Before
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import retrofit2.Response
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit tests for AuthRepository
 *
 * Tests:
 * - Email/password login (success/failure)
 * - Google login (success/failure)
 * - User registration (success/failure)
 * - Token validation
 * - Error handling for auth-specific errors (invalid credentials, existing email, etc.)
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositoryTest {

    private lateinit var repository: AuthRepository
    private lateinit var api: AuthApiService

    private val testUser = User(
        id = "user-123",
        name = "Test User",
        email = "test@example.com",
        photo = null,
        role = "user",
        idToken = "jwt-token-abc123",
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    @Before
    fun setup() {
        api = mock()
        repository = AuthRepository(api)
    }

    // ═══════════════════════════════════════════════════════════════
    // EMAIL/PASSWORD LOGIN TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loginWithEmail success should return user with token`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val loginRequest = mapOf("email" to email, "password" to password)
        val apiResponse = ApiResponse(
            success = true,
            message = "Login successful",
            data = testUser
        )
        whenever(api.login(loginRequest))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.loginWithEmail(email, password)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("user-123", result.getOrNull()?.id)
        assertEquals("jwt-token-abc123", result.getOrNull()?.idToken)
        assertEquals(email, result.getOrNull()?.email)
    }

    @Test
    fun `loginWithEmail with invalid credentials should return failure`() = runTest {
        // Given
        val email = "wrong@example.com"
        val password = "wrongpassword"
        val loginRequest = mapOf("email" to email, "password" to password)
        val errorResponse = ApiResponse<User>(
            success = false,
            message = "Invalid credentials",
            data = null
        )
        whenever(api.login(loginRequest))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.loginWithEmail(email, password)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Invalid credentials") == true)
    }

    @Test
    fun `loginWithEmail with HTTP 401 should return failure`() = runTest {
        // Given
        val loginRequest = mapOf("email" to "test@test.com", "password" to "test")
        whenever(api.login(loginRequest))
            .thenReturn(Response.error(401, "Unauthorized".toResponseBody()))

        // When
        val result = repository.loginWithEmail("test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 401") == true)
    }

    @Test
    fun `loginWithEmail with network error should return failure`() = runTest {
        // Given
        whenever(api.login(any()))
            .thenThrow(java.net.SocketTimeoutException("Connection timeout"))

        // When
        val result = repository.loginWithEmail("test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is java.net.SocketTimeoutException)
    }

    @Test
    fun `loginWithEmail with empty response data should return failure`() = runTest {
        // Given
        val apiResponse = ApiResponse<User>(
            success = true,
            message = "Success",
            data = null
        )
        whenever(api.login(any()))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.loginWithEmail("test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("No user data") == true)
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE LOGIN TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loginWithGoogle success should return user with token`() = runTest {
        // Given
        val idToken = "google-id-token-123"
        val loginRequest = mapOf("idToken" to idToken)
        val apiResponse = ApiResponse(
            success = true,
            message = "Google login successful",
            data = testUser.copy(email = "google@example.com")
        )
        whenever(api.googleLogin(loginRequest))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.loginWithGoogle(idToken)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("user-123", result.getOrNull()?.id)
        assertTrue(result.getOrNull()?.idToken?.isNotEmpty() == true)
    }

    @Test
    fun `loginWithGoogle with invalid token should return failure`() = runTest {
        // Given
        val idToken = "invalid-google-token"
        val errorResponse = ApiResponse<User>(
            success = false,
            message = "Invalid Google token",
            data = null
        )
        whenever(api.googleLogin(any()))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.loginWithGoogle(idToken)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Invalid Google token") == true)
    }

    @Test
    fun `loginWithGoogle with HTTP 403 should return failure`() = runTest {
        // Given
        whenever(api.googleLogin(any()))
            .thenReturn(Response.error(403, "Forbidden".toResponseBody()))

        // When
        val result = repository.loginWithGoogle("token")

        // Then
        assertTrue(result.isFailure)
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `registerWithEmail success should return new user`() = runTest {
        // Given
        val name = "New User"
        val email = "newuser@example.com"
        val password = "password123"
        val registerRequest = mapOf(
            "name" to name,
            "email" to email,
            "password" to password
        )
        val newUser = testUser.copy(name = name, email = email)
        val apiResponse = ApiResponse(
            success = true,
            message = "User registered",
            data = newUser
        )
        whenever(api.register(registerRequest))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.registerWithEmail(name, email, password)

        // Then
        assertTrue(result.isSuccess)
        assertEquals(name, result.getOrNull()?.name)
        assertEquals(email, result.getOrNull()?.email)
    }

    @Test
    fun `registerWithEmail with existing email should return failure`() = runTest {
        // Given
        val registerRequest = mapOf(
            "name" to "Existing",
            "email" to "existing@example.com",
            "password" to "test"
        )
        val errorResponse = ApiResponse<User>(
            success = false,
            message = "Email already exists",
            data = null
        )
        whenever(api.register(registerRequest))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.registerWithEmail("Existing", "existing@example.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("already exists") == true)
    }

    @Test
    fun `registerWithEmail with HTTP 400 bad request should return failure`() = runTest {
        // Given
        whenever(api.register(any()))
            .thenReturn(Response.error(400, "Bad Request".toResponseBody()))

        // When
        val result = repository.registerWithEmail("Test", "test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 400") == true)
    }

    @Test
    fun `registerWithEmail with weak password should return failure`() = runTest {
        // Given
        val errorResponse = ApiResponse<User>(
            success = false,
            message = "Password must be at least 8 characters",
            data = null
        )
        whenever(api.register(any()))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.registerWithEmail("Test", "test@test.com", "123")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Password") == true)
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDATE TOKEN TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `validateToken with valid token should return true`() = runTest {
        // Given
        val token = "valid-jwt-token"
        val apiResponse = ApiResponse(
            success = true,
            message = "Token valid",
            data = mapOf("valid" to true)
        )
        whenever(api.validateToken(mapOf("token" to token)))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.validateToken(token)

        // Then
        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull())
    }

    @Test
    fun `validateToken with expired token should return false`() = runTest {
        // Given
        val token = "expired-token"
        val errorResponse = ApiResponse<Map<String, Boolean>>(
            success = false,
            message = "Token expired",
            data = null
        )
        whenever(api.validateToken(mapOf("token" to token)))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.validateToken(token)

        // Then
        assertTrue(result.isSuccess)
        assertEquals(false, result.getOrNull())
    }

    @Test
    fun `validateToken with HTTP 401 should return false`() = runTest {
        // Given
        whenever(api.validateToken(any()))
            .thenReturn(Response.error(401, "Unauthorized".toResponseBody()))

        // When
        val result = repository.validateToken("token")

        // Then
        assertTrue(result.isSuccess)
        assertEquals(false, result.getOrNull())
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING EDGE CASES
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `network timeout should return failure with timeout exception`() = runTest {
        // Given
        whenever(api.login(any()))
            .thenThrow(java.net.SocketTimeoutException("Timeout"))

        // When
        val result = repository.loginWithEmail("test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is java.net.SocketTimeoutException)
    }

    @Test
    fun `server error HTTP 500 should return failure`() = runTest {
        // Given
        whenever(api.login(any()))
            .thenReturn(Response.error(500, "Internal Server Error".toResponseBody()))

        // When
        val result = repository.loginWithEmail("test@test.com", "test")

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 500") == true)
    }
}
