package com.univalle.pedrochacolla.utils.map

import android.content.Context
import com.univalle.pedrochacolla.data.local.ParkDataLoader
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/**
 * Resolución de sección/zona del parque — misma lógica que shared/map/park-map-core.mjs
 */
object ParkSectionResolver {

    data class LegendItem(val name: String, val swatchColor: Int)

    /** 3 ecosistemas activos (sin Mitos y Leyendas). */
    val legend: List<LegendItem> = listOf(
        LegendItem("Tierras Altas", 0xFF8D6E63.toInt()),
        LegendItem("Tierras Medias", 0xFF66BB6A.toInt()),
        LegendItem("Tierras Bajas", 0xFF42A5F5.toInt()),
    )

    fun isPointInPolygon(point: ParkMapView.GeoPoint, polygon: List<ParkMapView.GeoPoint>): Boolean {
        if (polygon.size < 3) return false
        var inside = false
        var j = polygon.lastIndex
        for (i in polygon.indices) {
            val yi = polygon[i].lat
            val yj = polygon[j].lat
            val xi = polygon[i].lng
            val xj = polygon[j].lng
            val intersect = (yi > point.lat) != (yj > point.lat) &&
                point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi
            if (intersect) inside = !inside
            j = i
        }
        return inside
    }

    fun polygonCentroid(polygon: List<ParkMapView.GeoPoint>): ParkMapView.GeoPoint {
        if (polygon.isEmpty()) return ParkMapView.GeoPoint(0.0, 0.0)
        var sumLat = 0.0
        var sumLng = 0.0
        for (p in polygon) {
            sumLat += p.lat
            sumLng += p.lng
        }
        return ParkMapView.GeoPoint(sumLat / polygon.size, sumLng / polygon.size)
    }

    fun findSectionAt(context: Context, lat: Double, lng: Double): String? {
        val point = ParkMapView.GeoPoint(lat, lng)
        for (section in ParkDataLoader.load(context).sections) {
            if (isPointInPolygon(point, section.polygon)) return section.name
        }
        return null
    }

    fun isInsidePark(context: Context, lat: Double, lng: Double): Boolean {
        val boundary = ParkDataLoader.load(context).boundary
        return isPointInPolygon(ParkMapView.GeoPoint(lat, lng), boundary)
    }
}
