package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.MapConfiguration
import com.univalle.pedrochacolla.data.remote.RetrofitClient
import timber.log.Timber

/**
 * MapConfigurationRepository - Handles map layer configuration CRUD
 */
class MapConfigurationRepository {
    private val api = RetrofitClient.mapConfigApi

    suspend fun getAvailable(platform: String? = null): Result<List<MapConfiguration>> {
        Timber.d("getAvailable: platform=$platform")
        return try {
            val response = api.getAvailable(platform)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "getAvailable: Network error")
            Result.failure(e)
        }
    }

    suspend fun getMine(platform: String? = null): Result<List<MapConfiguration>> {
        Timber.d("getMine: platform=$platform")
        return try {
            val response = api.getMine(platform)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "getMine: Network error")
            Result.failure(e)
        }
    }

    suspend fun getPublic(platform: String? = null): Result<List<MapConfiguration>> {
        Timber.d("getPublic: platform=$platform")
        return try {
            val response = api.getPublic(platform)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "getPublic: Network error")
            Result.failure(e)
        }
    }

    suspend fun getById(id: String): Result<MapConfiguration> {
        Timber.d("getById: id=$id")
        return try {
            val response = api.getById(id)
            if (response.isSuccessful && response.body()?.success == true) {
                val config = response.body()?.data
                    ?: return Result.failure(Exception("Configuration not found"))
                Result.success(config)
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "getById: Network error")
            Result.failure(e)
        }
    }

    suspend fun create(config: MapConfiguration): Result<MapConfiguration> {
        Timber.d("create: name=${config.name}")
        return try {
            val response = api.create(config)
            if (response.isSuccessful && response.body()?.success == true) {
                val created = response.body()?.data
                    ?: return Result.failure(Exception("Failed to create config"))
                Timber.i("create: Success - id=${created.id}")
                Result.success(created)
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "create: Network error")
            Result.failure(e)
        }
    }

    suspend fun update(id: String, config: MapConfiguration): Result<MapConfiguration> {
        Timber.d("update: id=$id")
        return try {
            val response = api.update(id, config)
            if (response.isSuccessful && response.body()?.success == true) {
                val updated = response.body()?.data
                    ?: return Result.failure(Exception("Failed to update config"))
                Result.success(updated)
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "update: Network error")
            Result.failure(e)
        }
    }

    suspend fun delete(id: String): Result<Unit> {
        Timber.d("delete: id=$id")
        return try {
            val response = api.delete(id)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "delete: Network error")
            Result.failure(e)
        }
    }

    suspend fun getGlobal(): Result<MapConfiguration> {
        Timber.d("getGlobal")
        return try {
            val response = api.getGlobal()
            if (response.isSuccessful && response.body()?.success == true) {
                val config = response.body()?.data
                    ?: return Result.failure(Exception("No global configuration found"))
                Result.success(config)
            } else {
                Result.failure(Exception(response.body()?.message ?: "HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "getGlobal: Network error")
            Result.failure(e)
        }
    }
}
