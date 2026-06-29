# Sincronización mapa web → app móvil

El panel web **diseña** el mapa; la app móvil **muestra el resultado publicado** (sin herramientas de edición).

Flujo: admin guarda → `PUT /api/map-configurations/global` → visitante carga con `GET /api/map-configurations/global`.

---

## Fase 1 — Suelo y árboles (implementada)

**Objetivo:** Lo que el admin configura en **Suelo** y **Árboles** se ve en `ParkMapView`.

| Dato en `config_data` | Uso en móvil |
|----------------------|--------------|
| `mapState.showGroundTextures` | Activa capas de suelo procedural |
| `groundStyle` | Elementos por zona (-2…2) |
| `groundSettings` | Preset, calidad, LOD, tamaño de grano |
| `ambientTrees` | Árboles cartoon por capa |
| `ambientScene.treesSize` | Escala de árboles (si existe) |
| `themeMode` | Tema claro/oscuro del mapa |

**No incluye:** editores, marcadores de colocación, banners, offsets de capas admin.

---

## Fase 2 — Escena ambiental (implementada)

**Objetivo:** Efectos de **Ambiente → Escena** publicados desde web-admin.

| Dato | Efecto |
|------|--------|
| `ambientScene.showRainEffect` + intensidad/tamaño/zona | Lluvia |
| `showFogEffect`, `showMotesEffect`, `showLeavesEffect` | Niebla, motes, hojas |
| `showCloudShadows`, `showLightningEffect`, `showNightMistEffect` | Sombras, relámpago, bruma |
| `showTreesEffect` | Interruptor visitante para árboles publicados |
| `activeScenarioId` + viento | Escenarios predefinidos + tinte |

**Implementación móvil:** `MapFogEffect`, `MapMotesEffect`, `MapCloudShadowEffect`, `MapLeavesEffect`, `MapLightningEffect`, `MapNightMistEffect` + `AmbientScenarioTints` integrados en `ParkMapView` vía `MapConfigVisuals.applyToParkMap()`.

---

## Fase 3 — Contenido editorial completo (implementada)

**Objetivo:** Paridad del mapa publicado (sin herramientas de edición).

| Dato | Uso en móvil |
|------|--------------|
| `sections` (polígonos editados) | Sustituyen `park-sections.json` en `ParkMapView` |
| `spatialReferences` | `PoiOverlayManager` (posiciones, categoría, animación) |
| `stickers` / `stickerLayers` | `StickerManager` (ya soportado si vienen en config) |
| `poiPositions`, `layerOffsets` | Overrides de posición POI y alineación de capas |
| `mapState` | Zoom, rotación, offsets y visibilidad visitante (sin grid/boundary admin) |

**Implementación:** `PublishedParkMapper`, `MapConfigVisuals.applyToParkMap()` (fases 1–3), `ParkMapView.applyPublishedSections()` + `applyPublishedLayerOffsets()`.

---

## Guardar desde el admin

En el mapa web: **Sistema → Guardar capas** (o equivalente). Eso hace `upsertGlobal` con `exportMapPersistedState()`.

La app recarga al abrir el tab Mapa (`DashboardFragment`) o el mapa AR (`ArMapFragment`).
