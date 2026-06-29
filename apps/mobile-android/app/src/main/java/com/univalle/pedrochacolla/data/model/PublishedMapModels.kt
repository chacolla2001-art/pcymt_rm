package com.univalle.pedrochacolla.data.model

import com.google.gson.annotations.SerializedName

/** Árbol colocado en el mapa (sincronizado desde web-admin). */
data class AmbientTreeSlotData(
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val section: Int = 1,
    val variant: Int = 0,
    val seed: Double = 0.0,
    val scale: Double = 1.0,
    @SerializedName("styleSection")
    val styleSection: Int? = null,
)

data class GroundElementSpecData(
    val type: String = "stone",
    val density: Double = 0.0,
    @SerializedName("sizeMin")
    val sizeMin: Double = 0.6,
    @SerializedName("sizeMax")
    val sizeMax: Double = 1.0,
)

data class ZoneGroundStyleData(
    val elements: List<GroundElementSpecData>? = null,
    @SerializedName("macroDensity")
    val macroDensity: Double? = null,
    @SerializedName("macroAlpha")
    val macroAlpha: Double? = null,
    @SerializedName("edgeBlend")
    val edgeBlend: Double? = null,
    @SerializedName("edgeBlendAlpha")
    val edgeBlendAlpha: Double? = null,
)

data class GroundMapSettingsData(
    @SerializedName("presetId")
    val presetId: String? = "balanced",
    @SerializedName("scalePercent")
    val scalePercent: Double? = 100.0,
    @SerializedName("qualityPercent")
    val qualityPercent: Double? = 85.0,
    @SerializedName("lodEnabled")
    val lodEnabled: Boolean? = true,
    @SerializedName("lodFineZoom")
    val lodFineZoom: Double? = null,
    @SerializedName("lodMediumZoom")
    val lodMediumZoom: Double? = null,
    @SerializedName("lodEcotoneZoom")
    val lodEcotoneZoom: Double? = null,
)

/** Escena ambiental publicada desde web-admin (`ambientScene` en config). */
data class AmbientSceneData(
    @SerializedName("activeScenarioId")
    val activeScenarioId: String? = null,
    @SerializedName("showSpatialReferences")
    val showSpatialReferences: Boolean? = null,
    @SerializedName("showRainEffect")
    val showRainEffect: Boolean? = null,
    @SerializedName("rainIntensity")
    val rainIntensity: Double? = null,
    @SerializedName("rainSize")
    val rainSize: Double? = null,
    @SerializedName("rainSectionIndex")
    val rainSectionIndex: Int? = null,
    @SerializedName("showFogEffect")
    val showFogEffect: Boolean? = null,
    @SerializedName("fogIntensity")
    val fogIntensity: Double? = null,
    @SerializedName("fogSize")
    val fogSize: Double? = null,
    @SerializedName("showMotesEffect")
    val showMotesEffect: Boolean? = null,
    @SerializedName("motesIntensity")
    val motesIntensity: Double? = null,
    @SerializedName("motesSize")
    val motesSize: Double? = null,
    @SerializedName("showCloudShadows")
    val showCloudShadows: Boolean? = null,
    @SerializedName("cloudShadowIntensity")
    val cloudShadowIntensity: Double? = null,
    @SerializedName("cloudShadowSize")
    val cloudShadowSize: Double? = null,
    @SerializedName("showLeavesEffect")
    val showLeavesEffect: Boolean? = null,
    @SerializedName("leavesIntensity")
    val leavesIntensity: Double? = null,
    @SerializedName("leavesSize")
    val leavesSize: Double? = null,
    @SerializedName("showTreesEffect")
    val showTreesEffect: Boolean? = null,
    @SerializedName("treesIntensity")
    val treesIntensity: Double? = null,
    @SerializedName("treesSize")
    val treesSize: Double? = null,
    @SerializedName("showLightningEffect")
    val showLightningEffect: Boolean? = null,
    @SerializedName("showNightMistEffect")
    val showNightMistEffect: Boolean? = null,
    @SerializedName("nightMistIntensity")
    val nightMistIntensity: Double? = null,
    @SerializedName("ambientWindDeg")
    val ambientWindDeg: Double? = null,
    @SerializedName("ambientWindStrength")
    val ambientWindStrength: Double? = null,
    @SerializedName("spatialAnimSpeed")
    val spatialAnimSpeed: Double? = null,
)

data class LatLngData(
    val lat: Double = 0.0,
    val lng: Double = 0.0,
)

data class SectionEducationData(
    val summary: String? = null,
    @SerializedName("referenceImageUrl")
    val referenceImageUrl: String? = null,
)

data class WebSectionColorsData(
    @SerializedName("webFill")
    val webFill: String? = null,
    @SerializedName("webFillLight")
    val webFillLight: String? = null,
)

/** Sección del parque editada en web-admin (`sections` en config). */
data class ParkSectionRecordData(
    val id: String? = null,
    val code: String? = null,
    val name: String = "",
    @SerializedName("chartColor")
    val chartColor: String? = null,
    @SerializedName("fillOpacity")
    val fillOpacity: Double? = null,
    @SerializedName("fillOpacityLight")
    val fillOpacityLight: Double? = null,
    val colors: WebSectionColorsData? = null,
    val education: SectionEducationData? = null,
    val polygon: List<LatLngData>? = null,
)

data class SpatialSpriteSheetData(
    val url: String? = null,
    @SerializedName("frameWidth")
    val frameWidth: Int = 0,
    @SerializedName("frameHeight")
    val frameHeight: Int = 0,
    @SerializedName("frameCount")
    val frameCount: Int = 1,
    val fps: Int? = null,
    val columns: Int? = null,
)

/** Referencia espacial publicada (`spatialReferences` en config). */
data class SpatialReferenceData(
    val id: String = "",
    val name: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val category: String = "paisaje",
    val icon: String? = null,
    val animation: String? = null,
    val summary: String? = null,
    val education: SectionEducationData? = null,
    val visible: Boolean? = true,
    @SerializedName("markerStyle")
    val markerStyle: String? = null,
    @SerializedName("imageUrl")
    val imageUrl: String? = null,
    @SerializedName("spriteSheet")
    val spriteSheet: SpatialSpriteSheetData? = null,
    @SerializedName("displaySize")
    val displaySize: Double? = null,
)

data class OffsetXYData(
    val x: Double = 0.0,
    val y: Double = 0.0,
)

data class LayerOffsetsData(
    val boundary: OffsetXYData? = null,
    val sections: OffsetXYData? = null,
    val markers: OffsetXYData? = null,
)
