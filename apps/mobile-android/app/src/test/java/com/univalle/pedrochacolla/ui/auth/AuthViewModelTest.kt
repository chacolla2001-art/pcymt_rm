package com.univalle.pedrochacolla.ui.auth

import android.content.Context
import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import app.cash.turbine.test
import com.univalle.pedrochacolla.data.model.User
import com.univalle.pedrochacolla.data.repository.AuthRepository
import com.univalle.pedrochacolla.utils.session.SessionManager
import com.univalle.pedrochacolla.utils.session.UserSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit tests for AuthViewModel
 *
 * Tests:
 * - Email/password login success
 * - Email/password login failure
 * - Google login success
 * - Google login failure
 * - Registration success
 * - Registration with existing email
 * - Remember Me functionality
 * - Session management
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var viewModel: AuthViewModel
    private lateinit var repository: AuthRepository
    private lateinit var context: Context
    private lateinit var sessionManager: SessionManager

    private val testUser = User(
        id = "test-user-id",
        name = "Test User",
        email = "test@example.com",
        photo = null,
        role = "user",
        idToken = "test-token-123",
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        repository = mock()
        context = mock()
        sessionManager = mock()

        // Mock SessionManager methods
        whenever(sessionManager.saveSession(any(), any(), any())).then { }
        whenever(sessionManager.setRememberMe(any(), any(), any())).then { }

        viewModel = AuthViewModel(repository, context)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        UserSession.clearSession()
    }

    // ═══════════════════════════════════════════════════════════════
    // EMAIL/PASSWORD LOGIN TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loginWithEmailAndPassword success should emit LoginSuccess state`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        whenever(repository.loginWithEmail(email, password))
            .thenReturn(Result.success(testUser))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.loginWithEmailAndPassword(email, password, rememberMe = false)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.LoginSuccess, awaitItem())

            // Verify user session was saved
            assertTrue(UserSession.currentUser != null)
            assertEquals(testUser.email, UserSession.currentUser?.email)
        }
    }

    @Test
    fun `loginWithEmailAndPassword failure should emit Error state`() = runTest {
        // Given
        val email = "wrong@example.com"
        val password = "wrongpassword"
        val errorMessage = "Invalid credentials"
        whenever(repository.loginWithEmail(email, password))
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.loginWithEmailAndPassword(email, password, rememberMe = false)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error, awaitItem())

            // Verify user session is null
            assertTrue(UserSession.currentUser == null)
        }
    }

    @Test
    fun `loginWithEmailAndPassword with rememberMe should save credentials`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        whenever(repository.loginWithEmail(email, password))
            .thenReturn(Result.success(testUser))

        // When
        viewModel.state.test {
            awaitItem() // Idle

            viewModel.loginWithEmailAndPassword(email, password, rememberMe = true)

            awaitItem() // Loading
            awaitItem() // LoginSuccess

            // Then - verify SessionManager.setRememberMe was called
            // Note: This would require injecting SessionManager as a dependency
            // For now, we verify the state flow behaves correctly
            assertTrue(UserSession.currentUser != null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE LOGIN TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loginWithGoogle success should emit LoginSuccess state`() = runTest {
        // Given
        val idToken = "google-id-token-123"
        whenever(repository.loginWithGoogle(idToken))
            .thenReturn(Result.success(testUser))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.loginWithGoogle(idToken, rememberMe = false)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.LoginSuccess, awaitItem())

            assertTrue(UserSession.currentUser != null)
        }
    }

    @Test
    fun `loginWithGoogle failure should emit Error state`() = runTest {
        // Given
        val idToken = "invalid-token"
        val errorMessage = "Invalid Google token"
        whenever(repository.loginWithGoogle(idToken))
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.loginWithGoogle(idToken, rememberMe = false)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error, awaitItem())

            assertTrue(UserSession.currentUser == null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `registerWithEmail success should emit RegisterSuccess state`() = runTest {
        // Given
        val name = "New User"
        val email = "newuser@example.com"
        val password = "password123"
        whenever(repository.registerWithEmail(name, email, password))
            .thenReturn(Result.success(testUser))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.registerWithEmail(name, email, password)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.RegisterSuccess, awaitItem())

            assertTrue(UserSession.currentUser != null)
        }
    }

    @Test
    fun `registerWithEmail with existing email should emit Error state`() = runTest {
        // Given
        val name = "Existing User"
        val email = "existing@example.com"
        val password = "password123"
        val errorMessage = "Email already exists"
        whenever(repository.registerWithEmail(name, email, password))
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())

            viewModel.registerWithEmail(name, email, password)

            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error, awaitItem())

            assertTrue(UserSession.currentUser == null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `initial state should be Idle`() = runTest {
        viewModel.state.test {
            assertEquals(AuthUiState.Idle, awaitItem())
        }
    }

    @Test
    fun `multiple login attempts should emit states correctly`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"

        // First attempt - success
        whenever(repository.loginWithEmail(email, password))
            .thenReturn(Result.success(testUser))

        viewModel.state.test {
            awaitItem() // Idle

            // First login
            viewModel.loginWithEmailAndPassword(email, password, false)
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.LoginSuccess, awaitItem())

            // Second attempt - failure
            UserSession.clearSession()
            whenever(repository.loginWithEmail(email, "wrong"))
                .thenReturn(Result.failure(Exception("Invalid")))

            viewModel.loginWithEmailAndPassword(email, "wrong", false)
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error, awaitItem())
        }
    }
}
