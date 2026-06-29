package com.univalle.pedrochacolla.ui.dashboard

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import com.caverock.androidsvg.SVG
import com.univalle.pedrochacolla.data.model.StickerDefinition
import com.univalle.pedrochacolla.data.model.StickerInstance
import com.univalle.pedrochacolla.data.model.StickerLayer
import com.univalle.pedrochacolla.data.model.StickerLayerData
import com.univalle.pedrochacolla.data.model.STICKER_CATALOG
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber

/**
 * States for the sticker editing system.
 * Controls what actions are allowed at any given time.
 */
enum class StickerEditState {
    /** Stickers are visible but no editing is possible (non-admin or edit mode off) */
    VIEWING,
    /** Edit mode is on but no sticker type is selected for placement and no instance is selected */
    IDLE,
    /** A sticker type is selected from the catalog — tapping the map places a new sticker */
    PLACING,
    /** An existing sticker instance is selected — properties panel visible, can drag/scale/delete */
    SELECTED,
    /** Actively dragging or scaling a sticker via touch (transient) */
    DRAGGING
}

/**
 * Manages a SINGLE sticker layer, persistence (SharedPreferences), and bitmap caching.
 * Uses a state machine ([StickerEditState]) to control valid transitions and avoid errors.
 * Admins can edit; regular users only view.
 */
class StickerManager(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "pcymt_sticker_prefs"
        private const val KEY_LAYERS = "pcymt_sticker_layers_v1"
        // 512px ensures SVG stickers remain crisp at full zoom without upscaling artefacts
        private const val STICKER_BITMAP_SIZE = 512 // px for sticker bitmaps
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** In-memory layer state — always exactly one layer */
    private val _layers = mutableListOf<StickerLayer>()
    val layers: List<StickerLayer> get() = _layers

    /** Currently active layer id (always the single layer) */
    var activeLayerId: String? = null
        private set

    // ══════════════════════════════════════════════════════════
    // STATE MACHINE
    // ══════════════════════════════════════════════════════════

    /** Current editing state — drives what actions are allowed */
    var state: StickerEditState = StickerEditState.VIEWING
        private set

    /** Edit mode convenience — true when state is not VIEWING */
    val editMode: Boolean get() = state != StickerEditState.VIEWING

    /** Currently selected sticker key for placement (only valid in PLACING state) */
    var selectedStickerKey: String? = null
        private set

    /** Currently selected sticker instance for editing (only valid in SELECTED/DRAGGING states) */
    var selectedInstanceId: String? = null
        private set

    /**
     * Transition to a new state. Resets transient fields as needed.
     * Invalid transitions are silently ignored (logged).
     */
    fun transitionTo(newState: StickerEditState) {
        val oldState = state
        when (newState) {
            StickerEditState.VIEWING -> {
                // Always allowed — clears everything
                selectedStickerKey = null
                selectedInstanceId = null
            }
            StickerEditState.IDLE -> {
                // Allowed from VIEWING, PLACING, SELECTED, DRAGGING
                selectedStickerKey = null
                selectedInstanceId = null
            }
            StickerEditState.PLACING -> {
                // Requires a stickerKey to be set before calling this
                selectedInstanceId = null
            }
            StickerEditState.SELECTED -> {
                // Requires selectedInstanceId to be set before calling this
            }
            StickerEditState.DRAGGING -> {
                // Only from SELECTED
                if (oldState != StickerEditState.SELECTED) return
            }
        }
        state = newState
        notifyChange()
    }

    /** Enter edit mode (VIEWING → IDLE) */
    fun enterEditMode() {
        if (state == StickerEditState.VIEWING) {
            transitionTo(StickerEditState.IDLE)
        }
    }

    /** Exit edit mode (any → VIEWING) */
    fun exitEditMode() {
        transitionTo(StickerEditState.VIEWING)
    }

    /** Select a sticker type from the catalog for placement */
    fun selectStickerForPlacement(stickerKey: String) {
        if (state == StickerEditState.VIEWING) return
        selectedStickerKey = stickerKey
        selectedInstanceId = null
        transitionTo(StickerEditState.PLACING)
    }

    /** Select an existing sticker instance for editing */
    fun selectInstance(instanceId: String) {
        if (state == StickerEditState.VIEWING) return
        selectedInstanceId = instanceId
        state = StickerEditState.SELECTED
        notifyChange()
    }

    /** Begin a drag/scale gesture */
    fun beginDrag() {
        if (state == StickerEditState.SELECTED) {
            state = StickerEditState.DRAGGING
        }
    }

    /** End a drag/scale gesture */
    fun endDrag() {
        if (state == StickerEditState.DRAGGING) {
            state = StickerEditState.SELECTED
            saveToPrefs()
            notifyChange()
        }
    }

    /** Deselect current instance → go back to IDLE or PLACING */
    fun deselectInstance() {
        selectedInstanceId = null
        if (selectedStickerKey != null) {
            state = StickerEditState.PLACING
        } else {
            state = StickerEditState.IDLE
        }
        notifyChange()
    }

    /** Bitmap cache: stickerKey → Bitmap */
    private val bitmapCache = mutableMapOf<String, Bitmap>()

    /** Catalog lookup map */
    private val catalogMap: Map<String, StickerDefinition> =
        STICKER_CATALOG.associateBy { it.key }
    /** Normalized-key lookup map (handles path/extension variants from server payloads). */
    private val normalizedCatalogMap: Map<String, StickerDefinition> =
        STICKER_CATALOG.associateBy { normalizeStickerKey(it.key) }

    /** Listener for changes */
    var onChangeListener: (() -> Unit)? = null

    init {
        // Stickers are owned by the web admin and loaded fresh from the server
        // on each session — clear any stale locally-persisted data and start empty.
        prefs.edit().remove(KEY_LAYERS).apply()
        ensureSingleLayer()
    }

    /**
     * Normalize incoming sticker keys from API/frontend.
     * Examples:
     * - "tree-1" -> "tree-1"
     * - "map-stickers/tree-1.svg" -> "tree-1"
     * - "assets/map-stickers/001.svg" -> "001"
     */
    private fun normalizeStickerKey(rawKey: String): String {
        val lower = rawKey.trim().lowercase()
        val noQuery = lower.substringBefore('?').substringBefore('#')
        val base = noQuery.substringAfterLast('/').substringAfterLast('\\')
        return base.substringBeforeLast('.')
    }

    /** Resolve any raw key variant to a canonical catalog key, or null if unknown. */
    private fun resolveCatalogKey(rawKey: String): String? {
        catalogMap[rawKey]?.let { return it.key }
        val normalized = normalizeStickerKey(rawKey)
        return normalizedCatalogMap[normalized]?.key
    }

    /** Ensure exactly one (empty) layer exists as the initial container */
    private fun ensureSingleLayer() {
        if (_layers.isEmpty()) {
            val layer = StickerLayer(
                id = generateId(),
                name = "Stickers",
                visible = true
            )
            _layers.add(layer)
            activeLayerId = layer.id
            // Do NOT save to prefs — layer is empty and will be populated from server
        } else {
            activeLayerId = _layers[0].id
        }
    }

    fun getActiveLayer(): StickerLayer? = _layers.firstOrNull()

    /** Update layer opacity (affects all stickers in the layer) */
    fun updateLayerOpacity(layerId: String, opacity: Float) {
        val idx = _layers.indexOfFirst { it.id == layerId }
        if (idx >= 0) {
            _layers[idx] = _layers[idx].copy(opacity = opacity.coerceIn(0f, 1f))
            saveToPrefs()
            notifyChange()
        }
    }

    /** Clear all stickers from the single layer */
    fun clearAllStickers() {
        _layers.firstOrNull()?.stickers?.clear()
        selectedInstanceId = null
        if (state == StickerEditState.SELECTED || state == StickerEditState.DRAGGING) {
            state = if (selectedStickerKey != null) StickerEditState.PLACING else StickerEditState.IDLE
        }
        saveToPrefs()
        notifyChange()
    }

    // === Load from server config data ===

    /** Replace all layers with data from a map configuration (API response) */
    fun loadFromConfigData(layerDataList: List<StickerLayerData>) {
        _layers.clear()
        // Reset selection since all instances are being replaced
        selectedInstanceId = null
        if (state == StickerEditState.SELECTED || state == StickerEditState.DRAGGING) {
            state = if (selectedStickerKey != null) StickerEditState.PLACING else StickerEditState.IDLE
        }
        Timber.d("loadFromConfigData: received %d layer(s)", layerDataList.size)
        // Merge all config layers into a single layer
        val allStickers = mutableListOf<StickerInstance>()
        var layerOpacity = 1.0f
        for (ld in layerDataList) {
            if (ld.opacity != null) layerOpacity = ld.opacity.toFloat()
            Timber.d("  layer: id=%s, stickers=%d, opacity=%s", ld.id, ld.stickers?.size ?: 0, ld.opacity)
            val stickers = (ld.stickers ?: emptyList()).mapNotNull { s ->
                val rawKey = s.stickerKey ?: return@mapNotNull null
                val key = resolveCatalogKey(rawKey)
                if (key == null) {
                    Timber.w("loadFromConfigData: skipping unknown sticker key=%s", rawKey)
                    return@mapNotNull null
                }
                val resolvedScale = s.scale?.toFloat() ?: 1.0f
                Timber.d("    sticker: key=%s, rawScale=%s, resolvedScale=%.2f, lat=%s, lng=%s",
                    key, s.scale, resolvedScale, s.lat, s.lng)
                StickerInstance(
                    id = s.id ?: generateId(),
                    stickerKey = key,
                    lat = s.lat ?: 0.0,
                    lng = s.lng ?: 0.0,
                    scale = resolvedScale,
                    rotation = s.rotation?.toFloat() ?: 0f,
                    opacity = s.opacity?.toFloat() ?: 1.0f
                )
            }
            allStickers.addAll(stickers)
        }
        Timber.d("loadFromConfigData: total stickers loaded = %d", allStickers.size)
        _layers.add(
            StickerLayer(
                id = generateId(),
                name = "Stickers",
                visible = true,
                opacity = layerOpacity,
                stickers = allStickers
            )
        )
        activeLayerId = _layers.firstOrNull()?.id
        // Do NOT save server data to prefs — stickers are always re-fetched from the API.
        notifyChange()
    }

    // === Sticker Instance CRUD ===

    fun addSticker(stickerKey: String, lat: Double, lng: Double): StickerInstance? {
        if (state != StickerEditState.PLACING) return null
        val layer = getActiveLayer() ?: return null
        val canonicalKey = resolveCatalogKey(stickerKey) ?: return null
        val instance = StickerInstance(
            id = generateId(),
            stickerKey = canonicalKey,
            lat = lat,
            lng = lng,
            scale = 1.0f,
            rotation = 0f,
            opacity = 1.0f
        )
        layer.stickers.add(instance)
        selectedInstanceId = instance.id
        saveToPrefs()
        notifyChange()
        return instance
    }

    fun removeSticker(instanceId: String) {
        for (layer in _layers) {
            if (layer.stickers.removeAll { it.id == instanceId }) {
                if (selectedInstanceId == instanceId) {
                    selectedInstanceId = null
                    // Return to IDLE or PLACING depending on whether a catalog key is selected
                    if (selectedStickerKey != null) {
                        state = StickerEditState.PLACING
                    } else {
                        state = StickerEditState.IDLE
                    }
                }
                saveToPrefs()
                notifyChange()
                return
            }
        }
    }

    /**
     * Update a sticker's properties.
     * @param skipPersist When true, skips saving to SharedPreferences and notifying observers.
     *                    Use this during continuous touch events (drag/scale) to avoid ANR.
     *                    Call [saveNow] when the gesture ends.
     */
    fun updateSticker(instanceId: String, scale: Float? = null, rotation: Float? = null, opacity: Float? = null, lat: Double? = null, lng: Double? = null, skipPersist: Boolean = false) {
        for (layer in _layers) {
            val idx = layer.stickers.indexOfFirst { it.id == instanceId }
            if (idx >= 0) {
                val old = layer.stickers[idx]
                layer.stickers[idx] = old.copy(
                    scale = scale ?: old.scale,
                    rotation = rotation ?: old.rotation,
                    opacity = opacity ?: old.opacity,
                    lat = lat ?: old.lat,
                    lng = lng ?: old.lng
                )
                if (!skipPersist) {
                    saveToPrefs()
                    notifyChange()
                }
                return
            }
        }
    }

    /** Persist current sticker state immediately. Call after a drag/scale gesture ends. */
    fun saveNow() {
        saveToPrefs()
        notifyChange()
    }

    fun getSticker(instanceId: String): StickerInstance? {
        for (layer in _layers) {
            layer.stickers.find { it.id == instanceId }?.let { return it }
        }
        return null
    }

    /** Get all visible stickers across all visible layers */
    fun getVisibleStickers(): List<StickerInstance> {
        return _layers.filter { it.visible }
            .flatMap { it.stickers }
    }

    /** Get all visible layers (for rendering with per-layer opacity) */
    fun getVisibleLayers(): List<StickerLayer> {
        return _layers.filter { it.visible }
    }

    // === Bitmap Cache ===

    fun getStickerBitmap(stickerKey: String): Bitmap? {
        val canonicalKey = resolveCatalogKey(stickerKey) ?: return null
        bitmapCache[canonicalKey]?.let { return it }
        val def = catalogMap[canonicalKey] ?: return null
        return try {
            val bitmap: Bitmap? = if (def.imagePath.endsWith(".svg", ignoreCase = true)) {
                decodeSvgAsset(def.imagePath)
            } else {
                val inputStream = context.assets.open(def.imagePath)
                val opts = BitmapFactory.Options().apply { inSampleSize = 1 }
                val bmp = BitmapFactory.decodeStream(inputStream, null, opts)
                inputStream.close()
                bmp
            }
            bitmap?.let {
                // Scale to standard size preserving aspect ratio
                val maxDim = maxOf(it.width, it.height)
                val scaleFactor = STICKER_BITMAP_SIZE.toFloat() / maxDim
                val scaled = Bitmap.createScaledBitmap(
                    it,
                    (it.width * scaleFactor).toInt().coerceAtLeast(1),
                    (it.height * scaleFactor).toInt().coerceAtLeast(1),
                    true
                )
                if (scaled !== it) it.recycle()
                bitmapCache[canonicalKey] = scaled
                scaled
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Render an SVG asset to a Bitmap at [STICKER_BITMAP_SIZE] px on the longest side.
     * Uses the androidsvg library which handles the XML vector format correctly.
     */
    private fun decodeSvgAsset(assetPath: String): Bitmap? {
        return try {
            val inputStream = context.assets.open(assetPath)
            val svg = SVG.getFromInputStream(inputStream)
            inputStream.close()

            // Use the SVG's own document dimensions if available, otherwise fall back to 200x200
            val svgWidth = svg.documentWidth.takeIf { it > 0 } ?: 200f
            val svgHeight = svg.documentHeight.takeIf { it > 0 } ?: 200f

            // Scale so the longest side equals STICKER_BITMAP_SIZE
            val scale = STICKER_BITMAP_SIZE.toFloat() / maxOf(svgWidth, svgHeight)
            val bmpWidth = (svgWidth * scale).toInt().coerceAtLeast(1)
            val bmpHeight = (svgHeight * scale).toInt().coerceAtLeast(1)

            val bitmap = Bitmap.createBitmap(bmpWidth, bmpHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            // Render SVG into the target bitmap size (avoids clipping when document
            // dimensions are larger than the scaled bitmap)
            svg.setDocumentWidth(bmpWidth.toFloat())
            svg.setDocumentHeight(bmpHeight.toFloat())
            svg.renderToCanvas(canvas)
            bitmap
        } catch (e: Exception) {
            null
        }
    }

    /** Get thumbnail bitmap (smaller, for palette) */
    fun getThumbnailBitmap(stickerKey: String): Bitmap? {
        // Reuse main cache — 128px is fine for thumbnails
        return getStickerBitmap(stickerKey)
    }

    fun clearBitmapCache() {
        bitmapCache.values.forEach { it.recycle() }
        bitmapCache.clear()
    }

    // === Persistence ===

    private fun saveToPrefs() {
        val jsonArray = JSONArray()
        for (layer in _layers) {
            val layerObj = JSONObject().apply {
                put("id", layer.id)
                put("name", layer.name)
                put("visible", layer.visible)
                put("opacity", layer.opacity.toDouble())
                val stickersArr = JSONArray()
                for (s in layer.stickers) {
                    stickersArr.put(JSONObject().apply {
                        put("id", s.id)
                        put("stickerKey", s.stickerKey)
                        put("lat", s.lat)
                        put("lng", s.lng)
                        put("scale", s.scale.toDouble())
                        put("rotation", s.rotation.toDouble())
                        put("opacity", s.opacity.toDouble())
                    })
                }
                put("stickers", stickersArr)
            }
            jsonArray.put(layerObj)
        }
        prefs.edit().putString(KEY_LAYERS, jsonArray.toString()).apply()
    }

    private fun loadFromPrefs() {
        val json = prefs.getString(KEY_LAYERS, null) ?: return
        try {
            val arr = JSONArray(json)
            _layers.clear()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val stickersArr = obj.getJSONArray("stickers")
                val stickers = mutableListOf<StickerInstance>()
                for (j in 0 until stickersArr.length()) {
                    val s = stickersArr.getJSONObject(j)
                    stickers.add(
                        StickerInstance(
                            id = s.getString("id"),
                            stickerKey = s.getString("stickerKey"),
                            lat = s.getDouble("lat"),
                            lng = s.getDouble("lng"),
                            scale = s.getDouble("scale").toFloat(),
                            rotation = s.getDouble("rotation").toFloat(),
                            opacity = s.getDouble("opacity").toFloat()
                        )
                    )
                }
                _layers.add(
                    StickerLayer(
                        id = obj.getString("id"),
                        name = obj.getString("name"),
                        visible = obj.getBoolean("visible"),
                        opacity = obj.optDouble("opacity", 1.0).toFloat(),
                        stickers = stickers
                    )
                )
            }
            activeLayerId = _layers.firstOrNull()?.id
        } catch (e: Exception) {
            // Corrupted data, start fresh
            _layers.clear()
        }
    }

    private fun generateId(): String {
        return System.currentTimeMillis().toString(36) +
                (Math.random() * 1000000).toLong().toString(36)
    }

    private fun notifyChange() {
        onChangeListener?.invoke()
    }

    // === Config export / import helpers ===

    /** Ensure a sticker bitmap is loaded into cache (call from main thread) */
    fun ensureBitmapLoaded(stickerKey: String) {
        getStickerBitmap(stickerKey)
    }

    /** Export current layers to StickerLayerData list for saving in MapConfigData */
    fun toConfigData(): List<StickerLayerData>? {
        if (_layers.isEmpty()) return null
        return _layers.map { layer ->
            StickerLayerData(
                id = layer.id,
                name = layer.name,
                visible = layer.visible,
                opacity = layer.opacity.toDouble(),
                stickers = layer.stickers.map { s ->
                    com.univalle.pedrochacolla.data.model.StickerInstanceData(
                        id = s.id,
                        stickerKey = s.stickerKey,
                        lat = s.lat,
                        lng = s.lng,
                        scale = s.scale.toDouble(),
                        rotation = s.rotation.toDouble(),
                        opacity = s.opacity.toDouble()
                    )
                }
            )
        }
    }
}
