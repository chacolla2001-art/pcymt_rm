package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * MapConfiguration model - Represents a saved map layer configuration
 * Backend table: map_configurations
 */
data class MapConfiguration(
    val id: String? = null,

    @SerializedName("user_id")
    val userId: String? = null,

    val name: String,

    val description: String? = null,

    val platform: String = "mobile",

    @SerializedName("config_data")
    val configData: MapConfigData,

    @SerializedName("is_public")
    val isPublic: Boolean = false,

    @SerializedName("created_at")
    val createdAt: Date? = null,

    @SerializedName("updated_at")
    val updatedAt: Date? = null
)

/**
 * Nested map view state — used when config was saved from the web frontend.
 * The web frontend serializes: { mapState: { scale, rotation, ... }, stickerLayers: [...] }
 */
data class MapViewState(
    val scale: Float = 1.2f,
    val rotation: Float = 0f,
    val offsetX: Float = 0f,
    val offsetY: Float = 0f,
    val showGrid: Boolean = false,
    val showBoundary: Boolean = false,
    val showSections: Boolean = true,
    val showLabels: Boolean = true
)

/**
 * The actual map configuration data stored as JSON.
 *
 * Supports two serialization formats:
 * - **Web format (nested):** `{ mapState: { scale, rotation, ... }, stickerLayers: [...] }`
 * - **Mobile format (flat):** `{ scale, rotation, offsetX, offsetY, ... }`
 *
 * Use the `effective*` properties to transparently get correct values regardless of format.
 */
data class MapConfigData(
    // ── Flat fields (mobile format / legacy) ──
    val scale: Float = 1.2f,
    val rotation: Float = 0f,
    @SerializedName("offset_x")
    val offsetX: Float = 0f,
    @SerializedName("offset_y")
    val offsetY: Float = 0f,
    @SerializedName("show_grid")
    val showGrid: Boolean = false,
    @SerializedName("show_boundary")
    val showBoundary: Boolean = false,
    @SerializedName("show_sections")
    val showSections: Boolean = true,
    @SerializedName("show_labels")
    val showLabels: Boolean = true,
    @SerializedName("poi_visible")
    val poiVisible: Boolean = false,
    @SerializedName("poi_positions")
    val poiPositions: List<PoiPositionSave>? = null,
    @SerializedName(value = "stickerLayers", alternate = ["stickers", "sticker_layers"])
    val stickers: List<StickerLayerData>? = null,
    @SerializedName(value = "model3dPlacements", alternate = ["model_3d_placements"])
    val model3dPlacements: List<Model3DPlacementData>? = null,
    // ── Nested map state (web frontend format) ──
    val mapState: MapViewState? = null
) {
    /** Effective scale — prefers nested mapState if present */
    val effectiveScale: Float get() = mapState?.scale ?: scale
    /** Effective rotation */
    val effectiveRotation: Float get() = mapState?.rotation ?: rotation
    /** Effective offsetX */
    val effectiveOffsetX: Float get() = mapState?.offsetX ?: offsetX
    /** Effective offsetY */
    val effectiveOffsetY: Float get() = mapState?.offsetY ?: offsetY
    /** Effective showGrid */
    val effectiveShowGrid: Boolean get() = mapState?.showGrid ?: showGrid
    /** Effective showBoundary */
    val effectiveShowBoundary: Boolean get() = mapState?.showBoundary ?: showBoundary
    /** Effective showSections */
    val effectiveShowSections: Boolean get() = mapState?.showSections ?: showSections
    /** Effective showLabels */
    val effectiveShowLabels: Boolean get() = mapState?.showLabels ?: showLabels
}

/**
 * Saved position for a moveable POI marker
 */
data class PoiPositionSave(
    val id: Int,
    val lat: Double,
    val lng: Double
)

/**
 * Sticker layer data for serialization in config
 * Fields are nullable to survive Gson's Unsafe.allocateInstance() which bypasses
 * Kotlin constructor defaults.
 */
data class StickerLayerData(
    @SerializedName("id")
    val id: String? = null,
    @SerializedName("name")
    val name: String? = null,
    @SerializedName("visible")
    val visible: Boolean? = true,
    @SerializedName("opacity")
    val opacity: Double? = null,
    @SerializedName("stickers")
    val stickers: List<StickerInstanceData>? = null
)

/**
 * Individual sticker instance data
 * Fields are nullable to survive Gson's Unsafe.allocateInstance().
 *
 * Every field has an explicit @SerializedName so Gson never relies on
 * Kotlin-compiled field names (which R8 full-mode may mangle).
 */
data class StickerInstanceData(
    @SerializedName("id")
    val id: String? = null,
    @SerializedName(value = "stickerKey", alternate = ["sticker_key"])
    val stickerKey: String? = null,
    @SerializedName("lat")
    val lat: Double? = null,
    @SerializedName("lng")
    val lng: Double? = null,
    @SerializedName("scale")
    val scale: Double? = null,
    @SerializedName("rotation")
    val rotation: Double? = null,
    @SerializedName("opacity")
    val opacity: Double? = null
)

/**
 * 3D model placement data for scenery (trees, hedges, structures, etc.)
 * Synced from the frontend admin panel via MapConfiguration API.
 * Fields are nullable to survive Gson's Unsafe.allocateInstance().
 */
data class Model3DPlacementData(
    @SerializedName(value = "modelKey", alternate = ["model_key"])
    val modelKey: String? = null,
    val lat: Double? = 0.0,
    val lng: Double? = 0.0,
    val scale: Float? = 1.0f,
    @SerializedName(value = "rotationY", alternate = ["rotation_y"])
    val rotationY: Float? = 0f
)
