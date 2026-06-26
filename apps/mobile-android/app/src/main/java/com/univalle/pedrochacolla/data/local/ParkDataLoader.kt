package com.univalle.pedrochacolla.data.local

import android.content.Context
import android.graphics.Color
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView

/**
 * Loads park boundary/sections from shared/data JSON bundled in assets.
 * Single source of truth with the web admin map (shared/data JSON files).
 */
object ParkDataLoader {
    private val gson = Gson()

    @Volatile
    private var cached: ParkDataBundle? = null

    data class ParkDataBundle(
        val boundary: List<ParkMapView.GeoPoint>,
        val sections: List<ParkMapView.ParkSection>,
    )

    private data class BoundaryFile(
        val coordinates: List<LatLngDto>,
    )

    private data class SectionsFile(
        val sections: List<SectionDto>,
    )

    private data class LatLngDto(
        val lat: Double,
        val lng: Double,
    )

    private data class EducationDto(
        val summary: String?,
        @SerializedName("referenceImageUrl") val referenceImageUrl: String?,
    )

    private data class SectionDto(
        val name: String,
        val code: String?,
        @SerializedName("chartColor") val chartColor: String?,
        @SerializedName("fillOpacity") val fillOpacity: Float? = null,
        @SerializedName("fillOpacityLight") val fillOpacityLight: Float? = null,
        val colors: WebColorsDto?,
        val education: EducationDto?,
        val polygon: List<LatLngDto>,
    )

    private data class WebColorsDto(
        @SerializedName("webFill") val webFill: String?,
        @SerializedName("webFillLight") val webFillLight: String?,
    )

    private val defaultEducation = mapOf(
        "highlands" to "Zona del altiplano y bosques nublados: frío, viento y especies adaptadas a la altura, como el oso andino.",
        "mediumlands" to "Valles interandinos y Yungas: clima templado, agricultura y fauna de transición entre montaña y llanura.",
        "lowlands" to "Selva amazónica y llanos orientales: humedad, biodiversidad y especies de las tierras bajas bolivianas.",
    )

    fun load(context: Context): ParkDataBundle {
        cached?.let { return it }
        return synchronized(this) {
            cached ?: readBundle(context.applicationContext).also { cached = it }
        }
    }

    private fun readBundle(context: Context): ParkDataBundle {
        val boundaryJson = context.assets.open("park-boundary.json").bufferedReader().use { it.readText() }
        val sectionsJson = context.assets.open("park-sections.json").bufferedReader().use { it.readText() }

        val boundary = gson.fromJson(boundaryJson, BoundaryFile::class.java).coordinates.map {
            ParkMapView.GeoPoint(it.lat, it.lng)
        }

        val sections = gson.fromJson(sectionsJson, SectionsFile::class.java).sections.map { dto ->
            val code = dto.code ?: dto.name
            val chartColor = parseHexColor(dto.chartColor) ?: Color.GRAY
            val darkOp = dto.fillOpacity
                ?: dto.colors?.webFill?.let { parseRgbaOpacity(it) }
                ?: 0.12f
            val lightOp = dto.fillOpacityLight
                ?: dto.colors?.webFillLight?.let { parseRgbaOpacity(it) }
                ?: 0.08f
            val fill = argbFromChartOpacity(chartColor, darkOp)
            val fillLight = argbFromChartOpacity(chartColor, lightOp)
            val summary = dto.education?.summary?.takeIf { it.isNotBlank() }
                ?: defaultEducation[code]
                ?: ""

            ParkMapView.ParkSection(
                name = dto.name,
                color = fill,
                colorLight = fillLight,
                chartColor = chartColor,
                fillOpacity = darkOp.coerceIn(0f, 1f),
                fillOpacityLight = lightOp.coerceIn(0f, 1f),
                educationSummary = summary,
                referenceImageUrl = dto.education?.referenceImageUrl?.takeIf { it.isNotBlank() },
                polygon = dto.polygon.map { ParkMapView.GeoPoint(it.lat, it.lng) },
            )
        }

        return ParkDataBundle(boundary, sections)
    }

    private fun parseHexColor(hex: String?): Int? {
        if (hex.isNullOrBlank()) return null
        return runCatching { Color.parseColor(hex.trim()) }.getOrNull()
    }

    private fun parseRgbaOpacity(rgba: String): Float? {
        val m = Regex("""rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)""", RegexOption.IGNORE_CASE)
            .find(rgba.trim()) ?: return null
        return (m.groupValues.getOrNull(4)?.toFloatOrNull() ?: 1f).coerceIn(0f, 1f)
    }

    private fun argbFromChartOpacity(chartColor: Int, opacity: Float): Int =
        Color.argb(
            (opacity.coerceIn(0f, 1f) * 255).toInt(),
            Color.red(chartColor),
            Color.green(chartColor),
            Color.blue(chartColor),
        )
}
