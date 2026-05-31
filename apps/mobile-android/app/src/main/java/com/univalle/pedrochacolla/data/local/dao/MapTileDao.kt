package com.univalle.pedrochacolla.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.univalle.pedrochacolla.data.local.entity.MapManifestEntity
import com.univalle.pedrochacolla.data.local.entity.MapOverlayEntity
import com.univalle.pedrochacolla.data.local.entity.MapTileEntity

@Dao
interface MapTileDao {

    // ── Manifest ────────────────────────────────────────────

    @Query("SELECT * FROM map_manifest ORDER BY version DESC LIMIT 1")
    suspend fun getLatestManifest(): MapManifestEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertManifest(manifest: MapManifestEntity)

    @Query("DELETE FROM map_manifest WHERE version < :keepVersion")
    suspend fun deleteOldManifests(keepVersion: Int)

    // ── Overlays ────────────────────────────────────────────

    @Query("SELECT * FROM map_overlay WHERE name = :name")
    suspend fun getOverlay(name: String): MapOverlayEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertOverlay(overlay: MapOverlayEntity)

    @Query("DELETE FROM map_overlay WHERE version < :keepVersion")
    suspend fun deleteOldOverlays(keepVersion: Int)

    // ── Tiles ───────────────────────────────────────────────

    @Query("SELECT * FROM map_tile WHERE version = :version AND zoom = :zoom")
    suspend fun getTilesForZoom(version: Int, zoom: Int): List<MapTileEntity>

    @Query("SELECT * FROM map_tile WHERE version = :version AND zoom = :zoom AND x = :x AND y = :y")
    suspend fun getTile(version: Int, zoom: Int, x: Int, y: Int): MapTileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTile(tile: MapTileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTiles(tiles: List<MapTileEntity>)

    @Query("DELETE FROM map_tile WHERE version < :keepVersion")
    suspend fun deleteOldTiles(keepVersion: Int)

    @Query("SELECT COUNT(*) FROM map_tile WHERE version = :version")
    suspend fun countTiles(version: Int): Int
}
