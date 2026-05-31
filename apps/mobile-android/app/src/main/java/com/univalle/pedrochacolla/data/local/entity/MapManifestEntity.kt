package com.univalle.pedrochacolla.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Cached tile-map manifest. Only the latest version row is kept.
 */
@Entity(tableName = "map_manifest")
data class MapManifestEntity(
    @PrimaryKey
    val version: Int,

    val etag: String,

    @ColumnInfo(name = "tile_size")
    val tileSize: Int,

    @ColumnInfo(name = "zoom_levels")
    val zoomLevels: String,            // JSON array stringified

    @ColumnInfo(name = "overlays_json")
    val overlaysJson: String,          // JSON array of overlay names

    @ColumnInfo(name = "generated_at")
    val generatedAt: String,

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long = System.currentTimeMillis()
)
