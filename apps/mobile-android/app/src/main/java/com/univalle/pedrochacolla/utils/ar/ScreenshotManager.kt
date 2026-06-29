package com.univalle.pedrochacolla.utils.ar

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.provider.MediaStore
import android.view.PixelCopy
import android.view.View
import android.widget.Toast
import com.univalle.pedrochacolla.utils.window.BannerUtil
import io.github.sceneview.ar.ARSceneView

/**
 * ScreenshotManager - Captures and saves ARSceneView screenshots
 *
 * Responsibilities:
 * - Capture current AR scene view as bitmap
 * - Save bitmap to device gallery
 * - Handle MediaStore operations
 * - Camera flash effect on capture
 */
class ScreenshotManager(
    private val sceneView: ARSceneView,
    private val context: Context
) {

    /** Optional flash overlay view — set this to enable camera flash effect */
    var flashOverlay: View? = null

    /**
     * Capture current AR scene and save to gallery
     *
     * @param onSuccess Callback invoked when screenshot is saved successfully
     * @param onError Callback invoked when screenshot fails
     */
    fun captureAndSave(
        onSuccess: ((filename: String) -> Unit)? = null,
        onError: ((errorMessage: String) -> Unit)? = null
    ) {
        // Create bitmap with scene dimensions
        val bitmap = Bitmap.createBitmap(
            sceneView.width,
            sceneView.height,
            Bitmap.Config.ARGB_8888
        )

        // Create handler thread for PixelCopy
        val handlerThread = HandlerThread("PixelCopyHelper")
        handlerThread.start()
        val handler = Handler(handlerThread.looper)

        // Request pixel copy from ARSceneView
        PixelCopy.request(sceneView, bitmap, { copyResult ->
            // Use main looper handler to guarantee UI thread execution
            // (context may be a ContextWrapper, not directly an Activity)
            Handler(Looper.getMainLooper()).post {
                if (copyResult == PixelCopy.SUCCESS) {
                    // Trigger camera flash effect
                    playFlashEffect()
                    saveToGallery(bitmap, onSuccess, onError)
                } else {
                    val errorMsg = "Error al capturar imagen: $copyResult"
                    Toast.makeText(context, errorMsg, Toast.LENGTH_LONG).show()
                    onError?.invoke(errorMsg)
                }
            }
            handlerThread.quitSafely()
        }, handler)
    }

    /**
     * Play a camera-like flash effect: white overlay fades in quickly then fades out.
     */
    private fun playFlashEffect() {
        val overlay = flashOverlay ?: return
        overlay.visibility = View.VISIBLE
        overlay.alpha = 0f

        // Flash in: 0 → 0.85 in 80ms, then fade out: 0.85 → 0 in 250ms
        overlay.animate()
            .alpha(0.85f)
            .setDuration(80)
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    overlay.animate()
                        .alpha(0f)
                        .setDuration(250)
                        .setListener(object : AnimatorListenerAdapter() {
                            override fun onAnimationEnd(animation: Animator) {
                                overlay.visibility = View.GONE
                            }
                        })
                        .start()
                }
            })
            .start()
    }

    /**
     * Save bitmap to device gallery using MediaStore
     */
    private fun saveToGallery(
        bitmap: Bitmap,
        onSuccess: ((filename: String) -> Unit)?,
        onError: ((errorMessage: String) -> Unit)?
    ) {
        val filename = "AR_Capture_${System.currentTimeMillis()}.png"
        val contentValues = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/ARCaptures")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }

        val resolver = context.contentResolver
        val imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)

        if (imageUri != null) {
            try {
                resolver.openOutputStream(imageUri).use { outStream ->
                    if (outStream == null) throw java.io.IOException("No se pudo abrir el stream de escritura")
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
                }

                // Mark as no longer pending
                contentValues.clear()
                contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(imageUri, contentValues, null, null)

                // Show success message
                val activity = when (context) {
                    is android.app.Activity -> context
                    is android.content.ContextWrapper -> (context as android.content.ContextWrapper).baseContext as? android.app.Activity
                    else -> null
                }
                activity?.let {
                    BannerUtil.showBanner(it, "📸 Foto guardada en la galería")
                }
                onSuccess?.invoke(filename)
            } catch (e: Exception) {
                val errorMsg = "Error al guardar imagen: ${e.message}"
                Toast.makeText(context, errorMsg, Toast.LENGTH_LONG).show()
                onError?.invoke(errorMsg)
            }
        } else {
            val errorMsg = "No se pudo acceder a la galería"
            Toast.makeText(context, errorMsg, Toast.LENGTH_LONG).show()
            onError?.invoke(errorMsg)
        }
    }
}
