package com.univalle.pedrochacolla.utils.location

import android.content.Context
import com.univalle.pedrochacolla.data.local.ParkDataLoader

/**
 * Geographic bounding box for the park — derived from shared/data/park-boundary.json.
 */
object ParkBoundsUtil {

    fun isInsideParkBounds(context: Context, lat: Double, lng: Double): Boolean {
        val boundary = ParkDataLoader.load(context).boundary
        if (boundary.isEmpty()) return true

        var minLat = boundary[0].lat
        var maxLat = boundary[0].lat
        var minLng = boundary[0].lng
        var maxLng = boundary[0].lng

        for (point in boundary) {
            minLat = minOf(minLat, point.lat)
            maxLat = maxOf(maxLat, point.lat)
            minLng = minOf(minLng, point.lng)
            maxLng = maxOf(maxLng, point.lng)
        }

        return lat in minLat..maxLat && lng in minLng..maxLng
    }

    /** @deprecated Use [isInsideParkBounds] with Context for shared-data bounds */
    fun isInsideParkBounds(lat: Double, lng: Double): Boolean {
        // OSM way/641677241 bounding box
        return lat in MIN_LAT..MAX_LAT && lng in MIN_LNG..MAX_LNG
    }

    private const val MIN_LAT = -16.4919539
    private const val MAX_LAT = -16.4866356
    private const val MIN_LNG = -68.146852
    private const val MAX_LNG = -68.1446378
}
