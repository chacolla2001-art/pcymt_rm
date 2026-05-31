package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.VirtualAsset
import com.univalle.pedrochacolla.data.remote.RetrofitClient

/**
 * VirtualAssetRepository - Handles virtual asset operations
 * Uses Retrofit for API calls with automatic token injection via AuthInterceptor
 */
class VirtualAssetRepository {
    private val api = RetrofitClient.assetApi

    suspend fun getAll(): Result<List<VirtualAsset>> {
        return try {
            val response = api.getAllAssets()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getActive(): Result<List<VirtualAsset>> {
        return try {
            val response = api.getActiveAssets()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getById(id: String): Result<VirtualAsset> {
        return try {
            val response = api.getAssetById(id)
            if (response.isSuccessful && response.body()?.success == true) {
                val asset = response.body()?.data
                    ?: return Result.failure(Exception("Asset not found"))
                Result.success(asset)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getByIds(ids: List<String>): Result<Map<String, VirtualAsset>> {
        return try {
            val allResult = getAll()
            if (allResult.isSuccess) {
                val all = allResult.getOrNull() ?: emptyList()
                val filtered = all.filter { it.id in ids }.associateBy { it.id ?: "" }
                Result.success(filtered)
            } else {
                allResult.exceptionOrNull()?.let { Result.failure(it) }
                    ?: Result.failure(Exception("Unknown error"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun create(asset: VirtualAsset): Result<VirtualAsset> {
        return try {
            val response = api.createAsset(asset)
            if (response.isSuccessful && response.body()?.success == true) {
                val createdAsset = response.body()?.data
                    ?: return Result.failure(Exception("Failed to create asset"))
                Result.success(createdAsset)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun update(id: String, asset: VirtualAsset): Result<VirtualAsset> {
        return try {
            val response = api.updateAsset(id, asset)
            if (response.isSuccessful && response.body()?.success == true) {
                val updatedAsset = response.body()?.data
                    ?: return Result.failure(Exception("Failed to update asset"))
                Result.success(updatedAsset)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun delete(id: String): Result<Unit> {
        return try {
            val response = api.deleteAsset(id)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
