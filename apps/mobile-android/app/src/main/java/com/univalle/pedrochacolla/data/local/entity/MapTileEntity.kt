package com.univalle.pedrochacolla.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity

/**
 * Tracks which tile files have been downloaded to internal storage.
 * Composite PK = (version, zoom, x, y).
 */
@Entity(
    tableName = "map_tile",
    primaryKeys = ["version", "zoom", "x", "y"]
)
data class MapTileEntity(
    val version: Int,
    val zoom: Int,
    val x: Int,
    val y: Int,

    @ColumnInfo(name = "file_path")
    val filePath: String,              // relative path inside app's internal files dir

    val hash: String,                  // SHA-256 from manifest for integrity check

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long = System.currentTimeMillis()
)
