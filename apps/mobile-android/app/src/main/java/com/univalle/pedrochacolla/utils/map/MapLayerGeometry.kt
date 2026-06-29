package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.data.model.BaseRingFrameData
import com.univalle.pedrochacolla.data.model.LayerFrameTransformData
import com.univalle.pedrochacolla.data.model.MapLayerFramesData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/** Geometría del plano y anillo — port de `map-layer-geometry.ts`. */
object MapLayerGeometry {
    private const val MIN_SCALE = 0.25f
    private const val MAX_SCALE = 3f

    fun normalize(frames: MapLayerFramesData?): MapLayerFramesData {
        if (frames == null) return defaultFrames()
        return MapLayerFramesData(
            mapPlate = normalizeTransform(frames.mapPlate),
            baseRing = normalizeBaseRing(frames.baseRing),
            zones = normalizeTransform(frames.zones),
            markers = normalizeTransform(frames.markers),
        )
    }

    fun defaultFrames() = MapLayerFramesData(
        mapPlate = LayerFrameTransformData(),
        baseRing = BaseRingFrameData(),
        zones = LayerFrameTransformData(),
        markers = LayerFrameTransformData(),
    )

    private fun normalizeTransform(raw: LayerFrameTransformData?): LayerFrameTransformData {
        val r = raw ?: LayerFrameTransformData()
        return LayerFrameTransformData(
            x = r.x,
            y = r.y,
            scale = r.scale.coerceIn(MIN_SCALE, MAX_SCALE),
            rotationDeg = r.rotationDeg,
        )
    }

    private fun normalizeBaseRing(raw: BaseRingFrameData?): BaseRingFrameData {
        val base = normalizeTransform(raw)
        return BaseRingFrameData(
            x = base.x,
            y = base.y,
            scale = base.scale,
            rotationDeg = base.rotationDeg,
            innerExpandPx = (raw?.innerExpandPx ?: 0f).coerceIn(0f, 400f),
            outerExpandPx = (raw?.outerExpandPx ?: 0f).coerceIn(0f, 400f),
        )
    }

    fun mapPlateCanvasPoints(
        w: Float,
        h: Float,
        frame: LayerFrameTransformData,
    ): List<ParkMapView.ScreenPoint> {
        val cx = w / 2f
        val cy = h / 2f
        val scale = frame.scale.coerceIn(MIN_SCALE, MAX_SCALE)
        val hw = (w / 2f) * scale
        val hh = (h / 2f) * scale
        val rad = Math.toRadians(frame.rotationDeg.toDouble())
        val cosR = cos(rad).toFloat()
        val sinR = sin(rad).toFloat()
        val local = listOf(
            ParkMapView.ScreenPoint(-hw, -hh),
            ParkMapView.ScreenPoint(hw, -hh),
            ParkMapView.ScreenPoint(hw, hh),
            ParkMapView.ScreenPoint(-hw, hh),
        )
        return local.map { p ->
            ParkMapView.ScreenPoint(
                cx + frame.x + p.x * cosR - p.y * sinR,
                cy + frame.y + p.x * sinR + p.y * cosR,
            )
        }
    }

    fun expandPolygonOutward(
        points: List<ParkMapView.ScreenPoint>,
        expandPx: Float,
    ): List<ParkMapView.ScreenPoint> {
        if (expandPx <= 0f || points.size < 3) return points
        var cx = 0f
        var cy = 0f
        for (p in points) {
            cx += p.x
            cy += p.y
        }
        cx /= points.size
        cy /= points.size
        return points.map { p ->
            val dx = p.x - cx
            val dy = p.y - cy
            val len = hypot(dx, dy).coerceAtLeast(1f)
            ParkMapView.ScreenPoint(p.x + dx / len * expandPx, p.y + dy / len * expandPx)
        }
    }

    fun contractPolygonInward(
        points: List<ParkMapView.ScreenPoint>,
        insetPx: Float,
    ): List<ParkMapView.ScreenPoint> {
        if (insetPx <= 0f || points.size < 3) return points
        var cx = 0f
        var cy = 0f
        for (p in points) {
            cx += p.x
            cy += p.y
        }
        cx /= points.size
        cy /= points.size
        return points.map { p ->
            val dx = p.x - cx
            val dy = p.y - cy
            val len = hypot(dx, dy).coerceAtLeast(1f)
            val shrink = (len - insetPx).coerceAtLeast(len * 0.05f) / len
            ParkMapView.ScreenPoint(cx + dx * shrink, cy + dy * shrink)
        }
    }

    fun combineOffset(
        dragX: Float,
        dragY: Float,
        frame: LayerFrameTransformData,
    ): LayerFrameTransformData = LayerFrameTransformData(
        x = dragX + frame.x,
        y = dragY + frame.y,
        scale = frame.scale,
        rotationDeg = frame.rotationDeg,
    )

    fun applyLayerFrameTransform(
        canvas: android.graphics.Canvas,
        w: Float,
        h: Float,
        frame: LayerFrameTransformData,
    ) {
        val cx = w / 2f
        val cy = h / 2f
        canvas.translate(cx + frame.x, cy + frame.y)
        if (frame.rotationDeg != 0f) {
            canvas.rotate(frame.rotationDeg)
        }
        if (frame.scale != 1f) {
            canvas.scale(frame.scale, frame.scale)
        }
        canvas.translate(-cx, -cy)
    }
}
