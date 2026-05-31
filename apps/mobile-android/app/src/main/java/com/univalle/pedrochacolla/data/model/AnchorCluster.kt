package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName

/**
 * Represents a cluster of anchor points that share the same virtual asset.
 * When multiple anchors reference the same 3D model, they form a "zone"
 * rendered as a convex-hull polygon on the park map.
 */
data class AnchorCluster(
    @SerializedName("virtualAssetId")
    val virtualAssetId: String,

    val section: String?,

    val count: Int,

    @SerializedName("isCluster")
    val isCluster: Boolean,

    val center: ClusterCenter,

    val bounds: ClusterBounds?,

    val polygon: List<ClusterPoint>?,

    val locations: List<ClusterLocation>
)

data class ClusterCenter(
    val lat: Double,
    val lng: Double
)

data class ClusterBounds(
    val minLat: Double,
    val maxLat: Double,
    val minLng: Double,
    val maxLng: Double
)

data class ClusterPoint(
    val lat: Double,
    val lng: Double
)

data class ClusterLocation(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("anchorCode")
    val anchorCode: String?,
    @SerializedName("showInMap")
    val showInMap: Boolean,
    val scale: Float,
    @SerializedName("rotationY")
    val rotationY: Float
)
