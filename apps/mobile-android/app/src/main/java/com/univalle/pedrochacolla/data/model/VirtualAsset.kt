package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * VirtualAsset model - Represents 3D virtual assets (animals, plants, objects) for AR
 * Backend table: virtual_assets
 */
data class VirtualAsset(
    val id: String? = null,

    val name: String,

    @SerializedName("scientific_name")
    val scientificName: String? = null,

    val description: String? = null,

    @SerializedName("model_url")
    val modelUrl: String,

    @SerializedName("icon_url")
    val iconUrl: String? = null,

    @SerializedName("thumbnail_url")
    val thumbnailUrl: String? = null,

    val category: String? = null,

    val habitat: String? = null,

    @SerializedName("display_order")
    val displayOrder: Int? = 0,

    @SerializedName("is_active")
    val isActive: Boolean = true,

    @SerializedName("created_at")
    val createdAt: Date? = null,

    @SerializedName("updated_at")
    val updatedAt: Date? = null
)
