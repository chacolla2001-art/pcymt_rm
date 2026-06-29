package com.univalle.pedrochacolla.utils.map

import android.graphics.Canvas
import com.univalle.pedrochacolla.data.model.AmbientTreeSlotData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/** Dibuja árboles publicados por capa (port de `map-trees-effect.ts`). */
object MapTreesRenderer {
    data class Viewport(val minX: Float, val minY: Float, val maxX: Float, val maxY: Float)

    fun drawBackdrop(
        canvas: Canvas,
        slots: List<AmbientTreeSlotData>,
        geoToCanvas: (ParkMapView.GeoPoint) -> ParkMapView.ScreenPoint,
        boundary: List<ParkMapView.GeoPoint>,
        isDark: Boolean,
        sizeMul: Float,
        viewport: Viewport,
    ) {
        drawPool(
            canvas,
            slots.filter { AmbientTreePlacement.isBackdropTree(it) },
            geoToCanvas,
            isDark,
            sizeMul,
            viewport,
        ) { slot, geo ->
            AmbientTreePlacement.canPlaceTreeOnBackdropLayer(geo, boundary)
        }
    }

    fun drawBasePark(
        canvas: Canvas,
        slots: List<AmbientTreeSlotData>,
        geoToCanvas: (ParkMapView.GeoPoint) -> ParkMapView.ScreenPoint,
        boundary: List<ParkMapView.GeoPoint>,
        isDark: Boolean,
        sizeMul: Float,
        viewport: Viewport,
    ) {
        drawPool(
            canvas,
            slots.filter { AmbientTreePlacement.isBaseParkTree(it) },
            geoToCanvas,
            isDark,
            sizeMul,
            viewport,
        ) { slot, geo ->
            AmbientTreePlacement.canPlaceTreeOnBaseParkLayer(geo, boundary)
        }
    }

    fun drawWorld(
        canvas: Canvas,
        slots: List<AmbientTreeSlotData>,
        geoToCanvas: (ParkMapView.GeoPoint) -> ParkMapView.ScreenPoint,
        sectionPolygons: List<List<ParkMapView.GeoPoint>>,
        boundary: List<ParkMapView.GeoPoint>,
        isDark: Boolean,
        sizeMul: Float,
        viewport: Viewport,
    ) {
        drawPool(
            canvas,
            slots.filter { !AmbientTreePlacement.isBackdropTree(it) && !AmbientTreePlacement.isBaseParkTree(it) },
            geoToCanvas,
            isDark,
            sizeMul,
            viewport,
        ) { slot, geo ->
            AmbientTreePlacement.isParkZoneTreeVisible(slot, geo, sectionPolygons, boundary)
        }
    }

    private fun drawPool(
        canvas: Canvas,
        pool: List<AmbientTreeSlotData>,
        geoToCanvas: (ParkMapView.GeoPoint) -> ParkMapView.ScreenPoint,
        isDark: Boolean,
        sizeMul: Float,
        viewport: Viewport,
        isVisible: (AmbientTreeSlotData, ParkMapView.GeoPoint) -> Boolean,
    ) {
        if (pool.isEmpty()) return
        val pad = 48f
        val placed = mutableListOf<Triple<AmbientTreeSlotData, Float, Float>>()
        for (slot in pool) {
            val geo = ParkMapView.GeoPoint(slot.lat, slot.lng)
            if (!isVisible(slot, geo)) continue
            val pos = geoToCanvas(geo)
            if (pos.x < viewport.minX - pad || pos.x > viewport.maxX + pad
                || pos.y < viewport.minY - pad || pos.y > viewport.maxY + pad
            ) continue
            placed.add(Triple(slot, pos.x, pos.y))
        }
        placed.sortBy { it.third }
        for ((slot, x, y) in placed) {
            val section = AmbientTreePlacement.paletteSectionForTree(slot)
            val h = SimpleTreeDrawer.defaultTreeHeight(sizeMul, slot.scale)
            SimpleTreeDrawer.drawSimpleTree(
                canvas, x, y, h, slot.seed, slot.variant, isDark, section, sizeMul,
            )
        }
    }
}
