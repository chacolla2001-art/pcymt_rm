package com.univalle.pedrochacolla.utils.map

import android.content.res.Resources
import android.graphics.Color
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.ParkSectionRecordData
import com.univalle.pedrochacolla.data.model.SpatialReferenceData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import com.univalle.pedrochacolla.ui.dashboard.PoiItem

/** Convierte geometría/referencias publicadas desde web-admin a tipos de `ParkMapView`. */
object PublishedParkMapper {

    private val defaultEducation = mapOf(
        "highlands" to "Zona del altiplano y bosques nublados: frío, viento y especies adaptadas a la altura, como el oso andino.",
        "mediumlands" to "Valles interandinos y Yungas: clima templado, agricultura y fauna de transición entre montaña y llanura.",
        "lowlands" to "Selva amazónica y llanos orientales: humedad, biodiversidad y especies de las tierras bajas bolivianas.",
    )

    private val refIdToPoiId = mapOf(
        "ingress" to 1,
        "box-office" to 2,
        "chiwina" to 3,
        "cafeteria" to 4,
        "teatro" to 5,
        "aguas" to 6,
        "mirador" to 7,
        "escenario" to 8,
        "anfiteatro" to 9,
        "parrillero" to 10,
        "picnic" to 11,
    )

    private val iconToDrawableSuffix = mapOf(
        "ingress" to "ingreso",
        "box-office" to "boleterias",
        "chiwina" to "chiwina",
        "cafeteria" to "cafeteria",
        "teatro" to "teatro",
        "aguas" to "aguas",
        "mirador" to "mirador",
        "escenario" to "escenario",
        "anfiteatro" to "anfiteatro",
        "parrillero" to "parrillero",
        "picnic" to "picnik",
    )

    fun toParkSections(records: List<ParkSectionRecordData>): List<ParkMapView.ParkSection> =
        records.mapNotNull { record ->
            val polygon = record.polygon?.map { ParkMapView.GeoPoint(it.lat, it.lng) }.orEmpty()
            if (polygon.size < 3) return@mapNotNull null
            val code = record.code ?: record.id ?: record.name
            val chartColor = parseHexColor(record.chartColor) ?: Color.GRAY
            val darkOp = record.fillOpacity?.toFloat()
                ?: record.colors?.webFill?.let { parseRgbaOpacity(it) }
                ?: 0.12f
            val lightOp = record.fillOpacityLight?.toFloat()
                ?: record.colors?.webFillLight?.let { parseRgbaOpacity(it) }
                ?: 0.08f
            val summary = record.education?.summary?.takeIf { it.isNotBlank() }
                ?: defaultEducation[code]
                ?: ""
            ParkMapView.ParkSection(
                name = record.name,
                color = argbFromChartOpacity(chartColor, darkOp),
                colorLight = argbFromChartOpacity(chartColor, lightOp),
                chartColor = chartColor,
                fillOpacity = darkOp.coerceIn(0f, 1f),
                fillOpacityLight = lightOp.coerceIn(0f, 1f),
                educationSummary = summary,
                referenceImageUrl = record.education?.referenceImageUrl?.takeIf { it.isNotBlank() },
                polygon = polygon,
            )
        }

    fun toPoiItems(
        refs: List<SpatialReferenceData>,
        resources: Resources,
        packageName: String,
    ): List<PoiItem> = refs.mapIndexed { index, ref ->
        val drawableRes = resolveDrawable(ref.icon, resources, packageName)
        PoiItem(
            id = refIdToPoiId[ref.id] ?: (100 + index),
            refId = ref.id,
            name = ref.name,
            lat = ref.lat,
            lng = ref.lng,
            drawableRes = drawableRes,
            color = "#CCCCCC",
            category = ref.category,
            animation = ref.animation ?: "none",
            summary = ref.education?.summary?.takeIf { it.isNotBlank() } ?: ref.summary.orEmpty(),
            visible = ref.visible != false,
            displaySize = (ref.displaySize ?: 48.0).toFloat(),
        )
    }

    private fun resolveDrawable(icon: String?, resources: Resources, packageName: String): Int {
        val suffix = icon?.let { iconToDrawableSuffix[it] ?: it } ?: "mirador"
        val resName = "ic_poi_$suffix"
        return resources.getIdentifier(resName, "drawable", packageName)
            .takeIf { it != 0 } ?: R.drawable.ic_launcher_foreground
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
