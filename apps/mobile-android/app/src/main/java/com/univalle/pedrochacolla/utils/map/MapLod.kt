package com.univalle.pedrochacolla.utils.map

import com.univalle.pedrochacolla.data.model.GroundMapSettingsData

/** LOD del mapa — port de `map-lod.ts` y umbrales de `ground-preset.ts`. */
object MapLod {
    enum class Tier { ALL, MEDIUM, COARSE, MINIMAL }

    enum class TreeLayer { ZONE, BASE_PARK, BACKDROP }

    enum class AmbientEffectKind {
        RAIN, FOG, MOTES, CLOUD_SHADOWS, LEAVES, LIGHTNING, NIGHT_MIST,
    }

    private const val DEFAULT_FINE_ZOOM = 0.95
    private const val DEFAULT_MEDIUM_ZOOM = 0.55
    private const val DEFAULT_ECOTONE_ZOOM = 0.35

    private val FINE_ELEMENT_TYPES = setOf(
        "stone", "pebbles", "flower", "petal", "crack", "dirt", "reed",
    )

    fun groundLodTier(mapScale: Float, settings: GroundMapSettingsData?): Tier {
        if (settings?.lodEnabled == false) return Tier.ALL
        val fine = (settings?.lodFineZoom ?: DEFAULT_FINE_ZOOM).toFloat()
        val medium = (settings?.lodMediumZoom ?: DEFAULT_MEDIUM_ZOOM).toFloat()
        val ecotone = (settings?.lodEcotoneZoom ?: DEFAULT_ECOTONE_ZOOM).toFloat()
        if (mapScale < ecotone * 0.85f) return Tier.MINIMAL
        if (mapScale < medium) return Tier.COARSE
        if (mapScale < fine) return Tier.MEDIUM
        return Tier.ALL
    }

    fun effectiveGroundLodTier(mapScale: Float, settings: GroundMapSettingsData?): Tier =
        groundLodTier(mapScale, settings)

    fun elementVisibleAtLod(type: String, tier: Tier): Boolean = when (tier) {
        Tier.ALL -> true
        Tier.MINIMAL -> type == "patch"
        Tier.COARSE -> type == "patch" || type == "shadow"
        Tier.MEDIUM -> type !in FINE_ELEMENT_TYPES
    }

    fun treesLayerVisibleAtLod(
        layer: TreeLayer,
        mapScale: Float,
        settings: GroundMapSettingsData?,
    ): Boolean {
        val tier = groundLodTier(mapScale, settings)
        return when (tier) {
            Tier.ALL -> true
            Tier.MINIMAL -> false
            Tier.COARSE -> layer == TreeLayer.BACKDROP
            Tier.MEDIUM -> layer != TreeLayer.ZONE
        }
    }

    fun markersVisibleAtLod(mapScale: Float, settings: GroundMapSettingsData?): Boolean {
        val tier = groundLodTier(mapScale, settings)
        return tier == Tier.ALL || tier == Tier.MEDIUM
    }

    fun markerLabelsVisibleAtLod(mapScale: Float, settings: GroundMapSettingsData?): Boolean =
        groundLodTier(mapScale, settings) == Tier.ALL

    fun spatialRefsVisibleAtLod(mapScale: Float, settings: GroundMapSettingsData?): Boolean =
        groundLodTier(mapScale, settings) != Tier.MINIMAL

    fun sectionLabelsVisibleAtLod(mapScale: Float, settings: GroundMapSettingsData?): Boolean =
        groundLodTier(mapScale, settings) == Tier.ALL

    fun ambientEffectVisibleAtLod(
        kind: AmbientEffectKind,
        mapScale: Float,
        settings: GroundMapSettingsData?,
    ): Boolean {
        val tier = groundLodTier(mapScale, settings)
        if (tier == Tier.ALL) return true
        if (tier == Tier.MINIMAL) return false
        if (tier == Tier.COARSE) {
            return kind == AmbientEffectKind.FOG
                || kind == AmbientEffectKind.CLOUD_SHADOWS
                || kind == AmbientEffectKind.NIGHT_MIST
        }
        return kind != AmbientEffectKind.MOTES && kind != AmbientEffectKind.LEAVES
    }

    fun ambientLodIntensityMul(mapScale: Float, settings: GroundMapSettingsData?): Float =
        when (groundLodTier(mapScale, settings)) {
            Tier.ALL -> 1f
            Tier.MEDIUM -> 0.82f
            Tier.COARSE -> 0.55f
            Tier.MINIMAL -> 0f
        }
}
