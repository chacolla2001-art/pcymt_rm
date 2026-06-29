package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.*
import com.univalle.pedrochacolla.data.model.StickerInstance
import com.univalle.pedrochacolla.data.model.StickerLayer
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Renders sticker instances on ParkMapView canvas.
 * Similar to PoiOverlayManager but for user-placed stickers.
 *
 * v2 additions:
 *  - Corner scale handles on selected sticker (4 circles at bbox corners)
 *  - Rotation handle (stem + filled circle above selected sticker)
 *  - Rotation-aware hit-testing for both handle types
 */
class StickerOverlayManager(private val stickerManager: StickerManager) {
    companion object {
        // Matches: tree, tree-1, tree_2, tree-6, tree12
        private val TREE_STICKER_KEY_REGEX = Regex("^tree([-_]\\d+)?$")
    }
    /** Paint for sticker bitmaps (with alpha support) */
    private val stickerPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    /** Paint for selection highlight */
    private val selectionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0xFF2196F3.toInt() // Material Blue
        strokeWidth = 3f
        pathEffect = DashPathEffect(floatArrayOf(8f, 4f), 0f)
    }

    /** Corner handle fill (solid blue circle) */
    private val cornerHandleFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xFF2196F3.toInt()
    }

    /** Corner handle border (white ring) */
    private val cornerHandleStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.WHITE
        strokeWidth = 2.5f
    }

    /** Rotation handle stem (purple line) */
    private val rotateStemPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0xFF9C27B0.toInt()
        strokeWidth = 2.5f
        strokeCap = Paint.Cap.ROUND
    }

    /** Rotation handle circle fill (purple) */
    private val rotateHandleFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xFF9C27B0.toInt()
    }

    /** Rotation handle border (white ring) */
    private val rotateHandleStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.WHITE
        strokeWidth = 2.5f
    }

    /** Sticker label background (semi-transparent) */
    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.BLACK
    }

    /** Sticker label text paint */
    private val labelTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }

    // Label lookup by sticker code (normalized key, without extension)
    private val stickerLabelMap = mapOf(
        "001" to "Aguas Danzantes",
        "002" to "Anfiteatro",
        "003" to "",
        "004" to "Baños",
        "005" to "Chiwiña",
        "006" to "",
        "007" to "Escenario Principal",
        "008" to "Aguas Danzantes",
        "009" to "",
        "010" to "Aguas Danzantes",
        "011" to "Teatro Galpón",
        "012" to "",
        "013" to "",
        "014" to "",
        "015" to "",
        "016" to "",
        "017" to "",
        "018" to "",
        "019" to "",
        "020" to "Enfermería",
        "021" to "Mirador",
        "022" to "Boletería",
        "023" to "",
        "024" to "",
        "025" to "",
        "026" to "",
        "027" to "Puerta del sol",
        "028" to "",
        "029" to "",
        "030" to "",
        "031" to "",
        
    )

    private fun getStickerLabel(stickerKey: String): String? {
        val key = normalizedStickerKey(stickerKey)
        return stickerLabelMap[key]
    }

    /**
     * Base sticker size in screen pixels at map scale=1.0 (before sticker.scale is applied).
     * Formula: finalWidth = sticker.scale * baseStickerSize * zoomFactor
     *   where zoomFactor = mapScale / 2
     *
     * Web equivalent: size = STICKER_BASE_SIZE(40) * sticker.scale * mapZoom
     * Setting baseStickerSize=80 makes both identical:
     *   mobile: sticker.scale * 80 * (mapScale/2) = sticker.scale * 40 * mapScale  ✓
     */
    private val baseStickerSize = 80f

    // ── Handle size constants (screen pixels) ──────────────────────────
    private val CORNER_HANDLE_RADIUS  = 10f   // drawn radius
    private val CORNER_TOUCH_RADIUS   = 20f   // hit-test radius
    private val ROTATE_HANDLE_PAD     = 4f    // same as selection pad
    private val ROTATE_HANDLE_STEM    = 24f   // length of stem above bbox top
    private val ROTATE_HANDLE_RADIUS  = 9f    // drawn radius
    private val ROTATE_TOUCH_RADIUS   = 18f   // hit-test radius

    // ───────────────────────────────────────────────────────────────────

    /**
     * Compute the screen-space half-width and half-height of a sticker's bounding box.
     * Returns null if the sticker's bitmap is not cached.
     */
    fun getStickerHalfSize(sticker: StickerInstance, mapScale: Float): Pair<Float, Float>? {
        val bitmap = stickerManager.getStickerBitmap(sticker.stickerKey) ?: return null
        val displayScale = sticker.scale * (baseStickerSize / bitmap.width)
        val zoomFactor   = (mapScale / 2f).coerceIn(0.5f, 3f)
        val finalScale   = displayScale * zoomFactor
        return Pair(bitmap.width * finalScale / 2f, bitmap.height * finalScale / 2f)
    }

    /**
     * Draw all visible stickers on the canvas.
     * Called from ParkMapView.onDraw AFTER canvas.restore() (screen-space).
     */
    fun drawOverlay(
        canvas: Canvas,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        mapScale: Float,
        mapRotationRadians: Float = 0f
    ) {
        val layers     = stickerManager.getVisibleLayers()
        val selectedId = stickerManager.selectedInstanceId
        val mapRotationDegrees = Math.toDegrees(mapRotationRadians.toDouble()).toFloat()

        for (layer in layers) {
            for (sticker in layer.stickers) {
                drawSticker(canvas, sticker, geoToScreen, mapScale,
                    mapRotationDegrees, sticker.id == selectedId, layer.opacity)
            }
        }
    }

    /** Normalize sticker key/path to lowercase basename without extension. */
    private fun normalizedStickerKey(rawKey: String): String {
        val lower = rawKey.trim().lowercase()
        val noQuery = lower.substringBefore('?').substringBefore('#')
        val base = noQuery.substringAfterLast('/').substringAfterLast('\\')
        return base.substringBeforeLast('.')
    }

    /**
     * Non-tree stickers rotate with map (+ optional per-sticker rotation).
     * Tree stickers remain screen-upright.
     */
    private fun effectiveRotation(sticker: StickerInstance, mapRotationDegrees: Float): Float {
        val normalized = normalizedStickerKey(sticker.stickerKey)
        val isTreeSticker = TREE_STICKER_KEY_REGEX.matches(normalized)
        return if (isTreeSticker) 0f else mapRotationDegrees + sticker.rotation
    }

    private fun drawSticker(
        canvas: Canvas,
        sticker: StickerInstance,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        mapScale: Float,
        mapRotationDegrees: Float,
        isSelected: Boolean,
        layerOpacity: Float = 1.0f
    ) {
        val bitmap = stickerManager.getStickerBitmap(sticker.stickerKey) ?: return
        val (screenX, screenY) = geoToScreen(sticker.lat, sticker.lng)

        val displayScale = sticker.scale * (baseStickerSize / bitmap.width)
        val zoomFactor   = (mapScale / 2f).coerceIn(0.5f, 3f)
        val finalScale   = displayScale * zoomFactor

        val halfW = bitmap.width  * finalScale / 2f
        val halfH = bitmap.height * finalScale / 2f

        // Only non-tree stickers rotate with map + per-sticker rotation.
        val drawRotation = effectiveRotation(sticker, mapRotationDegrees)

        // ── Draw sticker (rotated in sticker-canvas space) ──────────────
        canvas.save()
        canvas.translate(screenX, screenY)
        canvas.rotate(drawRotation)

        // Combine layer opacity with per-sticker opacity
        stickerPaint.alpha = (layerOpacity * sticker.opacity * 255).toInt().coerceIn(0, 255)
        val dstRect = RectF(-halfW, -halfH, halfW, halfH)
        canvas.drawBitmap(bitmap, null, dstRect, stickerPaint)

        if (isSelected && stickerManager.editMode) {
            val pad = ROTATE_HANDLE_PAD
            val selRect = RectF(dstRect.left - pad, dstRect.top - pad,
                                dstRect.right + pad, dstRect.bottom + pad)
            canvas.drawRoundRect(selRect, 6f, 6f, selectionPaint)

            // ── Corner handles (drawn in sticker-local rotated space) ──
            val ph = halfW + pad
            val pv = halfH + pad
            val corners = listOf(
                Pair(-ph, -pv), Pair(ph, -pv),
                Pair(ph,  pv), Pair(-ph,  pv)
            )
            for ((cx, cy) in corners) {
                canvas.drawCircle(cx, cy, CORNER_HANDLE_RADIUS, cornerHandleFillPaint)
                canvas.drawCircle(cx, cy, CORNER_HANDLE_RADIUS, cornerHandleStrokePaint)
            }
        }

        canvas.restore()

        // ── Label (screen-space, not rotated) ─────────────────────────
        val isTreeSticker = TREE_STICKER_KEY_REGEX.matches(normalizedStickerKey(sticker.stickerKey))
        if (isTreeSticker) return
        val labelText = getStickerLabel(sticker.stickerKey) ?: "Lorem ipsum"
        val zoomFactorLabel = (mapScale / 2f).coerceIn(0.5f, 3f)
        val textSize = (11f * zoomFactorLabel).coerceIn(10f, 18f)
        labelTextPaint.textSize = textSize

        val textWidth = labelTextPaint.measureText(labelText)
        val fm = labelTextPaint.fontMetrics
        val textHeight = fm.descent - fm.ascent
        val paddingX = 6f
        val paddingY = 4f
        val labelTop = screenY + halfH + 8f
        val labelRect = RectF(
            screenX - textWidth / 2f - paddingX,
            labelTop,
            screenX + textWidth / 2f + paddingX,
            labelTop + textHeight + paddingY * 2f
        )

        val opacity = (layerOpacity * sticker.opacity).coerceIn(0f, 1f)
        labelBgPaint.alpha = (160 * opacity).toInt().coerceIn(0, 255)
        labelTextPaint.alpha = (255 * opacity).toInt().coerceIn(0, 255)

        canvas.drawRoundRect(labelRect, 6f, 6f, labelBgPaint)
        val textY = labelRect.top + paddingY - fm.ascent
        canvas.drawText(labelText, screenX, textY, labelTextPaint)

        // ── Rotation handle (drawn in screen space, projected by drawRotation) ──
        if (isSelected && stickerManager.editMode) {
            val pad       = ROTATE_HANDLE_PAD
            val padHh     = halfH + pad
            // Sticker-local Y coordinates (upward = negative Y in screen)
            val stemBaseY  = -(padHh)
            val stemTipY   = -(padHh + ROTATE_HANDLE_STEM)
            val circleY    = -(padHh + ROTATE_HANDLE_STEM + ROTATE_HANDLE_RADIUS)

            // Rotate local (0, Y) by drawRotation into screen offsets:
            //   rotated = ( -Y * sin(r),  Y * cos(r) )   [x=0 drops out]
            val rotRad = Math.toRadians(drawRotation.toDouble())
            val cosR   = cos(rotRad).toFloat()
            val sinR   = sin(rotRad).toFloat()

            val stemBaseScreenX = screenX + (-stemBaseY * sinR)
            val stemBaseScreenY = screenY + ( stemBaseY * cosR)
            val stemTipScreenX  = screenX + (-stemTipY  * sinR)
            val stemTipScreenY  = screenY + ( stemTipY  * cosR)
            val circleScreenX   = screenX + (-circleY   * sinR)
            val circleScreenY   = screenY + ( circleY   * cosR)

            canvas.drawLine(stemBaseScreenX, stemBaseScreenY,
                            stemTipScreenX,  stemTipScreenY, rotateStemPaint)
            canvas.drawCircle(circleScreenX, circleScreenY, ROTATE_HANDLE_RADIUS, rotateHandleFillPaint)
            canvas.drawCircle(circleScreenX, circleScreenY, ROTATE_HANDLE_RADIUS, rotateHandleStrokePaint)
        }
    }

    // ───────────────────────────────────────────────────────────────────
    // Hit-test helpers
    // ───────────────────────────────────────────────────────────────────

    /**
     * Returns true if the touch point falls within the rotation handle of the
     * currently selected sticker.
     */
    fun isNearRotateHandle(
        touchX: Float,
        touchY: Float,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        mapScale: Float,
        mapRotationRadians: Float = 0f
    ): Boolean {
        val instanceId = stickerManager.selectedInstanceId ?: return false
        val sticker    = stickerManager.getSticker(instanceId) ?: return false
        val (_, hh)    = getStickerHalfSize(sticker, mapScale) ?: return false
        val (sx, sy)   = geoToScreen(sticker.lat, sticker.lng)

        val pad       = ROTATE_HANDLE_PAD
        val localY    = -(hh + pad + ROTATE_HANDLE_STEM + ROTATE_HANDLE_RADIUS)
        val mapRotationDegrees = Math.toDegrees(mapRotationRadians.toDouble()).toFloat()
        val rotRad    = Math.toRadians(effectiveRotation(sticker, mapRotationDegrees).toDouble())
        val circleX   = sx + (-localY * sin(rotRad)).toFloat()
        val circleY   = sy + ( localY * cos(rotRad)).toFloat()

        val dx = touchX - circleX
        val dy = touchY - circleY
        return (dx * dx + dy * dy) <= ROTATE_TOUCH_RADIUS * ROTATE_TOUCH_RADIUS
    }

    /**
     * Returns the corner index (0=TL, 1=TR, 2=BR, 3=BL) of the corner handle
     * hit by the touch, or -1 if no corner was hit.
     * Corners are computed in screen space accounting for sticker rotation.
     */
    fun getCornerHitIndex(
        touchX: Float,
        touchY: Float,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        mapScale: Float,
        mapRotationRadians: Float = 0f
    ): Int {
        val instanceId = stickerManager.selectedInstanceId ?: return -1
        val sticker    = stickerManager.getSticker(instanceId) ?: return -1
        val (hw, hh)   = getStickerHalfSize(sticker, mapScale) ?: return -1
        val (sx, sy)   = geoToScreen(sticker.lat, sticker.lng)

        val pad    = ROTATE_HANDLE_PAD
        val ph     = hw + pad
        val pv     = hh + pad
        val mapRotationDegrees = Math.toDegrees(mapRotationRadians.toDouble()).toFloat()
        val rotRad = Math.toRadians(effectiveRotation(sticker, mapRotationDegrees).toDouble())
        val cosR   = cos(rotRad).toFloat()
        val sinR   = sin(rotRad).toFloat()

        // Sticker-local corner offsets (in order TL, TR, BR, BL)
        val localCorners = listOf(
            Pair(-ph, -pv), Pair(ph, -pv),
            Pair( ph,  pv), Pair(-ph,  pv)
        )
        for ((idx, lc) in localCorners.withIndex()) {
            val (lx, ly) = lc
            // Rotate local offset into screen space
            val screenCx = sx + lx * cosR - ly * sinR
            val screenCy = sy + lx * sinR + ly * cosR
            val dx = touchX - screenCx
            val dy = touchY - screenCy
            if ((dx * dx + dy * dy) <= CORNER_TOUCH_RADIUS * CORNER_TOUCH_RADIUS) {
                return idx
            }
        }
        return -1
    }

    /**
     * Hit-test: returns the sticker instance under the given screen point, or null.
     * Checks in reverse order (top-most sticker first).
     */
    fun hitTest(
        screenX: Float,
        screenY: Float,
        geoToScreen: (Double, Double) -> Pair<Float, Float>,
        mapScale: Float
    ): StickerInstance? {
        val stickers = stickerManager.getVisibleStickers()
        for (sticker in stickers.reversed()) {
            val bitmap = stickerManager.getStickerBitmap(sticker.stickerKey) ?: continue
            val (sx, sy) = geoToScreen(sticker.lat, sticker.lng)

            val displayScale = sticker.scale * (baseStickerSize / bitmap.width)
            val zoomFactor   = (mapScale / 2f).coerceIn(0.5f, 3f)
            val finalScale   = displayScale * zoomFactor

            val halfW = bitmap.width  * finalScale / 2f
            val halfH = bitmap.height * finalScale / 2f

            // Circular hit-test (tolerant, ignores rotation for simplicity)
            val hitRadius = maxOf(halfW, halfH) + 8f
            val dx = screenX - sx
            val dy = screenY - sy
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return sticker
            }
        }
        return null
    }
}
