package com.univalle.pedrochacolla.ui.home

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import app.cash.turbine.test
import com.univalle.pedrochacolla.data.model.Interaction
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
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
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit tests for HomeViewModel (Stats)
 *
 * Tests:
 * - Loading user progress
 * - Calculating collection completion percentage
 * - Loading interacted locations
 * - Error handling
 * - Empty state handling
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var viewModel: HomeViewModel
    private lateinit var locationRepo: LocationRepository
    private lateinit var interactionRepo: InteractionRepository

    private val testLocation1 = Location(
        id = "loc-1",
        name = "Location 1",
        description = "Description 1",
        cloudAnchorId = "anchor-1",
        latitude = -16.5,
        longitude = -68.15,
        virtualAssetId = "asset-1",
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    private val testLocation2 = Location(
        id = "loc-2",
        name = "Location 2",
        description = "Description 2",
        cloudAnchorId = "anchor-2",
        latitude = -16.51,
        longitude = -68.16,
        virtualAssetId = "asset-2",
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    private val testInteraction1 = Interaction(
        id = "int-1",
        userId = "test-user-id",
        locationId = "loc-1",
        interactionType = "view",
        timestamp = "2024-01-01T10:00:00Z",
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        locationRepo = mock()
        interactionRepo = mock()

        // Set up test user session
        UserSession.currentUserId = "test-user-id"

        viewModel = HomeViewModel(locationRepo, interactionRepo)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        UserSession.clearSession()
    }

    // ═══════════════════════════════════════════════════════════════
    // USER PROGRESS LOADING TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loadUserProgress should calculate completion percentage correctly`() = runTest {
        // Given - 2 total locations, 1 interacted
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(listOf(testLocation1, testLocation2)))
        whenever(interactionRepo.getUserInteractions("test-user-id"))
            .thenReturn(Result.success(listOf(testInteraction1)))

        // When/Then
        viewModel.uiState.test {
            assertEquals(HomeUiState.Loading, awaitItem())

            viewModel.loadUserProgress()

            val successState = awaitItem()
            assertTrue(successState is HomeUiState.Success)

            val state = successState as HomeUiState.Success
            assertEquals(2, state.totalLocations)
            assertEquals(1, state.visitedLocations)
            assertEquals(50, state.completionPercentage) // 1/2 = 50%
        }
    }

    @Test
    fun `loadUserProgress with no interactions should show 0 percent`() = runTest {
        // Given - 5 locations, 0 interactions
        val locations = List(5) { i ->
            testLocation1.copy(id = "loc-$i", name = "Location $i")
        }
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(locations))
        whenever(interactionRepo.getUserInteractions("test-user-id"))
            .thenReturn(Result.success(emptyList()))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val successState = awaitItem()
            assertTrue(successState is HomeUiState.Success)

            val state = successState as HomeUiState.Success
            assertEquals(5, state.totalLocations)
            assertEquals(0, state.visitedLocations)
            assertEquals(0, state.completionPercentage)
        }
    }

    @Test
    fun `loadUserProgress with all locations visited should show 100 percent`() = runTest {
        // Given - 3 locations, all interacted
        val locations = listOf(
            testLocation1.copy(id = "loc-1"),
            testLocation1.copy(id = "loc-2"),
            testLocation1.copy(id = "loc-3")
        )
        val interactions = listOf(
            testInteraction1.copy(id = "int-1", locationId = "loc-1"),
            testInteraction1.copy(id = "int-2", locationId = "loc-2"),
            testInteraction1.copy(id = "int-3", locationId = "loc-3")
        )
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(locations))
        whenever(interactionRepo.getUserInteractions("test-user-id"))
            .thenReturn(Result.success(interactions))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val successState = awaitItem()
            assertTrue(successState is HomeUiState.Success)

            val state = successState as HomeUiState.Success
            assertEquals(3, state.totalLocations)
            assertEquals(3, state.visitedLocations)
            assertEquals(100, state.completionPercentage)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loadUserProgress with location API error should emit Error state`() = runTest {
        // Given
        val errorMessage = "Network error fetching locations"
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val errorState = awaitItem()
            assertTrue(errorState is HomeUiState.Error)
            assertTrue((errorState as HomeUiState.Error).message.contains("locations"))
        }
    }

    @Test
    fun `loadUserProgress with interaction API error should emit Error state`() = runTest {
        // Given
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(listOf(testLocation1)))
        whenever(interactionRepo.getUserInteractions(any()))
            .thenReturn(Result.failure(Exception("Failed to fetch interactions")))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val errorState = awaitItem()
            assertTrue(errorState is HomeUiState.Error)
        }
    }

    @Test
    fun `loadUserProgress without user session should emit Error state`() = runTest {
        // Given - no user
        UserSession.currentUserId = null

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val errorState = awaitItem()
            assertTrue(errorState is HomeUiState.Error)
            assertTrue((errorState as HomeUiState.Error).message.contains("sesión"))
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EMPTY STATE TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loadUserProgress with no locations should show 0 total`() = runTest {
        // Given
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(emptyList()))
        whenever(interactionRepo.getUserInteractions(any()))
            .thenReturn(Result.success(emptyList()))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val successState = awaitItem()
            assertTrue(successState is HomeUiState.Success)

            val state = successState as HomeUiState.Success
            assertEquals(0, state.totalLocations)
            assertEquals(0, state.visitedLocations)
            assertEquals(0, state.completionPercentage)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `initial state should be Loading`() = runTest {
        viewModel.uiState.test {
            assertEquals(HomeUiState.Loading, awaitItem())
        }
    }

    @Test
    fun `reload should fetch data again`() = runTest {
        // Given
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(listOf(testLocation1)))
        whenever(interactionRepo.getUserInteractions(any()))
            .thenReturn(Result.success(listOf(testInteraction1)))

        viewModel.uiState.test {
            awaitItem() // Loading

            // First load
            viewModel.loadUserProgress()
            val firstState = awaitItem()
            assertTrue(firstState is HomeUiState.Success)

            // Reload
            viewModel.reload()
            assertEquals(HomeUiState.Loading, awaitItem())

            val reloadedState = awaitItem()
            assertTrue(reloadedState is HomeUiState.Success)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PERCENTAGE CALCULATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `completion percentage should round correctly`() = runTest {
        // Given - 3 locations, 1 visited = 33.33% → should round to 33
        val locations = List(3) { i -> testLocation1.copy(id = "loc-$i") }
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(locations))
        whenever(interactionRepo.getUserInteractions(any()))
            .thenReturn(Result.success(listOf(testInteraction1)))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val state = awaitItem() as HomeUiState.Success
            assertEquals(33, state.completionPercentage) // 1/3 = 33.33% → 33
        }
    }

    @Test
    fun `duplicate interactions should count as one visit`() = runTest {
        // Given - 1 location, 3 interactions for same location (duplicates)
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(listOf(testLocation1)))
        whenever(interactionRepo.getUserInteractions(any()))
            .thenReturn(Result.success(listOf(
                testInteraction1.copy(id = "int-1", locationId = "loc-1"),
                testInteraction1.copy(id = "int-2", locationId = "loc-1"),
                testInteraction1.copy(id = "int-3", locationId = "loc-1")
            )))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Loading

            viewModel.loadUserProgress()

            val state = awaitItem() as HomeUiState.Success
            assertEquals(1, state.totalLocations)
            assertEquals(1, state.visitedLocations) // Should count as 1, not 3
            assertEquals(100, state.completionPercentage)
        }
    }
}
