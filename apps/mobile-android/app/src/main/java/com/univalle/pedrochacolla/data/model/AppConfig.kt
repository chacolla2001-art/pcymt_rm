package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName

/**
 * AppConfig model - Public configuration from backend
 * Endpoint: GET /api/config
 */
data class AppConfig(
    val google: GoogleConfig? = null,
    val arcore: ARCoreConfig? = null,
    val features: FeaturesConfig? = null
)

data class GoogleConfig(
    @SerializedName("webClientId")
    val webClientId: String? = null,
    
    @SerializedName("androidClientId")
    val androidClientId: String? = null,
    
    @SerializedName("mapsApiKey")
    val mapsApiKey: String? = null
)

data class ARCoreConfig(
    @SerializedName("cloudAnchorTtlDays")
    val cloudAnchorTtlDays: Int = 1
)

data class FeaturesConfig(
    @SerializedName("googleAuthEnabled")
    val googleAuthEnabled: Boolean = false,
    
    @SerializedName("mapsEnabled")
    val mapsEnabled: Boolean = false
)

/**
 * Response from POST /api/config/arcore-token
 * Contains an OAuth2 access token for ARCore keyless auth
 */
data class ArcoreTokenResponse(
    val token: String
)
