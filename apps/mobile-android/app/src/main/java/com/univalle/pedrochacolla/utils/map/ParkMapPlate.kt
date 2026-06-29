package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/** Utilidades del plano cuadrado del mapa (esquinas 0…w × 0…h en canvas). */
object ParkMapPlate {

    fun mapPlateCanvasPoints(w: Float, h: Float): List<ParkMapView.ScreenPoint> = listOf(
        ParkMapView.ScreenPoint(0f, 0f),
        ParkMapView.ScreenPoint(w, 0f),
        ParkMapView.ScreenPoint(w, h),
        ParkMapView.ScreenPoint(0f, h),
    )

    /** Dentro del plano cuadrado del mapa (esquinas en geo). */
    fun isGeoInMapPlate(geo: ParkMapView.GeoPoint, plateCorners: List<ParkMapView.GeoPoint>): Boolean =
        plateCorners.size >= 3 && ParkSectionResolver.isPointInPolygon(geo, plateCorners)
}
