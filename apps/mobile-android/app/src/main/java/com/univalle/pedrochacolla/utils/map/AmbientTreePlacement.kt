package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.data.model.AmbientTreeSlotData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/** Lógica de capas de árboles alineada con web-admin (`ambient-tree-slots.ts`). */
object AmbientTreePlacement {
    const val TREE_BASE_PARK_SECTION = -1
    const val TREE_BACKDROP_SECTION = -2
    private const val FRAME_PADDING_DEG = 0.004

    fun isBackdropTree(slot: AmbientTreeSlotData): Boolean =
        slot.section == TREE_BACKDROP_SECTION

    fun isBaseParkTree(slot: AmbientTreeSlotData): Boolean =
        slot.section == TREE_BASE_PARK_SECTION

    fun paletteSectionForTree(slot: AmbientTreeSlotData): Int {
        if (slot.section == TREE_BASE_PARK_SECTION || slot.section == TREE_BACKDROP_SECTION) {
            val s = slot.styleSection ?: 1
            return s.coerceIn(0, 2)
        }
        return slot.section.coerceIn(0, 2)
    }

    fun canPlaceTreeOnBaseParkLayer(
        geo: ParkMapView.GeoPoint,
        boundary: List<ParkMapView.GeoPoint>,
    ): Boolean = boundary.isNotEmpty() && ParkSectionResolver.isPointInPolygon(geo, boundary)

    fun canPlaceTreeOnBackdropLayer(
        geo: ParkMapView.GeoPoint,
        boundary: List<ParkMapView.GeoPoint>,
    ): Boolean = isGeoInBackdropFrame(geo, boundary)

    fun isGeoInBackdropFrame(
        geo: ParkMapView.GeoPoint,
        boundary: List<ParkMapView.GeoPoint>,
    ): Boolean {
        if (boundary.isEmpty()) return false
        if (ParkSectionResolver.isPointInPolygon(geo, boundary)) return false
        var minLat = Double.POSITIVE_INFINITY
        var maxLat = Double.NEGATIVE_INFINITY
        var minLng = Double.POSITIVE_INFINITY
        var maxLng = Double.NEGATIVE_INFINITY
        for (p in boundary) {
            minLat = minOf(minLat, p.lat)
            maxLat = maxOf(maxLat, p.lat)
            minLng = minOf(minLng, p.lng)
            maxLng = maxOf(maxLng, p.lng)
        }
        return geo.lat >= minLat - FRAME_PADDING_DEG
            && geo.lat <= maxLat + FRAME_PADDING_DEG
            && geo.lng >= minLng - FRAME_PADDING_DEG
            && geo.lng <= maxLng + FRAME_PADDING_DEG
    }

    fun isParkZoneTreeVisible(
        slot: AmbientTreeSlotData,
        geo: ParkMapView.GeoPoint,
        sectionPolygons: List<List<ParkMapView.GeoPoint>>,
        boundary: List<ParkMapView.GeoPoint>,
    ): Boolean {
        if (isBackdropTree(slot) || isBaseParkTree(slot)) return false
        val polygon = sectionPolygons.getOrNull(slot.section)
        return if (polygon.isNullOrEmpty()) {
            ParkSectionResolver.isPointInPolygon(geo, boundary)
        } else {
            ParkSectionResolver.isPointInPolygon(geo, polygon)
        }
    }
}
