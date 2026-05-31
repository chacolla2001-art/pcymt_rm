package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Interaction model - Tracks user interactions with AR virtual assets
 * Backend table: interactions
 */
data class Interaction(
    val id: String? = null,

    @SerializedName("user_id")
    val userId: String,

    @SerializedName("virtual_asset_id")
    val virtualAssetId: String? = null,

    @SerializedName("location_id")
    val locationId: String? = null,

    @SerializedName("interaction_type")
    val interactionType: String,

    val metadata: Map<String, Any>? = null,

    @SerializedName("created_at")
    val createdAt: Date? = null
)
