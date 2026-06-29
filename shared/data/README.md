# Datos compartidos del parque — fuente única

Geometría y metadatos del **Parque de las Culturas y la Madre Tierra** consumidos por web, móvil y API.

| Archivo | Descripción |
|---------|-------------|
| `park-boundary.json` | Polígono `{ lat, lng }[]` (113 puntos) |
| `park-boundary.geojson` | Mismo límite en GeoJSON (WGS84) |
| `park-sections.json` | 4 secciones con polígonos, colores web y `chartColor` |
| `park-pois.json` | POIs por defecto del parque |
| `park-coordinates.csv` | Export legacy / referencia |
| `database-model.mmd` | Diagrama ER |

## Regenerar tras editar el mapa web

```bash
node scripts/export-park-shared-data.mjs
```

> **Nota:** Solo **3 secciones** activas: Tierras Altas, Medias y Bajas. La geometría vive en `shared/data/*.json`.

## Consumidores

| App | Cómo carga |
|-----|------------|
| **Web admin** | Import en `apps/web-admin/.../map/data/park-geometry.ts` |
| **Android** | Assets desde `shared/data/` (`ParkDataLoader`) |
| **Backend** | `GET /api/config/park-data` (`shared/data/parkData.js`) |

## Map config API

Stickers, zoom, rotación y estado del editor siguen en `map_configurations` (JSONB). **Solo la geometría base** vive aquí.
