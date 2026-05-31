package com.univalle.pedrochacolla.ui.ar

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import app.cash.turbine.test
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.model.VirtualAsset
import com.univalle.pedrochacolla.data.repository.InteractionRepository
import com.univalle.pedrochacolla.data.repository.LocationRepository
import com.univalle.pedrochacolla.data.repository.VirtualAssetRepository
import com.univalle.pedrochacolla.utils.ar.ResolvedAnchor
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
 * Unit tests for ArViewModel
 *
 * Tests:
 * - Anchor placement mode
 * - Cloud anchor hosting
 * - Remote anchor loading (with N+1 fix verification)
 * - Feature map quality updates
 * - Error handling
 * - State transitions
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ArViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var viewModel: ArViewModel
    private lateinit var locationRepo: LocationRepository
    private lateinit var assetRepo: VirtualAssetRepository
    private lateinit var interactionRepo: InteractionRepository

    private val testLocation1 = Location(
        id = "loc-1",
        name = "Test Location 1",
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
        name = "Test Location 2",
        description = "Description 2",
        cloudAnchorId = "anchor-2",
        latitude = -16.51,
        longitude = -68.16,
        virtualAssetId = "asset-2",
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    private val testAsset1 = VirtualAsset(
        id = "asset-1",
        name = "Model 1",
        description = "Test model 1",
        type = "3D Model",
        modelPath = "models/model1.glb",
        thumbnailPath = null,
        scale = 1.0f,
        rotation = 0f,
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    private val testAsset2 = VirtualAsset(
        id = "asset-2",
        name = "Model 2",
        description = "Test model 2",
        type = "3D Model",
        modelPath = "models/model2.glb",
        thumbnailPath = null,
        scale = 1.0f,
        rotation = 0f,
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        locationRepo = mock()
        assetRepo = mock()
        interactionRepo = mock()

        // Set up test user session
        UserSession.currentUserId = "test-user-id"

        viewModel = ArViewModel(locationRepo, assetRepo, interactionRepo)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        UserSession.clearSession()
    }

    // ═══════════════════════════════════════════════════════════════
    // ANCHOR PLACEMENT TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `startAnchorPlacementMode should transition to WaitingForAnchorPlacement`() = runTest {
        viewModel.uiState.test {
            assertEquals(ArUiState.Idle, awaitItem())

            viewModel.startAnchorPlacementMode()

            assertEquals(ArUiState.WaitingForAnchorPlacement, awaitItem())
        }
    }

    @Test
    fun `onAnchorPlacedInScene should transition to AnchorPlaced state`() = runTest {
        viewModel.uiState.test {
            assertEquals(ArUiState.Idle, awaitItem())

            viewModel.onAnchorPlacedInScene("test-anchor-id")

            assertEquals(ArUiState.AnchorPlaced("test-anchor-id"), awaitItem())
        }
    }

    @Test
    fun `resetToIdle should reset state to Idle`() = runTest {
        viewModel.uiState.test {
            awaitItem() // Idle

            // Change state
            viewModel.startAnchorPlacementMode()
            awaitItem() // WaitingForAnchorPlacement

            // Reset
            viewModel.resetToIdle()
            assertEquals(ArUiState.Idle, awaitItem())
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CLOUD ANCHOR HOSTING TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `onAnchorHostedToCloud with valid data should save successfully`() = runTest {
        // Given
        val cloudAnchorId = "cloud-anchor-123"
        val virtualAssetId = "asset-1"
        val latitude = -16.5
        val longitude = -68.15

        whenever(locationRepo.createLocation(any()))
            .thenReturn(Result.success(testLocation1))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.onAnchorHostedToCloud(cloudAnchorId, virtualAssetId, latitude, longitude)

            assertEquals(ArUiState.Loading("Guardando ancla..."), awaitItem())
            assertEquals(ArUiState.AnchorHostingSuccess(cloudAnchorId), awaitItem())
        }
    }

    @Test
    fun `onAnchorHostedToCloud failure should emit Error state`() = runTest {
        // Given
        val errorMessage = "Network error"
        whenever(locationRepo.createLocation(any()))
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.onAnchorHostedToCloud("anchor-id", "asset-id", -16.5, -68.15)

            assertEquals(ArUiState.Loading("Guardando ancla..."), awaitItem())

            val errorState = awaitItem()
            assertTrue(errorState is ArUiState.Error)
            assertTrue((errorState as ArUiState.Error).message.contains(errorMessage))
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REMOTE ANCHOR LOADING TESTS (N+1 FIX VERIFICATION)
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `loadRemoteAnchors should load anchors with batch loading (no N+1)`() = runTest {
        // Given - Mock batch API responses
        val locations = listOf(testLocation1, testLocation2)
        val interactedIds = setOf("loc-1")
        val assets = listOf(testAsset1, testAsset2)

        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(locations))
        whenever(interactionRepo.getInteractedLocationIds("test-user-id"))
            .thenReturn(Result.success(interactedIds))
        whenever(assetRepo.getAll())
            .thenReturn(Result.success(assets))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.loadRemoteAnchors()

            assertEquals(ArUiState.SearchingForAnchors("Buscando anclas disponibles..."), awaitItem())

            val loadedState = awaitItem()
            assertTrue(loadedState is ArUiState.AnchorsLoaded)

            val anchors = (loadedState as ArUiState.AnchorsLoaded).anchors
            assertEquals(2, anchors.size)

            // Verify anchor details
            val anchor1 = anchors.find { it.location.id == "loc-1" }!!
            assertEquals(testAsset1.id, anchor1.asset?.id)
            assertTrue(anchor1.isInteracted) // loc-1 is in interactedIds

            val anchor2 = anchors.find { it.location.id == "loc-2" }!!
            assertEquals(testAsset2.id, anchor2.asset?.id)
            assertTrue(!anchor2.isInteracted) // loc-2 is NOT in interactedIds
        }
    }

    @Test
    fun `loadRemoteAnchors with no user should emit Error`() = runTest {
        // Given - no user session
        UserSession.currentUserId = null

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.loadRemoteAnchors()

            val errorState = awaitItem()
            assertTrue(errorState is ArUiState.Error)
            assertTrue((errorState as ArUiState.Error).message.contains("usuario"))
        }
    }

    @Test
    fun `loadRemoteAnchors with API error should emit Error state`() = runTest {
        // Given
        val errorMessage = "Failed to fetch locations"
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.failure(Exception(errorMessage)))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.loadRemoteAnchors()

            assertEquals(ArUiState.SearchingForAnchors("Buscando anclas disponibles..."), awaitItem())

            val errorState = awaitItem()
            assertTrue(errorState is ArUiState.Error)
        }
    }

    @Test
    fun `loadRemoteAnchors with empty results should return empty list`() = runTest {
        // Given
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(emptyList()))
        whenever(interactionRepo.getInteractedLocationIds(any()))
            .thenReturn(Result.success(emptySet()))
        whenever(assetRepo.getAll())
            .thenReturn(Result.success(emptyList()))

        // When/Then
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.loadRemoteAnchors()

            awaitItem() // SearchingForAnchors

            val loadedState = awaitItem()
            assertTrue(loadedState is ArUiState.AnchorsLoaded)
            assertTrue((loadedState as ArUiState.AnchorsLoaded).anchors.isEmpty())
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FEATURE MAP QUALITY TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `updateFeatureMapQuality should update quality in CapturingQuality state`() = runTest {
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.updateFeatureMapQuality("SUFFICIENT")

            assertEquals(ArUiState.CapturingQuality, awaitItem())
        }
    }

    @Test
    fun `startQualityCapture should transition to CapturingQuality`() = runTest {
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.startQualityCapture()

            assertEquals(ArUiState.CapturingQuality, awaitItem())
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `setError should emit Error state`() = runTest {
        viewModel.uiState.test {
            awaitItem() // Idle

            viewModel.setError("Test error message")

            val errorState = awaitItem()
            assertTrue(errorState is ArUiState.Error)
            assertEquals("Test error message", (errorState as ArUiState.Error).message)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE TRANSITION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `state flow should emit initial Idle state`() = runTest {
        viewModel.uiState.test {
            assertEquals(ArUiState.Idle, awaitItem())
        }
    }

    @Test
    fun `complex state transitions should work correctly`() = runTest {
        // Given
        whenever(locationRepo.getActiveLocations())
            .thenReturn(Result.success(listOf(testLocation1)))
        whenever(interactionRepo.getInteractedLocationIds(any()))
            .thenReturn(Result.success(emptySet()))
        whenever(assetRepo.getAll())
            .thenReturn(Result.success(listOf(testAsset1)))

        viewModel.uiState.test {
            // 1. Idle
            assertEquals(ArUiState.Idle, awaitItem())

            // 2. Start placement mode
            viewModel.startAnchorPlacementMode()
            assertEquals(ArUiState.WaitingForAnchorPlacement, awaitItem())

            // 3. Anchor placed
            viewModel.onAnchorPlacedInScene("anchor-1")
            assertEquals(ArUiState.AnchorPlaced("anchor-1"), awaitItem())

            // 4. Start quality capture
            viewModel.startQualityCapture()
            assertEquals(ArUiState.CapturingQuality, awaitItem())

            // 5. Reset to idle
            viewModel.resetToIdle()
            assertEquals(ArUiState.Idle, awaitItem())

            // 6. Load remote anchors
            viewModel.loadRemoteAnchors()
            assertEquals(ArUiState.SearchingForAnchors("Buscando anclas disponibles..."), awaitItem())

            val loadedState = awaitItem()
            assertTrue(loadedState is ArUiState.AnchorsLoaded)
        }
    }
}
