package com.univalle.pedrochacolla.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Cached overlay JSON blobs (anchors, zones, stickers, pois, etc.).
 * Each row = one overlay file tied to a manifest version.
 */
@Entity(tableName = "map_overlay")
data class MapOverlayEntity(
    @PrimaryKey
    val name: String,                  // e.g. "anchors", "zones", "stickers", "pois"

    val version: Int,                  // manifest version this belongs to

    val etag: String,

    @ColumnInfo(name = "data_json")
    val dataJson: String,              // raw JSON payload

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long = System.currentTimeMillis()
)
