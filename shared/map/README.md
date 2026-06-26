# Mapa del parque — lógica compartida

| Archivo | Uso |
|---------|-----|
| `park-map-core.mjs` | `isPointInPolygon`, `polygonCentroid`, `findSectionAtPoint`, leyenda P0 |
| `../data/park-sections.json` | 3 ecosistemas (sin Mitos y Leyendas) |
| `../data/park-pois.json` | POIs por defecto |

**Consumidores**

- **Web:** `apps/web-admin/.../map/utils/park-map.util.ts` importa `park-map-core.mjs`
- **Android:** `ParkSectionResolver.kt` — misma lógica; mantener en sync al cambiar el `.mjs`
- **Datos:** `shared/data` copiado a web `map/data/` y assets Gradle del móvil
