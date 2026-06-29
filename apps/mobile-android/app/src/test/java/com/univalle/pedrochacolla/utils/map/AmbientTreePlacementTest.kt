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

    @Test
    fun baseInside_contour_fondoOnFrame() {
        val inside = ParkMapView.GeoPoint(5.0, 5.0)
        val frame = ParkMapView.GeoPoint(9.5, 9.5)
        assertTrue(AmbientTreePlacement.canPlaceTreeOnBaseParkLayer(inside, boundary))
        assertFalse(AmbientTreePlacement.canPlaceTreeOnBaseParkLayer(frame, boundary))
        assertTrue(AmbientTreePlacement.canPlaceTreeOnBackdropLayer(frame, boundary))
    }

    @Test
    fun paletteSection_usesStyleSectionForBaseAndFondo() {
        val slot = com.univalle.pedrochacolla.data.model.AmbientTreeSlotData(
            lat = 1.0, lng = 1.0, section = -2, styleSection = 0,
        )
        assertEquals(0, AmbientTreePlacement.paletteSectionForTree(slot))
    }
}
