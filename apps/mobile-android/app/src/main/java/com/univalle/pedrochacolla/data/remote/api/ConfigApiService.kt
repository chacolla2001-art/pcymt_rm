package com.univalle.pedrochacolla.data.remote.api

import com.univalle.pedrochacolla.data.model.ApiResponse
import com.univalle.pedrochacolla.data.model.AppConfig
import com.univalle.pedrochacolla.data.model.ArcoreTokenResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Config API Service - Fetches public configuration from backend
 * Endpoint: GET /api/config
 */
interface ConfigApiService {
    @GET("api/config")
    suspend fun getConfig(): Response<ApiResponse<AppConfig>>

    @POST("api/config/arcore-token")
    suspend fun getArcoreToken(): Response<ApiResponse<ArcoreTokenResponse>>
}
