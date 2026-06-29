package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.AnchorCluster
import com.univalle.pedrochacolla.data.model.Location
import com.univalle.pedrochacolla.data.remote.RetrofitClient
import com.univalle.pedrochacolla.data.remote.error.ApiError
import com.univalle.pedrochacolla.data.remote.error.retryWithPolicy
import com.univalle.pedrochacolla.data.remote.error.toApiError
import com.univalle.pedrochacolla.data.remote.error.toBusinessError
import timber.log.Timber

/**
 * LocationRepository - Handles location/anchor point operations
 * Uses Retrofit for API calls with automatic token injection via AuthInterceptor
 *
 * Features:
 * - Automatic retry with exponential backoff for network errors
 * - Type-safe error classification (ApiError sealed class)
 * - Comprehensive logging
 */
class LocationRepository {
    private val api = RetrofitClient.locationApi

    suspend fun getAllLocations(): Result<List<Location>> {
        Timber.d("getAllLocations: Fetching all locations")
        return try {
            val response = api.getAllLocations()
            if (response.isSuccessful && response.body()?.success == true) {
                val locations = response.body()?.data ?: emptyList()
                Timber.d("getAllLocations: Success - received ${locations.size} locations")
                Result.success(locations)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getAllLocations: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getAllLocations: Network error")
            Result.failure(e)
        }
    }

    suspend fun getActiveLocations(): Result<List<Location>> {
        Timber.d("getActiveLocations: Fetching active locations with retry policy")
        return retryWithPolicy {
            try {
                val response = api.getActiveLocations()

                when {
                    response.isSuccessful && response.body()?.success == true -> {
                        val locations = response.body()?.data ?: emptyList()
                        Timber.d("getActiveLocations: Success - received ${locations.size} active locations")
                        Result.success(locations)
                    }
                    response.isSuccessful && response.body()?.success == false -> {
                        // API returned success=false (business error)
                        Timber.w("getActiveLocations: Business error - ${response.body()?.message}")
                        Result.failure(response.body()?.toBusinessError() ?: Exception("Error desconocido del servidor"))
                    }
                    else -> {
                        // HTTP error (401, 404, 500, etc.)
                        Timber.w("getActiveLocations: HTTP error - ${response.code()}")
                        Result.failure(response.toApiError())
                    }
                }
            } catch (e: Exception) {
                // Network error (timeout, no connection)
                Timber.e(e, "getActiveLocations: Network exception")
                Result.failure(ApiError.fromThrowable(e))
            }
        }
    }

    suspend fun getLocationById(id: String): Result<Location> {
        Timber.d("getLocationById: Fetching location id=$id")
        return try {
            val response = api.getLocationById(id)
            if (response.isSuccessful && response.body()?.success == true) {
                val location = response.body()?.data
                if (location == null) {
                    Timber.w("getLocationById: Location not found for id=$id")
                    return Result.failure(Exception("Location not found"))
                }
                Timber.d("getLocationById: Success - found location '${location.name}'")
                Result.success(location)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getLocationById: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getLocationById: Network error for id=$id")
            Result.failure(e)
        }
    }

    suspend fun getLocationsByAsset(assetId: String): Result<List<Location>> {
        Timber.d("getLocationsByAsset: Fetching locations for asset=$assetId")
        return try {
            val response = api.getLocationsByAsset(assetId)
            if (response.isSuccessful && response.body()?.success == true) {
                val locations = response.body()?.data ?: emptyList()
                Timber.d("getLocationsByAsset: Success - found ${locations.size} locations for asset=$assetId")
                Result.success(locations)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getLocationsByAsset: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getLocationsByAsset: Network error for asset=$assetId")
            Result.failure(e)
        }
    }

    suspend fun createLocation(location: Location): Result<Location> {
        Timber.d("createLocation: Creating location '${location.name}' with anchor=${location.anchorCode}")
        return try {
            val response = api.createLocation(location)
            if (response.isSuccessful && response.body()?.success == true) {
                val createdLocation = response.body()?.data
                if (createdLocation == null) {
                    Timber.e("createLocation: No data in successful response")
                    return Result.failure(Exception("Failed to create location"))
                }
                Timber.i("createLocation: Success - created location id=${createdLocation.id}")
                Result.success(createdLocation)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("createLocation: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "createLocation: Network error")
            Result.failure(e)
        }
    }

    suspend fun updateLocation(id: String, location: Location): Result<Location> {
        Timber.d("updateLocation: Updating location id=$id")
        return try {
            val response = api.updateLocation(id, location)
            if (response.isSuccessful && response.body()?.success == true) {
                val updatedLocation = response.body()?.data
                if (updatedLocation == null) {
                    Timber.e("updateLocation: No data in successful response")
                    return Result.failure(Exception("Failed to update location"))
                }
                Timber.i("updateLocation: Success - updated location '${updatedLocation.name}'")
                Result.success(updatedLocation)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("updateLocation: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "updateLocation: Network error for id=$id")
            Result.failure(e)
        }
    }

    suspend fun deleteLocation(id: String): Result<Unit> {
        Timber.d("deleteLocation: Deleting location id=$id")
        return try {
            val response = api.deleteLocation(id)
            if (response.isSuccessful && response.body()?.success == true) {
                Timber.i("deleteLocation: Success - deleted location id=$id")
                Result.success(Unit)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("deleteLocation: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "deleteLocation: Network error for id=$id")
            Result.failure(e)
        }
    }

    suspend fun getClusters(): Result<List<AnchorCluster>> {
        Timber.d("getClusters: Fetching anchor point clusters")
        return try {
            val response = api.getClusters()
            if (response.isSuccessful && response.body()?.success == true) {
                val clusters = response.body()?.data ?: emptyList()
                Timber.d("getClusters: Success - received ${clusters.size} clusters")
                Result.success(clusters)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Timber.w("getClusters: API error - $errorMsg")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Timber.e(e, "getClusters: Network error")
            Result.failure(e)
        }
    }
}
