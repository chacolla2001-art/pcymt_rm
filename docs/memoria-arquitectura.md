# Memoria técnica — arquitectura real (TFG)

> Resumen alineado con el código en Junio 2026. Complementa [`AGENTS.md`](../AGENTS.md) y [`architecture/overview.md`](architecture/overview.md).

## Producto

| Canal | Usuario | Función |
|-------|---------|---------|
| **App Android (Juku Go)** | Visitante | Explorar parque, mapa, AR, colección 12 animales |
| **Panel web Angular** | Admin / moderador | CRUD, mapa editor, estadísticas, configuración |
| **API Node.js** | Ambos | REST + JWT, archivos autenticados, analytics |

No hay base de datos separada para visitantes: **RBAC** (`user` vs `admin`/`moderator`) sobre PostgreSQL único.

## Stack (lo que realmente corre)

```
┌─────────────────┐     ┌─────────────────┐
│  web-admin      │     │ mobile-android  │
│  Angular 21     │     │ Kotlin + Fragments │
│  ViewBinding N/A  │     │ ARCore / SceneView │
└────────┬────────┘     └────────┬────────┘
         │ REST + JWT            │
         └──────────┬────────────┘
                    ▼
         ┌──────────────────────┐
         │  apps/backend        │
         │  Express + Sequelize │
         │  (layered + DI)      │
         └──────────┬───────────┘
                    ▼
              PostgreSQL
         (+ Supabase Storage prod)
```

**No es hexagonal estricto:** capas api / domain / infrastructure con contenedor DI manual (`container.js`).

## Datos compartidos del parque

Geometría y metadatos en [`shared/data/`](../shared/data/):

- `park-boundary.json` / `.geojson`
- `park-sections.json` (4 ecosistemas + colores)
- `park-pois.json`

Consumidores: canvas web, `ParkMapView` móvil, `GET /api/config/park-data`.

## Seguridad

- JWT access + refresh; bcrypt en contraseñas.
- `StaffGuard` (web) + `staffOnly` / `adminOnly` (API).
- Archivos en `/api/files/` — no estáticos públicos.
- Rate limiting en auth y reset password.

## Realidad aumentada (3 modos)

1. **Mixta** — ARCore + Cloud Anchors (dispositivos compatibles).
2. **Mapa AR** — exploración estilo encuentros en mapa + cámara.
3. **AR simple** — Camera2 + SceneView (fallback universal).

## Despliegue

| Componente | Destino típico |
|------------|----------------|
| API | Vercel serverless + PostgreSQL cloud |
| Web admin | Vercel estático |
| Uploads prod | Supabase (`HybridStorageService`) |
| APK | Firma local / distribución Mi Teleférico |

## Calidad

- Tests unitarios backend (Jest) + integración RBAC (`tests/integration/api-rbac.test.js`).
- CI: GitHub Actions (backend, frontend build, Android test + APK debug).
- Smoke manual: [`smoke-test.md`](smoke-test.md).

## Identidad visual

Cuatro ecosistemas del parque comparten paleta entre web (`--semantic-section-*`) y móvil (`section_*` colors): Tierras Altas, Medias, Bajas, Mitos y Leyendas.

## Evolución post-TFG (candidatos)

- i18n completo tablas CRUD restantes.
- Refactor fragments AR grandes.
- Tests E2E Playwright en panel web.
