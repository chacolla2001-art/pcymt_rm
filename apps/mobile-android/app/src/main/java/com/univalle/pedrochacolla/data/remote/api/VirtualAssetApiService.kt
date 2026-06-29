package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import com.univalle.pedrochacolla.data.model.VirtualAsset
import retrofit2.Response
import retrofit2.http.*

/**
 * Virtual Assets API endpoints
 */
interface VirtualAssetApiService {
    @GET("api/virtual-assets")
    suspend fun getAllAssets(): Response<ApiResponse<List<VirtualAsset>>>

    @GET("api/virtual-assets/active")
    suspend fun getActiveAssets(): Response<ApiResponse<List<VirtualAsset>>>

    @GET("api/virtual-assets/{id}")
    suspend fun getAssetById(
        @Path("id") id: String
    ): Response<ApiResponse<VirtualAsset>>

    @POST("api/virtual-assets")
    suspend fun createAsset(
        @Body asset: VirtualAsset
    ): Response<ApiResponse<VirtualAsset>>

    @PUT("api/virtual-assets/{id}")
    suspend fun updateAsset(
        @Path("id") id: String,
        @Body asset: VirtualAsset
    ): Response<ApiResponse<VirtualAsset>>

    @DELETE("api/virtual-assets/{id}")
    suspend fun deleteAsset(
        @Path("id") id: String
    ): Response<ApiResponse<Unit>>
}
