package com.univalle.pedrochacolla.utils.map

import android.content.Context
import com.univalle.pedrochacolla.data.model.MapConfigData
import com.univalle.pedrochacolla.data.model.MapLayerFramesData
import com.univalle.pedrochacolla.ui.dashboard.ParkMapView
import com.univalle.pedrochacolla.ui.dashboard.PoiOverlayManager

/** Aplica el mapa publicado desde web-admin (fases 1–3). */
object MapConfigVisuals {

    fun applyToParkMap(
        view: ParkMapView,
        data: MapConfigData,
        poiOverlay: PoiOverlayManager? = null,
        context: Context? = null,
    ) {
        applyVisitorMapState(view, data)
        data.themeMode?.let { view.setDarkTheme(it == "dark") }

        val groundStyle = MapGroundRenderer.parseGroundStyle(data.groundStyle)
        val trees = data.ambientTrees.orEmpty()
        val showGround = data.effectiveShowGroundTextures
        val showTrees = trees.isNotEmpty() && (data.ambientScene?.showTreesEffect != false)
        val treesSize = (data.ambientScene?.treesSize ?: 1.0).toFloat().coerceIn(0.08f, 2.5f)
        view.setPublishedMapVisuals(
            showGroundTextures = showGround,
            showPublishedTrees = showTrees,
            groundStyle = groundStyle,
            groundSettings = data.groundSettings,
            ambientTrees = trees,
            treesSizeMul = treesSize,
        )
        view.applyPublishedSections(data.sections)
        view.applyPublishedLayerOffsets(data.layerOffsets)
        applyPublishedLayerFrames(view, data)
        data.ambientScene?.let { view.applyPublishedAmbientScene(it) }

        if (poiOverlay != null && context != null) {
            applySpatialReferences(poiOverlay, data, context)
        }
    }

    private fun applyPublishedLayerFrames(view: ParkMapView, data: MapConfigData) {
        if (data.layerFrames != null) {
            view.applyPublishedLayerFrames(data.layerFrames)
            return
        }
        val sections = data.layerOffsets?.sections
        if (sections != null) {
            view.applyPublishedLayerFrames(
                MapLayerFramesData(
                    mapPlate = com.univalle.pedrochacolla.data.model.LayerFrameTransformData(
                        x = sections.x.toFloat(),
                        y = sections.y.toFloat(),
                    ),
                    zones = com.univalle.pedrochacolla.data.model.LayerFrameTransformData(
                        x = sections.x.toFloat(),
                        y = sections.y.toFloat(),
                    ),
                ),
            )
        }
    }

    /** Estado de vista visitante (zoom, capas admin ocultas). */
    fun applyVisitorMapState(view: ParkMapView, data: MapConfigData) {
        view.setMapState(
            ParkMapView.MapState(
                scale = data.effectiveScale,
                rotation = data.effectiveRotation,
                offsetX = data.effectiveOffsetX,
                offsetY = data.effectiveOffsetY,
                showGrid = data.effectiveShowGrid,
                showBoundary = false,
                showSections = data.effectiveShowSections,
                showLabels = data.effectiveShowLabels,
            ),
        )
    }

    private fun applySpatialReferences(
        poiOverlay: PoiOverlayManager,
        data: MapConfigData,
        context: Context,
    ) {
        val refs = data.spatialReferences
        if (!refs.isNullOrEmpty()) {
            poiOverlay.poiItems = PublishedParkMapper.toPoiItems(
                refs,
                context.resources,
                context.packageName,
            )
        }
        data.poiPositions?.let { positions ->
            poiOverlay.loadDynamicPositions(
                positions.associate { it.id to Pair(it.lat, it.lng) },
            )
        }
        val showRefs = data.ambientScene?.showSpatialReferences
            ?: data.poiVisible
            ?: refs?.isNotEmpty()
        showRefs?.let { poiOverlay.setOverlayVisible(it) }
    }
}
