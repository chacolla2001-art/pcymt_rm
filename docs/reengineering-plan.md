# Plan de reingeniería PCyMT RM

> Seguimiento de las 8 fases acordadas (Junio 2026). Detalle en [`project-audit.md`](project-audit.md).

## Fase 1 — Seguridad y roles ✅

- [x] `staffOnly` / guards backend en rutas sensibles
- [x] `StaffGuard` web + `/access-denied`
- [x] Google login web bloquea rol `user`

## Fase 2 — Producto visitante móvil ✅

- [x] Onboarding 3 pantallas
- [x] Geofence suave + copy Juku Go
- [x] Nav “Explorar” y CTA principal

## Fase 3 — Datos compartidos del parque ✅

- [x] `shared/data/*.json` (boundary, sections, POIs)
- [x] Loaders web, Android y `GET /api/config/park-data`
- [x] Script `scripts/export-park-shared-data.mjs`

## Fase 4 — Producción (archivos + deploy) ✅

- [x] `HybridStorageService` + Supabase uploads
- [x] Tabla `app_settings` (TTL Cloud Anchors)
- [x] `docs/content-pipeline.md`

## Fase 5 — Podar código y docs ✅

- [x] Web: eliminar `TableControl`, `tilemap-editor`
- [x] Móvil: eliminar Room/tiles sync, `ArUnsupportedFragment`, `TileMapView`
- [x] Backend: quitar `express-session` sin uso
- [x] README móvil corregido (Fragments, no Compose)
- [x] Actualizar `project-audit.md`

## Fase 6 — Admin web (mantener, no inflar) ✅

- [x] Chart.js lazy en dashboard + stats (no global en `app.config`)
- [x] i18n: botones Guardar/Cargar en `sticker-panel`
- [x] i18n: `model-animator` (EN/ES)
- [x] Sin Map3D, PWA agresiva ni features extra

## Fase 7 — Calidad y CI ✅

- [x] Tests integración RBAC (`tests/integration/api-rbac.test.js`, rutas `/api/*`)
- [x] Unit tests alineados (user schema/service)
- [x] CI: migrate + `npm test` backend; frontend build; Android test + APK
- [x] Smoke manual documentado (`docs/smoke-test.md`)

## Fase 8 — Identidad y pulido ✅

- [x] Franja ecosistemas en sidenav web (`--semantic-section-*`)
- [x] Colores sección móvil + splash API 31
- [x] Copy educativo post-encuentro (bottom sheet)
- [x] i18n `anchor-table` (EN/ES)
- [x] `docs/memoria-arquitectura.md` para TFG

## Pendiente manual (prod)

- [ ] `npm run db:migrate` en backend desplegado
- [ ] Verificar `SUPABASE_SERVICE_ROLE_KEY` en Vercel
- [ ] `npm install` en backend tras quitar `express-session`

## Próximos candidatos (fuera del plan)

- i18n restante: virtual-asset-table, más strings del mapa
- Tests E2E Playwright (login + list users)
- Refactor fragments AR grandes
