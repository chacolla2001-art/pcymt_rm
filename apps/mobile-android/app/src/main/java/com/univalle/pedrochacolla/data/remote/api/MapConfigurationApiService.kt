package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import com.univalle.pedrochacolla.data.model.MapConfiguration
import retrofit2.Response
import retrofit2.http.*

interface MapConfigurationApiService {
    @GET("api/map-configurations")
    suspend fun getAvailable(
        @Query("platform") platform: String? = null
    ): Response<ApiResponse<List<MapConfiguration>>>

    @GET("api/map-configurations/mine")
    suspend fun getMine(
        @Query("platform") platform: String? = null
    ): Response<ApiResponse<List<MapConfiguration>>>

    @GET("api/map-configurations/public")
    suspend fun getPublic(
        @Query("platform") platform: String? = null
    ): Response<ApiResponse<List<MapConfiguration>>>

    @GET("api/map-configurations/{id}")
    suspend fun getById(
        @Path("id") id: String
    ): Response<ApiResponse<MapConfiguration>>

    @POST("api/map-configurations")
    suspend fun create(
        @Body config: MapConfiguration
    ): Response<ApiResponse<MapConfiguration>>

    @PUT("api/map-configurations/{id}")
    suspend fun update(
        @Path("id") id: String,
        @Body config: MapConfiguration
    ): Response<ApiResponse<MapConfiguration>>

    @DELETE("api/map-configurations/{id}")
    suspend fun delete(
        @Path("id") id: String
    ): Response<ApiResponse<Unit>>

    @GET("api/map-configurations/global")
    suspend fun getGlobal(): Response<ApiResponse<MapConfiguration>>
}
