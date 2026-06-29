package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import com.univalle.pedrochacolla.data.model.Interaction
import retrofit2.Response
import retrofit2.http.*

/**
 * User Interactions API endpoints
 */
interface InteractionApiService {
    @GET("api/user-interactions")
    suspend fun getAllInteractions(): Response<ApiResponse<List<Interaction>>>

    @GET("api/user-interactions/{id}")
    suspend fun getInteractionById(
        @Path("id") id: String
    ): Response<ApiResponse<Interaction>>

    @GET("api/user-interactions/user/{userId}")
    suspend fun getInteractionsByUser(
        @Path("userId") userId: String
    ): Response<ApiResponse<List<Interaction>>>

    @GET("api/user-interactions/by-virtual-asset/{assetId}")
    suspend fun getInteractionsByAsset(
        @Path("assetId") assetId: String
    ): Response<ApiResponse<List<Interaction>>>

    @POST("api/user-interactions")
    suspend fun createInteraction(
        @Body interaction: Interaction
    ): Response<ApiResponse<Interaction>>

    @PUT("api/user-interactions/{id}")
    suspend fun updateInteraction(
        @Path("id") id: String,
        @Body interaction: Interaction
    ): Response<ApiResponse<Interaction>>

    @DELETE("api/user-interactions/{id}")
    suspend fun deleteInteraction(
        @Path("id") id: String
    ): Response<ApiResponse<Unit>>

    @DELETE("api/user-interactions/user/{userId}/reset")
    suspend fun resetGame(
        @Path("userId") userId: String
    ): Response<ApiResponse<Any>>
}
