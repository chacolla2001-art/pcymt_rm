package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.AnchorCluster
import com.univalle.pedrochacolla.data.model.ApiResponse
import com.univalle.pedrochacolla.data.model.Location
import retrofit2.Response
import retrofit2.http.*

/**
 * Location/Anchor Points API endpoints
 */
interface LocationApiService {
    @GET("api/anchor-points")
    suspend fun getAllLocations(): Response<ApiResponse<List<Location>>>

    @GET("api/anchor-points/active")
    suspend fun getActiveLocations(): Response<ApiResponse<List<Location>>>

    @GET("api/anchor-points/{id}")
    suspend fun getLocationById(
        @Path("id") id: String
    ): Response<ApiResponse<Location>>

    @GET("api/anchor-points/animal/{assetId}")
    suspend fun getLocationsByAsset(
        @Path("assetId") assetId: String
    ): Response<ApiResponse<List<Location>>>

    @GET("api/anchor-points/clusters")
    suspend fun getClusters(): Response<ApiResponse<List<AnchorCluster>>>

    @POST("api/anchor-points")
    suspend fun createLocation(
        @Body location: Location
    ): Response<ApiResponse<Location>>

    @PUT("api/anchor-points/{id}")
    suspend fun updateLocation(
        @Path("id") id: String,
        @Body location: Location
    ): Response<ApiResponse<Location>>

    @DELETE("api/anchor-points/{id}")
    suspend fun deleteLocation(
        @Path("id") id: String
    ): Response<ApiResponse<Unit>>
}
