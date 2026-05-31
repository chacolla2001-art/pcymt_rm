package com.univalle.pedrochacolla.data.repository

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.univalle.pedrochacolla.data.local.dao.MapTileDao
import com.univalle.pedrochacolla.data.local.entity.MapManifestEntity
import com.univalle.pedrochacolla.data.local.entity.MapOverlayEntity
import com.univalle.pedrochacolla.data.local.entity.MapTileEntity
import com.univalle.pedrochacolla.data.remote.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream

/**
 * Manages synchronization of pre-rendered map tiles between the server
 * and local storage. Uses ETag-based cache validation so only changed
 * data is re-downloaded.
 *
 * Flow on app start:
 *   1. Check manifest ETag → if 304, nothing changed, skip
 *   2. If new version → download tiles (ZIP per zoom level)
 *   3. Download / update each overlay (anchors, zones, stickers, pois)
 *   4. Purge tiles from old versions
 */
class MapSyncManager(
    private val context: Context,
    private val dao: MapTileDao,
    private val gson: Gson = Gson()
) {
    private val api = RetrofitClient.mapTileApi

    data class SyncResult(
        val updated: Boolean,
        val version: Int,
        val tilesDownloaded: Int,
        val overlaysUpdated: Int,
        val error: String? = null
    )

    /** Runs a full sync cycle. Safe to call from any coroutine scope. */
    suspend fun sync(): SyncResult = withContext(Dispatchers.IO) {
        try {
            val cached = dao.getLatestManifest()
            val manifestResp = api.getManifest(etag = cached?.etag)

            if (manifestResp.code() == 304) {
                Timber.d("MapSync: manifest not modified (ETag match)")
                return@withContext SyncResult(
                    updated = false,
                    version = cached?.version ?: 0,
                    tilesDownloaded = 0,
                    overlaysUpdated = 0
                )
            }

            if (!manifestResp.isSuccessful) {
                val msg = "Manifest fetch failed: ${manifestResp.code()}"
                Timber.w(msg)
                return@withContext SyncResult(false, cached?.version ?: 0, 0, 0, error = msg)
            }

            val body = manifestResp.body()?.string() ?: return@withContext SyncResult(
                false, 0, 0, 0, error = "Empty manifest body"
            )
            val manifest = gson.fromJson(body, ManifestDto::class.java)
            val newEtag = manifestResp.headers()["ETag"] ?: ""

            // Persist manifest
            val zoomJson = gson.toJson(manifest.zoomLevels)
            val overlayNames = manifest.overlays?.map { it } ?: emptyList()
            val overlayJson = gson.toJson(overlayNames)

            dao.upsertManifest(
                MapManifestEntity(
                    version = manifest.version,
                    etag = newEtag,
                    tileSize = manifest.tileSize,
                    zoomLevels = zoomJson,
                    overlaysJson = overlayJson,
                    generatedAt = manifest.generatedAt
                )
            )

            // Download tiles for each zoom level via ZIP
            var tilesDownloaded = 0
            for (zl in manifest.zoomLevels) {
                tilesDownloaded += downloadZoomLevel(manifest.version, zl)
            }

            // Download overlays
            var overlaysUpdated = 0
            for (name in overlayNames) {
                if (downloadOverlay(name, manifest.version)) {
                    overlaysUpdated++
                }
            }

            // Cleanup old versions
            dao.deleteOldManifests(manifest.version)
            dao.deleteOldOverlays(manifest.version)
            dao.deleteOldTiles(manifest.version)
            purgeOldTileFiles(manifest.version)

            Timber.i("MapSync: v${manifest.version} — $tilesDownloaded tiles, $overlaysUpdated overlays")
            SyncResult(
                updated = true,
                version = manifest.version,
                tilesDownloaded = tilesDownloaded,
                overlaysUpdated = overlaysUpdated
            )
        } catch (e: Exception) {
            Timber.e(e, "MapSync: sync failed")
            SyncResult(false, 0, 0, 0, error = e.message)
        }
    }

    /** Returns the cached overlay JSON for a given name, or null. */
    suspend fun getOverlayJson(name: String): String? = withContext(Dispatchers.IO) {
        dao.getOverlay(name)?.dataJson
    }

    /** Returns the local file path for a tile, or null if not cached. */
    suspend fun getTileFile(version: Int, zoom: Int, x: Int, y: Int): File? = withContext(Dispatchers.IO) {
        val entity = dao.getTile(version, zoom, x, y) ?: return@withContext null
        val file = File(tilesDir(), entity.filePath)
        if (file.exists()) file else null
    }

    /** Returns the latest cached manifest version, or 0. */
    suspend fun getCachedVersion(): Int = withContext(Dispatchers.IO) {
        dao.getLatestManifest()?.version ?: 0
    }

    // ── Internals ───────────────────────────────────────────

    private fun tilesDir(): File {
        val dir = File(context.filesDir, "map-tiles")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private suspend fun downloadZoomLevel(version: Int, zl: ZoomLevelDto): Int {
        val existing = dao.countTiles(version)
        // Only download if we don't have tiles for this version yet
        // (could be smarter with per-tile hash checks, but ZIP is efficient)
        val resp = api.getZoomZip(zl.z)
        if (!resp.isSuccessful) {
            Timber.w("MapSync: failed to download z${zl.z} ZIP: ${resp.code()}")
            return 0
        }

        val zipBytes = resp.body()?.bytes() ?: return 0
        val zoomDir = File(tilesDir(), "v${version}/z${zl.z}")
        if (!zoomDir.exists()) zoomDir.mkdirs()

        // Extract ZIP
        var count = 0
        java.util.zip.ZipInputStream(zipBytes.inputStream()).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val outFile = File(zoomDir, entry.name)
                    
                    // Path traversal protection
                    if (!outFile.canonicalPath.startsWith(zoomDir.canonicalPath)) {
                        Timber.w("MapSync: skipping suspicious ZIP entry: ${entry.name}")
                        zis.closeEntry()
                        entry = zis.nextEntry
                        continue
                    }

                    FileOutputStream(outFile).use { fos ->
                        zis.copyTo(fos)
                    }

                    // Parse x_y from filename (e.g. "0_0.png")
                    val baseName = outFile.nameWithoutExtension
                    val parts = baseName.split("_")
                    if (parts.size == 2) {
                        val x = parts[0].toIntOrNull() ?: 0
                        val y = parts[1].toIntOrNull() ?: 0
                        dao.upsertTile(
                            MapTileEntity(
                                version = version,
                                zoom = zl.z,
                                x = x, y = y,
                                filePath = "v${version}/z${zl.z}/${entry.name}",
                                hash = "" // Could verify against manifest hashes
                            )
                        )
                        count++
                    }
                }
                zis.closeEntry()
                entry = zis.nextEntry
            }
        }
        return count
    }

    private suspend fun downloadOverlay(name: String, version: Int): Boolean {
        val existing = dao.getOverlay(name)
        val resp = api.getOverlay(name, etag = existing?.etag)

        if (resp.code() == 304) return false
        if (!resp.isSuccessful) {
            Timber.w("MapSync: overlay '$name' fetch failed: ${resp.code()}")
            return false
        }

        val json = resp.body()?.string() ?: return false
        val etag = resp.headers()["ETag"] ?: ""

        dao.upsertOverlay(
            MapOverlayEntity(
                name = name,
                version = version,
                etag = etag,
                dataJson = json
            )
        )
        return true
    }

    private fun purgeOldTileFiles(keepVersion: Int) {
        val dir = tilesDir()
        dir.listFiles()?.forEach { vDir ->
            if (vDir.isDirectory && vDir.name.startsWith("v")) {
                val ver = vDir.name.removePrefix("v").toIntOrNull() ?: 0
                if (ver < keepVersion) {
                    vDir.deleteRecursively()
                    Timber.d("MapSync: purged old tile dir ${vDir.name}")
                }
            }
        }
    }

    // ── DTOs for manifest JSON parsing ──────────────────────

    private data class ManifestDto(
        val version: Int,
        val tileSize: Int,
        val generatedAt: String,
        val zoomLevels: List<ZoomLevelDto> = emptyList(),
        val overlays: List<String>? = null
    )

    private data class ZoomLevelDto(
        val z: Int,
        val gridSize: Int,
        val tileCount: Int,
        val tiles: List<TileInfoDto>? = null
    )

    private data class TileInfoDto(
        val path: String,
        val hash: String
    )
}
