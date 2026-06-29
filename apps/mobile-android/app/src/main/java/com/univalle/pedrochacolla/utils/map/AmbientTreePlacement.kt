package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.data.model.AmbientTreeSlotData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/** Lógica de capas de árboles alineada con web-admin (`ambient-tree-slots.ts`). */
object AmbientTreePlacement {
    const val TREE_BASE_PARK_SECTION = -1
    const val TREE_BACKDROP_SECTION = -2

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

    /**
     * Base del parque: anillo entre el contorno y el cuadrado grande del plano del mapa.
     * `mapPlate` = esquinas del plano (no el bbox geográfico del parque).
     */
    fun isGeoInParkBaseFrame(
        geo: ParkMapView.GeoPoint,
        boundary: List<ParkMapView.GeoPoint>,
        mapPlate: List<ParkMapView.GeoPoint>,
    ): Boolean {
        if (boundary.isEmpty() || mapPlate.size < 3) return false
        if (!ParkMapPlate.isGeoInMapPlate(geo, mapPlate)) return false
        if (ParkSectionResolver.isPointInPolygon(geo, boundary)) return false
        return true
    }

    fun canPlaceTreeOnBaseParkLayer(
        geo: ParkMapView.GeoPoint,
        boundary: List<ParkMapView.GeoPoint>,
        mapPlate: List<ParkMapView.GeoPoint>,
    ): Boolean = isGeoInParkBaseFrame(geo, boundary, mapPlate)

    /** Fondo (-2): fuera del cuadrado grande del plano. */
    fun canPlaceTreeOnBackdropLayer(
        geo: ParkMapView.GeoPoint,
        mapPlate: List<ParkMapView.GeoPoint>,
    ): Boolean = mapPlate.size >= 3 && !ParkMapPlate.isGeoInMapPlate(geo, mapPlate)

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
