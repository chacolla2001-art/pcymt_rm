package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.data.model.LatLngData
import com.univalle.pedrochacolla.data.model.ParkSectionRecordData
import com.univalle.pedrochacolla.data.model.SectionEducationData
import com.univalle.pedrochacolla.data.model.SpatialReferenceData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PublishedParkMapperTest {

    @Test
    fun toParkSections_parsesPolygonAndEducation() {
        val records = listOf(
            ParkSectionRecordData(
                code = "highlands",
                name = "Tierras Altas",
                chartColor = "#4CAF50",
                fillOpacity = 0.15,
                fillOpacityLight = 0.1,
                education = SectionEducationData(summary = "Altiplano"),
                polygon = listOf(
                    LatLngData(-16.49, -68.146),
                    LatLngData(-16.49, -68.145),
                    LatLngData(-16.488, -68.145),
                ),
            ),
        )
        val sections = PublishedParkMapper.toParkSections(records)
        assertEquals(1, sections.size)
        assertEquals("Tierras Altas", sections[0].name)
        assertEquals("Altiplano", sections[0].educationSummary)
        assertEquals(3, sections[0].polygon.size)
    }

    @Test
    fun toPoiItems_mapsKnownRefIds() {
        val refs = listOf(
            SpatialReferenceData(
                id = "ingress",
                name = "Ingreso",
                lat = -16.48,
                lng = -68.14,
                category = "acceso",
                icon = "ingress",
                animation = "pulse",
                summary = "Entrada",
            ),
        )
        val items = PublishedParkMapper.toPoiItems(refs, android.content.res.Resources.getSystem(), "android")
        assertEquals(1, items.size)
        assertEquals(1, items[0].id)
        assertEquals("Ingreso", items[0].name)
        assertTrue(items[0].summary.isNotBlank())
    }
}
