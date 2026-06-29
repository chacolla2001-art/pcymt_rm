package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Location model - Represents physical locations where AR virtual assets are displayed
 * Backend table: locations
 */
data class Location(
    val id: String? = null,

    val name: String,

    @SerializedName("anchor_code")
    val anchorCode: String? = null,

    val latitude: Double,

    val longitude: Double,

    val section: String? = null,

    @SerializedName("show_in_map")
    val showInMap: Boolean = true,

    val scale: Float = 1.0f,

    @SerializedName("rotation_y")
    val rotationY: Float = 0.0f,

    @SerializedName("virtual_asset_id")
    val virtualAssetId: String? = null,

    @SerializedName("spatial_data")
    val spatialData: SpatialData? = null,

    @SerializedName("is_active")
    val isActive: Boolean = true,

    @SerializedName("created_at")
    val createdAt: Date? = null,

    @SerializedName("updated_at")
    val updatedAt: Date? = null
)

/**
 * Virtual Point Space Map — spatial mapping data stored per anchor point.
 * Captures environment geometry so the AR animal can be repositioned
 * accurately for visitors even without Cloud Anchors.
 */
data class SpatialData(
    /** Version of the spatial data format */
    val version: Int = 1,

    /** Anchor pose relative to the dominant plane (4x4 column-major matrix) */
    @SerializedName("anchor_pose")
    val anchorPose: List<Float>? = null,

    /** Dominant surface: plane equation (nx, ny, nz, d) */
    @SerializedName("plane_equation")
    val planeEquation: List<Float>? = null,

    /** Plane type: HORIZONTAL_UPWARD, HORIZONTAL_DOWNWARD, VERTICAL */
    @SerializedName("plane_type")
    val planeType: String? = null,

    /** Plane boundary polygon (list of [x,y,z] local coords) */
    @SerializedName("plane_boundary")
    val planeBoundary: List<List<Float>>? = null,

    /** Captured feature points near the anchor (list of [x,y,z,confidence]) */
    @SerializedName("feature_points")
    val featurePoints: List<List<Float>>? = null,

    /** Compass heading at placement time (degrees from magnetic north) */
    @SerializedName("compass_heading")
    val compassHeading: Float? = null,

    /** GPS accuracy at capture time (meters) */
    @SerializedName("gps_accuracy")
    val gpsAccuracy: Float? = null,

    /** Device altitude at capture time (meters above sea level) */
    val altitude: Double? = null,

    /** Timestamp of spatial capture (ISO 8601) */
    @SerializedName("captured_at")
    val capturedAt: String? = null
)
