# Auditoría práctica del proyecto PCyMT RM

> **Última revisión:** Junio 2026  
> **Alcance:** frontend web → backend API → app móvil Android  
> **Propósito:** estado real del monorepo, fortalezas, deuda técnica y prioridades. Complementa [`AGENTS.md`](../AGENTS.md) (referencia técnica) y [`frontend-ui-guide.md`](frontend-ui-guide.md) (convenciones UI).

---

## 1. Objetivo del producto (qué debería ser)

**Visión:** juego educativo en el Parque de las Culturas y la Madre Tierra (La Paz). Los visitantes descubren animales 3D con AR en el parque real; los administradores gestionan contenido, ubicaciones y estadísticas.

**Roles esperados:**

| Rol | Canal | Responsabilidad |
|-----|-------|-----------------|
| **Visitante** | App Android | Explorar, ver animales en AR, registrar progreso |
| **Admin / moderador** | Panel web (+ móvil legacy) | CRUD de animales, puntos de anclaje, mapa, analytics |

**Flujo de datos central:**

```
VirtualAsset (3D + icono)
    └── Location / AnchorPoint (GPS + anchor_code ARCore opcional)
            └── Interaction (view/click/scan… por usuario)
                    └── Analytics + progreso en Colección móvil

MapConfiguration (JSON global) ← editado en web → consumido en ParkMapView móvil
Session (web/mobile) → estadísticas de acceso
User (avatar_url, role) → perfil + permisos
```

**Despliegue actual (2026):**

| Componente | URL / destino |
|------------|---------------|
| Backend | `https://pcymt-rm-api.vercel.app` (serverless + PostgreSQL cloud) |
| Frontend admin | `https://pcymt-rm-web.vercel.app` |
| Uploads | Híbrido: `shared/uploads` local + Supabase en producción (lectura) |
| Mobile | APK firmado; `BASE_URL` apunta al API en línea |

---

## 2. Frontend web (`apps/web-admin`)

### Qué está bien

- **Arquitectura moderna:** Angular 21 standalone, lazy loading, guards/interceptors funcionales, container/presentation.
- **Panel admin completo:** dashboard KPIs, CRUD usuarios/assets/anchors, mapa canvas avanzado, animator 3D, 5 vistas de stats, settings (tema, idioma, avatar).
- **Integración API:** `ApiRoutesService` centralizado; interceptors JWT + errores.
- **UX reciente (Fases 1–3):** tokens semánticos, i18n parcial EN/ES, skip-link, reduced-motion, empty states, sidenav con `routerLink`.
- **Mapa del parque:** diferenciador real (stickers, capas, tile painting, config global) — no es un stub.

### Qué está mal o incompleto

| Problema | Impacto | Estado (Jun 2026) |
|----------|---------|-------------------|
| ~~Sin guard de rol~~ | — | ✅ `StaffGuard` + backend `staffOnly` |
| **i18n a medias** | Tablas anchor/asset, resto del mapa | Parcial: map config, animator, dashboard/stats |
| ~~Código muerto~~ | — | ✅ `TableControl`, `tilemap-editor`, Room/tiles móvil |
| ~~Chart.js global~~ | — | ✅ Lazy en dashboard/stats |
| **SSR sin uso en prod** | Complejidad de build | Sin cambio (Vercel estático) |
| **Branding mixto** | Copy inconsistente | Parcial: Juku Go en móvil |
| **Animación 3D save** | Endpoint posiblemente faltante | Pendiente verificar |
| **Tests** | Cobertura baja | Sin cambio en este milestone |

### Qué cambiar (priorizado)

1. ~~**AdminGuard**~~ — hecho (`StaffGuard`).
2. **Terminar i18n** en anchor-table y strings restantes del mapa.
3. ~~**Lazy-load Chart.js**~~ — hecho.
4. ~~**Eliminar dead code**~~ — hecho (web + móvil).
5. **Verificar** endpoint animation-sequence en backend o quitar UI de guardado.
6. **PWA:** reconsiderar service worker en panel admin interno.

Ver [`reengineering-plan.md`](reengineering-plan.md) para el checklist completo de fases 1–6.

---

## 3. Backend API (`apps/backend`)

### Qué está bien

- **Stack sólido:** Express, Sequelize, Joi, JWT, bcrypt, rate limiting, Helmet, soft delete usuarios.
- **Adaptación Vercel:** pool serverless, `ensureDB`, health sin bloquear config, redirect archivos grandes a Supabase.
- **Avatares predefinidos:** whitelist segura (`predefinedAvatars.js`, `PATCH .../avatar`).
- **API pública config:** Google IDs, avatars, flags storage para mobile/web.
- **Tests unitarios** en validators, utils, UserService; smoke e integración existentes.

### Qué está mal o incompleto

| Problema | Impacto | Dónde |
|----------|---------|-------|
| **RBAC casi ausente** | Usuario `user` puede CUD assets, analytics, config | Controllers sin `adminOnly` |
| **Uploads en Vercel** | Multer escribe disco efímero; no persiste | `FileUploadService` |
| **“Hexagonal” exagerado** | Docs prometen ports/adapters; es layered monolith | Estructura `domain/` acoplada a Sequelize |
| **Código muerto** | Redis cache sin `ioredis`; `express-session` sin uso | `cache/`, `package.json` |
| **Config runtime en disco** | `runtime-config.json` no persiste en serverless | `config.controller.js` |
| **Tests desactualizados** | Rutas `/api/v1/`, campo `username` | `tests/integration/auth.test.js` |
| **Avatares path mismatch** | Script Supabase `avatars/` vs código `model-icons/` | `upload-avatars-supabase.js` |
| **JWT en query** | Necesario para `<img>` pero riesgo logs/referrer | `/api/files/?token=` |

### Qué cambiar (priorizado)

1. **Middleware `adminOnly`** en users list, analytics, virtual-assets CUD, anchor-points CUD, config PUT.
2. **Upload directo a Supabase** (o deshabilitar upload en Vercel y documentar flujo manual).
3. **Alinear rutas de avatares** y tests de integración con API real.
4. **Mover config mutable** (TTL cloud anchors) a tabla BD, no filesystem.
5. **Limpiar** Redis/session dead code o implementar Redis de verdad.
6. **Guard `PUT /users/:id`** — solo self o admin (como `setAvatar`).

---

## 4. App móvil Android (`apps/mobile-android`)

### Qué está bien

- **Tres modos AR** con sentido de producto: RM (cloud anchors), Juku Go (mapa+cámara), RA simple (fallback).
- **ParkMapView custom** — GPS, brújula, stickers, POIs; sin dependencia de Google Maps.
- **Networking robusto:** refresh token, retry, Glide autenticado, `ImageUrlHelper`.
- **AR maduro:** `RemoteAnchorResolver`, batching optimizado, compatibilidad dispositivos curada.
- **Perfil reciente:** picker avatares desde `/api/config`, alineado con backend/web.
- **Monorepo:** stickers sincronizados desde `shared/map-stickers/`.

### Qué está mal o incompleto

| Problema | Impacto | Dónde |
|----------|---------|-------|
| **Admin en APK visitante** | Colocar anclas, guardar mapa duplica web | `ArFragment`, `DashboardFragment`, `StickerManager` |
| **Fragmentos gigantes** | Mantenimiento difícil | `ParkMapView` ~1956 LOC, `ArFragment` ~1432 |
| **README desactualizado** | Dice Compose + Clean Architecture | `README.md` vs ViewBinding real |
| **Código muerto** | `ArUnsupportedFragment`, `TileMapView` sin UI | navigation vs `MainActivity` |
| **Tres nombres AR** | “Realidad Mixta”, “Juku Go”, “RA” confunden | strings, bottom nav |
| **Hilt a medias** | Repos usan singletons; tests rotos | `LocationRepositoryTest` |
| **Mapa duplicado vs web** | Misma lógica GPS/polígono en dos codebases | `ParkMapView` vs Angular map |
| **Offline limitado** | Room tiles sin sync desde UI | `MapSyncManager` |
| **Tests móvil** | 6 unit tests; sin profile/AR map | `app/src/test/` |

### Qué cambiar (priorizado)

1. **Producto:** decidir si admin móvil se mantiene — si no, quitar hosting de anclas y save map en app.
2. **UX visitante:** CTA claro hacia RM en dispositivos compatibles; unificar naming AR.
3. **Eliminar o conectar** `ArUnsupportedFragment`, pipeline `TileMapView`.
4. **Actualizar README** móvil (ViewBinding, MVVM parcial, sin Compose).
5. **Extraer** lógica de `ParkMapView` / `ArFragment` a use cases o managers más pequeños.
6. **Tests:** arreglar constructores inyectables; smoke test avatar + login.

---

## 5. Entrelazado cross-stack (fortalezas y grietas)

### Bien conectado

- **Auth JWT** compartido web + mobile (Google OAuth dual client ID).
- **Virtual assets + locations** — mismo modelo; mobile resuelve GLB vía API autenticada.
- **Map config global** — web guarda, mobile carga (`MapConfigurationRepository`).
- **Interacciones** — mobile registra; web analytics consume.
- **Avatares** — catálogo en config API; web settings + mobile profile.

### Grietas

| Grieta | Consecuencia |
|--------|--------------|
| Seguridad solo en “confianza del cliente” | Rol `user` accede panel web completo |
| Mapa implementado 2 veces | Bug de coordenadas/stickers puede divergir |
| Uploads write local / read Supabase | Nuevos GLB en prod pueden fallar silenciosamente |
| Legacy naming (`animalModelId`, `AnchorPoint` vs `Location`) | Onboarding dev más lento |
| Documentación vs código | IA y humanos toman decisiones erróneas |

---

## 6. Matriz de mejoras por dimensión

### Producto y UX

- Separar **app visitante** vs **app staff** (o flavor Android) vs **web admin**.
- Definir **un solo camino AR** para visitante: ¿Juku Go o RM como primario?
- Gamificación: progreso en Colección está bien; falta recompensa/narrativa educativa visible.
- Web admin: dashboard es analytics, no “juego” — correcto; no mezclar copy de visitante en login.

### Diseño visual

- **Web:** M3 violet/rose es genérico Google — considerar paleta inspirada en ecosistemas bolivianos (tierras altas/medias/bajas) ya parcialmente en `--semantic-section-*`.
- **Mobile vs web:** identidades visuales no unificadas (Material web vs tema oscuro mapa móvil).
- **Consistencia iconografía:** web ya migra emojis → Material; terminar en `sticker-panel`.

### Arquitectura

- Backend: renombrar mentalmente a **“layered + DI”**, no hexagonal.
- Mobile: **MVVM honesto** — ViewModels más gordos, fragments más delgados.
- Shared: extraer **contrato de mapa** (GeoJSON boundary, section colors) a `shared/data/` JSON único.

### Seguridad

- RBAC backend + guards frontend.
- Revisar endpoints de enumeración (`check-email`, `verify-password`).
- Rotación refresh tokens / logout global ya existe parcialmente.

### DevOps y datos

- Pipeline CI que ejecute tests backend + frontend (integración actualmente stale).
- Script único: seed + upload Supabase + verify URLs.
- Variables de entorno documentadas por entorno (local / Vercel / APK release).

### Testing

- Backend: controllers críticos (auth, files, config, avatar).
- Frontend: smoke e2e Playwright opcional para login + list users.
- Mobile: ViewModels existentes + ProfileViewModel avatar.

### Documentación

- `AGENTS.md` — referencia técnica (mantener).
- Este archivo — **auditoría y prioridades** (actualizar cada milestone).
- `agents-*.md` — índices por app, no duplicar AGENTS.md entero.
- README móvil — corregir stack declarado.

---

## 7. Prioridades sugeridas (roadmap corto)

| # | Acción | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | ~~AdminGuard web + staffOnly backend~~ | — | ✅ Hecho |
| 2 | ~~Upload Supabase end-to-end~~ | — | ✅ Hecho |
| 3 | Producto visitante (onboarding, Juku Go) | — | ✅ Hecho |
| 4 | ~~Limpiar código muerto~~ | — | ✅ Hecho |
| 5 | i18n restante + tests integración | Medio | Medio |
| 6 | Refactor fragments móvil grandes | Alto | Medio |
| 7 | Identidad visual ecosistemas | Medio | Medio |

---

## 8. Documentos relacionados

| Documento | Uso |
|-----------|-----|
| [`reengineering-plan.md`](reengineering-plan.md) | Checklist fases 1–6 |
| [`AGENTS.md`](../AGENTS.md) | Endpoints, tablas, rutas, convenciones |
| [`frontend-ui-guide.md`](frontend-ui-guide.md) | Tokens UI, a11y, i18n web |
| [`architecture/overview.md`](architecture/overview.md) | Diagrama general |
| [`docs/ar/mixed-reality.md`](ar/mixed-reality.md) | Flujos AR / cloud anchors |
