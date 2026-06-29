package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.remote.api.LocationApiService
import com.univalle.pedrochacolla.data.remote.dto.ApiResponse
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Before
import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import retrofit2.Response
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit tests for LocationRepository
 *
 * Tests:
 * - Fetching active locations (success/failure)
 * - Creating new locations (success/failure)
 * - Updating locations (success/failure)
 * - HTTP error code handling (401, 403, 404, 500)
 * - Network error handling
 * - Result<T> unwrapping
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LocationRepositoryTest {

    private lateinit var repository: LocationRepository
    private lateinit var api: LocationApiService

    private val testLocation = Location(
        id = "loc-1",
        name = "Test Location",
        description = "Test description",
        cloudAnchorId = "anchor-123",
        latitude = -16.5,
        longitude = -68.15,
        virtualAssetId = "asset-1",
        isActive = true,
        createdAt = "2024-01-01",
        updatedAt = "2024-01-01"
    )

    @Before
    fun setup() {
        api = mock()
        repository = LocationRepository(api)
    }

    // ═══════════════════════════════════════════════════════════════
    // GET ACTIVE LOCATIONS TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `getActiveLocations success should return list of locations`() = runTest {
        // Given
        val locations = listOf(testLocation, testLocation.copy(id = "loc-2"))
        val apiResponse = ApiResponse(
            success = true,
            message = "Locations retrieved",
            data = locations
        )
        whenever(api.getActiveLocations())
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
        assertEquals("loc-1", result.getOrNull()?.get(0)?.id)
    }

    @Test
    fun `getActiveLocations with API error should return failure`() = runTest {
        // Given
        val errorResponse = ApiResponse<List<Location>>(
            success = false,
            message = "Failed to fetch locations",
            data = null
        )
        whenever(api.getActiveLocations())
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Failed to fetch") == true)
    }

    @Test
    fun `getActiveLocations with HTTP 500 should return failure`() = runTest {
        // Given
        whenever(api.getActiveLocations())
            .thenReturn(Response.error(500, "Server Error".toResponseBody()))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 500") == true)
    }

    @Test
    fun `getActiveLocations with network exception should return failure`() = runTest {
        // Given
        whenever(api.getActiveLocations())
            .thenThrow(java.net.SocketTimeoutException("Timeout"))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is java.net.SocketTimeoutException)
    }

    @Test
    fun `getActiveLocations with empty list should return success with empty list`() = runTest {
        // Given
        val apiResponse = ApiResponse(
            success = true,
            message = "No locations",
            data = emptyList<Location>()
        )
        whenever(api.getActiveLocations())
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull()?.size)
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE LOCATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `createLocation success should return created location`() = runTest {
        // Given
        val newLocation = mapOf(
            "name" to "New Location",
            "description" to "New description",
            "cloudAnchorId" to "anchor-999",
            "latitude" to -16.5,
            "longitude" to -68.15,
            "virtualAssetId" to "asset-1"
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Location created",
            data = testLocation
        )
        whenever(api.createLocation(newLocation))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.createLocation(newLocation)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("loc-1", result.getOrNull()?.id)
    }

    @Test
    fun `createLocation with duplicate cloudAnchorId should return failure`() = runTest {
        // Given
        val newLocation = mapOf("cloudAnchorId" to "existing-anchor")
        val errorResponse = ApiResponse<Location>(
            success = false,
            message = "Cloud anchor already exists",
            data = null
        )
        whenever(api.createLocation(newLocation))
            .thenReturn(Response.success(errorResponse))

        // When
        val result = repository.createLocation(newLocation)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("already exists") == true)
    }

    @Test
    fun `createLocation with HTTP 401 unauthorized should return failure`() = runTest {
        // Given
        whenever(api.createLocation(any()))
            .thenReturn(Response.error(401, "Unauthorized".toResponseBody()))

        // When
        val result = repository.createLocation(mapOf())

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 401") == true)
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE LOCATION TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `updateLocation success should return updated location`() = runTest {
        // Given
        val locationId = "loc-1"
        val updates = mapOf("name" to "Updated Name")
        val updatedLocation = testLocation.copy(name = "Updated Name")
        val apiResponse = ApiResponse(
            success = true,
            message = "Location updated",
            data = updatedLocation
        )
        whenever(api.updateLocation(locationId, updates))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.updateLocation(locationId, updates)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("Updated Name", result.getOrNull()?.name)
    }

    @Test
    fun `updateLocation with non-existent location should return failure`() = runTest {
        // Given
        val locationId = "non-existent"
        whenever(api.updateLocation(locationId, mapOf()))
            .thenReturn(Response.error(404, "Not Found".toResponseBody()))

        // When
        val result = repository.updateLocation(locationId, mapOf())

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 404") == true)
    }

    // ═══════════════════════════════════════════════════════════════
    // GET LOCATION BY ID TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `getLocationById success should return location`() = runTest {
        // Given
        val locationId = "loc-1"
        val apiResponse = ApiResponse(
            success = true,
            message = "Location found",
            data = testLocation
        )
        whenever(api.getLocationById(locationId))
            .thenReturn(Response.success(apiResponse))

        // When
        val result = repository.getLocationById(locationId)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("loc-1", result.getOrNull()?.id)
    }

    @Test
    fun `getLocationById with invalid ID should return failure`() = runTest {
        // Given
        val locationId = "invalid-id"
        whenever(api.getLocationById(locationId))
            .thenReturn(Response.error(404, "Not Found".toResponseBody()))

        // When
        val result = repository.getLocationById(locationId)

        // Then
        assertTrue(result.isFailure)
    }

    // ═══════════════════════════════════════════════════════════════
    // HTTP ERROR CODE TESTS
    // ═══════════════════════════════════════════════════════════════

    @Test
    fun `HTTP 403 forbidden should return failure with error message`() = runTest {
        // Given
        whenever(api.getActiveLocations())
            .thenReturn(Response.error(403, "Forbidden".toResponseBody()))

        // When
        val result = repository.getActiveLocations()

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 403") == true)
    }

    @Test
    fun `HTTP 400 bad request should return failure`() = runTest {
        // Given
        whenever(api.createLocation(any()))
            .thenReturn(Response.error(400, "Bad Request".toResponseBody()))

        // When
        val result = repository.createLocation(mapOf())

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 400") == true)
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER FOR ANY MATCHER
    // ═══════════════════════════════════════════════════════════════

    private fun <T> any(): T {
        org.mockito.kotlin.any<T>()
        return null as T
    }
}
