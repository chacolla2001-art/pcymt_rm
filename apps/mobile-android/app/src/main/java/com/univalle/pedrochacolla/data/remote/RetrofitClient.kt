package com.univalle.pedrochacolla.data.remote

import com.google.gson.GsonBuilder
import com.google.gson.Strictness
import com.univalle.pedrochacolla.data.remote.api.*
import com.univalle.pedrochacolla.utils.constants.Constants
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

/**
 * Retrofit client singleton providing typed API services
 * Uses ApiClient for OkHttp configuration with logging
 */
object RetrofitClient {
    private val gson = GsonBuilder()
        .setStrictness(Strictness.LENIENT)
        .create()

    val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(Constants.URL_BASE)
            .client(ApiClient.instance) // Uses configured OkHttp with logging
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    val authApi: AuthApiService by lazy {
        retrofit.create(AuthApiService::class.java)
    }

    val locationApi: LocationApiService by lazy {
        retrofit.create(LocationApiService::class.java)
    }

    val assetApi: VirtualAssetApiService by lazy {
        retrofit.create(VirtualAssetApiService::class.java)
    }

    val interactionApi: InteractionApiService by lazy {
        retrofit.create(InteractionApiService::class.java)
    }

    val userApi: UserApiService by lazy {
        retrofit.create(UserApiService::class.java)
    }

    val configApi: ConfigApiService by lazy {
        retrofit.create(ConfigApiService::class.java)
    }

    val mapConfigApi: MapConfigurationApiService by lazy {
        retrofit.create(MapConfigurationApiService::class.java)
    }

    val mapTileApi: MapTileApiService by lazy {
        retrofit.create(MapTileApiService::class.java)
    }
}
