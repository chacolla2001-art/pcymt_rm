package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AmbientTreePlacementTest {
    private val boundary = listOf(
        ParkMapView.GeoPoint(0.0, 0.0),
        ParkMapView.GeoPoint(0.0, 10.0),
        ParkMapView.GeoPoint(10.0, 10.0),
        ParkMapView.GeoPoint(10.0, 0.0),
    )

    private val mapPlate = listOf(
        ParkMapView.GeoPoint(-1.0, -1.0),
        ParkMapView.GeoPoint(-1.0, 11.0),
        ParkMapView.GeoPoint(11.0, 11.0),
        ParkMapView.GeoPoint(11.0, -1.0),
    )

    @Test
    fun baseInRing_fondoOutsidePlate() {
        val inside = ParkMapView.GeoPoint(5.0, 5.0)
        val ring = ParkMapView.GeoPoint(10.5, 5.0)
        val outside = ParkMapView.GeoPoint(12.0, 5.0)
        assertFalse(AmbientTreePlacement.canPlaceTreeOnBaseParkLayer(inside, boundary, mapPlate))
        assertTrue(AmbientTreePlacement.canPlaceTreeOnBaseParkLayer(ring, boundary, mapPlate))
        assertTrue(AmbientTreePlacement.canPlaceTreeOnBackdropLayer(outside, mapPlate))
        assertFalse(AmbientTreePlacement.canPlaceTreeOnBackdropLayer(ring, mapPlate))
    }

    @Test
    fun paletteSection_usesStyleSectionForBaseAndFondo() {
        val slot = com.univalle.pedrochacolla.data.model.AmbientTreeSlotData(
            lat = 1.0, lng = 1.0, section = -2, styleSection = 0,
        )
        assertEquals(0, AmbientTreePlacement.paletteSectionForTree(slot))
    }
}
