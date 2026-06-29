package com.univalle.pedrochacolla.utils.ar

import android.content.Context
import timber.log.Timber

/**
 * ModelResolver — Resolves 3D model (.glb) paths to local assets when available,
 * falling back to network download from the backend API.
 *
 * Bundled models live in `assets/models/` and are loaded synchronously by SceneView's
 * `modelLoader.loadModelInstance()`. Remote models require an authenticated HTTP download
 * via `ApiClient` → `ByteBuffer` → `modelLoader.createModelInstance()`.
 *
 * The resolver extracts the filename from the server `model_url` (e.g., "/api/files/bear.glb")
 * and checks whether `models/<filename>` exists in the APK's assets. This allows:
 * - Shipping common models in the APK for instant, offline loading
 * - Keeping rarely-used or very large models server-only
 * - Backend still controls which model is assigned to each anchor point
 *
 * Usage:
 * ```
 * val resolution = ModelResolver.resolve(context, asset.modelUrl)
 * when (resolution) {
 *     is ModelResolution.Local  -> modelLoader.loadModelInstance(resolution.assetPath)
 *     is ModelResolution.Remote -> downloadAndCreateModelInstance(resolution.url)
 * }
 * ```
 */
object ModelResolver {

    private const val ASSETS_MODEL_DIR = "models"

    /**
     * Resolve a model URL to either a local asset path or a full remote URL.
     *
     * @param context Android context for accessing assets
     * @param modelUrl Server-relative model URL, e.g. "/api/files/bear.glb" or "models/cube.glb"
     * @return [ModelResolution.Local] with asset path, or [ModelResolution.Remote] with full URL
     */
    fun resolve(context: Context, modelUrl: String?): ModelResolution {
        if (modelUrl.isNullOrBlank()) {
            Timber.d("ModelResolver: null/blank modelUrl — using default cube")
            return ModelResolution.Local("$ASSETS_MODEL_DIR/cube.glb")
        }

        // Already a local asset path (e.g. "models/cube.glb")
        if (!modelUrl.startsWith("http") && !modelUrl.startsWith("/")) {
            Timber.d("ModelResolver: already local path — $modelUrl")
            return ModelResolution.Local(modelUrl)
        }

        // Extract filename from URL path
        val filename = extractFilename(modelUrl)
        if (filename != null) {
            val localPath = "$ASSETS_MODEL_DIR/$filename"
            if (assetExists(context, localPath)) {
                Timber.i("ModelResolver: LOCAL HIT — $localPath (from $modelUrl)")
                return ModelResolution.Local(localPath)
            }
        }

        // Fall back to remote download
        Timber.d("ModelResolver: REMOTE — $modelUrl (not found in local assets)")
        return ModelResolution.Remote(modelUrl)
    }

    /**
     * Extract the filename from a model URL path segment.
     * Examples:
     * - "/api/files/bear.glb" → "bear.glb"
     * - "http://host:5000/api/files/bear.glb" → "bear.glb"
     * - "/uploads/bear.glb" → "bear.glb"
     */
    private fun extractFilename(url: String): String? {
        val path = url.substringBefore("?") // Remove query params
        val lastSlash = path.lastIndexOf('/')
        val filename = if (lastSlash >= 0) path.substring(lastSlash + 1) else path
        return filename.takeIf { it.endsWith(".glb", ignoreCase = true) || it.endsWith(".gltf", ignoreCase = true) }
    }

    /**
     * Check if an asset file exists in the APK's assets directory.
     */
    private fun assetExists(context: Context, path: String): Boolean {
        return try {
            context.assets.open(path).use { true }
        } catch (_: Exception) {
            false
        }
    }

    /**
     * List all bundled model filenames in assets/models/ (for debugging).
     */
    fun listBundledModels(context: Context): List<String> {
        return try {
            context.assets.list(ASSETS_MODEL_DIR)?.toList() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }
}

/**
 * Result of model resolution — either a local asset path or a remote URL.
 */
sealed class ModelResolution {
    /** Model found in APK assets — load with `modelLoader.loadModelInstance(assetPath)` */
    data class Local(val assetPath: String) : ModelResolution()

    /** Model not bundled — download from `url` via authenticated HTTP */
    data class Remote(val url: String) : ModelResolution()
}
