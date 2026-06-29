package com.univalle.pedrochacolla.data.repository

import com.univalle.pedrochacolla.data.model.Interaction
import com.univalle.pedrochacolla.data.remote.RetrofitClient

/**
 * InteractionRepository - Handles user interaction operations
 * Uses Retrofit for API calls with automatic token injection via AuthInterceptor
 */
class InteractionRepository {
    private val api = RetrofitClient.interactionApi

    suspend fun getAllInteractions(): Result<List<Interaction>> {
        return try {
            val response = api.getAllInteractions()
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

    suspend fun getInteractionById(id: String): Result<Interaction> {
        return try {
            val response = api.getInteractionById(id)
            if (response.isSuccessful && response.body()?.success == true) {
                val interaction = response.body()?.data
                    ?: return Result.failure(Exception("Interaction not found"))
                Result.success(interaction)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserInteractions(userId: String): Result<List<Interaction>> {
        return try {
            val response = api.getInteractionsByUser(userId)
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

    suspend fun getInteractedLocationIds(userId: String): Result<Set<String>> {
        return try {
            val interactionsResult = getUserInteractions(userId)
            if (interactionsResult.isSuccess) {
                val interactions = interactionsResult.getOrNull() ?: emptyList()
                val locationIds = interactions.mapNotNull { it.locationId }.toSet()
                Result.success(locationIds)
            } else {
                interactionsResult.exceptionOrNull()?.let { Result.failure(it) }
                    ?: Result.failure(Exception("Unknown error"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getInteractionsByAsset(assetId: String): Result<List<Interaction>> {
        return try {
            val response = api.getInteractionsByAsset(assetId)
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

    suspend fun createInteraction(interaction: Interaction): Result<Interaction> {
        return try {
            val response = api.createInteraction(interaction)
            if (response.isSuccessful && response.body()?.success == true) {
                val createdInteraction = response.body()?.data
                    ?: return Result.failure(Exception("Failed to create interaction"))
                Result.success(createdInteraction)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateInteraction(id: String, interaction: Interaction): Result<Interaction> {
        return try {
            val response = api.updateInteraction(id, interaction)
            if (response.isSuccessful && response.body()?.success == true) {
                val updatedInteraction = response.body()?.data
                    ?: return Result.failure(Exception("Failed to update interaction"))
                Result.success(updatedInteraction)
            } else {
                val errorMsg = response.body()?.message ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteInteraction(id: String): Result<Unit> {
        return try {
            val response = api.deleteInteraction(id)
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

    suspend fun resetGame(userId: String): Result<Unit> {
        return try {
            val response = api.resetGame(userId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                // Try to read error message from error body if body is null
                val errorMsg = try {
                    response.body()?.message
                } catch (_: Exception) { null }
                    ?: "HTTP ${response.code()}"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
