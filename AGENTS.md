# agents.md — Contexto completo del proyecto PCyMT RM

> **Propósito:** Este archivo proporciona a cualquier asistente de IA el contexto completo del proyecto para que pueda entender la arquitectura, dominio, convenciones y relaciones entre componentes sin necesidad de explorar cada archivo individualmente.
>
> **Última actualización:** Marzo 2026
>
> **Estructura monorepo:** `apps/backend`, `apps/web-admin`, `apps/mobile-android`, `tools/cloud-anchor-cli`, `shared/`

---

## 1. Visión General del Proyecto

**Nombre:** PCyMT RM — Plataforma de Conservación y Mitigación del Tráfico de Especies con Realidad Mixta

**Cliente:** Mi Teleférico — Parque de las Culturas y la Madre Tierra (La Paz, Bolivia)

**Descripción:** Sistema de juego educativo con realidad aumentada/mixta ambientado en un parque temático. Los **administradores** colocan modelos 3D de animales en ubicaciones georreferenciadas dentro de las distintas áreas del parque. Los **visitantes** ingresan al parque con la app móvil y buscan/descubren estos animales usando la cámara de su celular con realidad aumentada (AR) y realidad mixta (cloud anchors de ARCore). El frontend web sirve como panel de administración para gestionar contenido, estadísticas y configuración del mapa.

**Autor:** Pedro Chacolla Rybak — Universidad del Valle  
**Repositorio:** https://github.com/Rybak2001/pcymt_rm  
**Versión:** 2.0.0 (Marzo 2026)

---

## 2. El Parque — Contexto de Dominio

El **Parque de las Culturas y la Madre Tierra** es un parque temático operado por Mi Teleférico en La Paz, Bolivia. Está dividido en 4 secciones geográficas que representan los ecosistemas bolivianos:

| Sección | Código | Descripción |
|---------|--------|-------------|
| **Tierras Altas** | 1 | Zona noroeste — Altiplano, bosques nublados andinos |
| **Tierras Medias** | 2 | Zona central — Valles interandinos |
| **Tierras Bajas** | 3 | Zona sureste — Selva amazónica, llanos orientales |
| **Mitos y Leyendas** | 4 | Zona especial — Criaturas mitológicas andinas |

**Coordenadas GPS del parque:** Lat [-16.4921, -16.4866], Lng [-68.1469, -68.1446]

### Puntos de Interés (POI) del parque
Ingreso, Boleterías, Chiwiña, Cafetería, Teatro Galpón, Aguas Danzantes, Mirador, Escenario Principal, Anfiteatro, Parrillero, Área de Picnik.

### Los 12 Animales del Parque (Datos Iniciales)

| Animal | Nombre Científico | Categoría | Sección | Archivo 3D |
|--------|-------------------|-----------|---------|------------|
| Oso Andino | Tremarctos ornatus | Mamífero | Tierras Altas | bear.glb |
| Toro | Bos taurus | Mamífero | Tierras Medias | cattle.glb |
| Gallina | Gallus gallus domesticus | Ave | Tierras Medias | chicken.glb |
| Vaca Lechera | Bos taurus | Mamífero | Tierras Medias | cow.glb |
| Perro Criollo | Canis lupus familiaris | Mamífero | Tierras Medias | dog.glb |
| Caballo Criollo | Equus ferus caballus | Mamífero | Tierras Medias | horse.glb |
| Jaguar | Panthera onca | Mamífero | Tierras Bajas | leopard.glb |
| Lagarto Tegu | Salvator merianae | Reptil | Tierras Bajas | lizard.glb |
| Sirena del Titicaca | Mythologica lacustris | Mito | Mitos y Leyendas | mermaid.glb |
| Chancho Criollo | Sus scrofa domesticus | Mamífero | Tierras Bajas | pig.glb |
| Puma | Puma concolor | Mamífero | Tierras Altas | tiger.glb |
| Víbora Cascabel | Crotalus durissus | Reptil | Tierras Bajas | viper.glb |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────┐         ┌─────────────────────┐
│   Frontend Web      │         │   Mobile App        │
│   Angular 21        │         │   Kotlin + ARCore   │
│   localhost:4200    │         │   Android Device    │
│   (Panel Admin)     │         │   (Visitantes)      │
└──────────┬──────────┘         └──────────┬──────────┘
           │ HTTP/REST + JWT               │ HTTP/REST + JWT
           └───────────┬───────────────────┘
                       ▼
           ┌───────────────────────┐
           │   Backend API         │
           │   Node.js + Express   │
           │   localhost:5000      │
           └───────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │PostgreSQL│  │  Redis   │  │ Google   │
  │ Database │  │ (Opc.)   │  │ APIs     │
  └──────────┘  └──────────┘  └──────────┘
```

### 3 Componentes Principales

| Componente | Directorio | Tecnología | Rol |
|------------|------------|------------|-----|
| **Backend API** | `apps/backend/` | Node.js 24 + Express 4 + Sequelize 6 + PostgreSQL | API REST, auth, lógica de negocio |
| **Frontend Web** | `apps/web-admin/` | Angular 21.1.2 + Material 21 + Tailwind 3.4 + Three.js 0.182 | Panel de administración |
| **App Móvil** | `apps/mobile-android/` | Kotlin 2.1 + ARCore 1.48 + SceneView 2.3 + Hilt 2.52 | App para visitantes (AR) |
| **Uploads** | `shared/uploads/` | Archivos estáticos | Modelos 3D (.glb), iconos (.png), fotos de perfil |

---

## 4. Backend API — `apps/backend/`

### Arquitectura: Hexagonal (Ports & Adapters)

```
src/
├── api/                    # Capa de presentación
│   ├── controllers/        # Controladores HTTP (11 archivos)
│   ├── routes/v1/          # Rutas Express (11 archivos)
│   └── middlewares/        # Auth, CORS, rate limit, validación, timeout, sanitización (8 archivos)
├── domain/                 # Lógica de negocio
│   ├── services/           # 9 servicios de dominio
│   └── repositories/       # 7 repositorios (BaseRepository + 6 específicos)
├── infrastructure/         # Implementaciones técnicas
│   ├── database/           # Modelos Sequelize (6) + conexión
│   ├── cache/              # Redis (opcional)
│   └── external/           # Email, Google Auth, File Upload
├── shared/                 # Código compartido
│   ├── errors/             # AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError
│   ├── validators/         # Schemas Joi (7 archivos)
│   ├── utils/              # Cache en memoria, encryption, JWT, pagination, string, async, object, baseService (10 archivos)
│   └── constants/          # HTTP status codes, roles, system constants
└── config/                 # Container DI, env, configuración
```

### Base de Datos — 6 Tablas (PostgreSQL)

| Tabla | Modelo Sequelize | Descripción |
|-------|------------------|-------------|
| `users` | User | Usuarios (UUID PK, email, password_hash, role, soft delete con paranoid) |
| `virtual_assets` | VirtualAsset | Modelos 3D de animales (name, model_url, icon_url, category, habitat) |
| `locations` | Location (AnchorPoint) | Puntos georreferenciados (lat/lng, section, anchor_code, scale, rotation_y, FK→virtual_asset) |
| `sessions` | Session | Sesiones de usuario (platform: web/mobile, timestamps) |
| `interactions` | Interaction | Interacciones usuario-animal (type: view/click/scan/share/favorite/zoom/rotate, metadata JSONB) |
| `map_configurations` | MapConfiguration | Configuraciones de mapa guardadas (config_data JSONB, platform, is_public) |

**Relaciones:**
- User 1→N Session, User 1→N Interaction, User 1→N MapConfiguration
- VirtualAsset 1→N Location, VirtualAsset 1→N Interaction
- Location 1→N Interaction

### Servicios de Dominio

| Servicio | Métodos Clave |
|----------|---------------|
| **AuthService** | `login()`, `loginWithGoogle()`, `refreshToken()`, `forgotPassword()`, `logout()` |
| **UserService** | `getAll()`, `getAllPaginated()`, `create()`, `update()`, `delete()` (soft), `findOrCreateGoogleUser()`, `changePassword()`, `adminSetPassword()`, `verifyPassword()`, `emailExists()` |
| **VirtualAssetService** | `getAll()`, `getActive()`, `create()`, `update()`, `delete()`, `softDelete()`, `countActive()` |
| **AnchorPointService** | `getAll()`, `getActive()`, `getByVirtualAsset()`, `create()`, `update()`, `delete()`, `getInBounds()`, `getClusters()`. Normaliza secciones (1→"Tierras Altas", etc.) |
| **UserInteractionService** | `getAll()`, `getById()`, `getByUser()`, `create()`, `countByType()`, `getByVirtualAssetTimeSeries()`, `resetGameForUser()` |
| **UserSessionService** | `create()`, `endSession()`, `endAllUserSessions()`, `getActiveSessions()`, `getTimeSeries()` |
| **AnalyticsService** | `getUsersByRole()`, `getTotalCounts()`, `getTopVirtualAssets()`, `getTopUsers()`, `getInteractionsBySection()`, `getTimeSeriesBySection()` + 7 endpoints más |
| **MapConfigurationService** | `getAvailable()`, `getByUser()`, `getPublic()`, `create()`, `update()`, `delete()`, `getGlobal()`, `upsertGlobal()` |

### API Endpoints

**Base:** `http://localhost:5000/api`

| Grupo | Base Path | Endpoints | Auth |
|-------|-----------|-----------|------|
| Auth | `/api/auth` | POST login, register, google, forgot-password, refresh, logout; GET me | Público (rate limited) |
| Users | `/api/users` | GET list+paginated, GET :id, PUT :id, DELETE :id, PATCH toggle-active, PATCH set-password, PATCH profile-picture, POST register/recover-password/check-email/change-password/verify-password | Mixto |
| Virtual Assets | `/api/virtual-assets` | GET all, GET active, GET :id, POST create, PUT :id, DELETE :id, PATCH deactivate | GET público, CUD autenticado |
| Anchor Points | `/api/anchor-points` | GET all, GET active, GET clusters, GET :id, GET by animal/:animalModelId, POST, PUT, DELETE | GET público, CUD autenticado |
| Interactions | `/api/user-interactions` | GET all, GET :id, GET by user/:userId, GET by-virtual-asset/:assetId, POST create, DELETE reset user/:userId/reset | Autenticado |
| Sessions | `/api/user-sessions` | GET all, GET :id, GET time-series, GET by user/:userId, POST :id/end | Autenticado |
| Analytics | `/api/analytics` | 13 endpoints de estadísticas (users-by-role, active-users, interactions-by-type, active-virtual-assets, locations, users-status, total-interactions, last-access, totals, top-virtual-assets, top-users, interactions-by-section, time-series-by-section) | Autenticado |
| Map Config | `/api/map-configurations` | GET available, GET mine, GET public, GET global, GET :id, POST, PUT :id, PUT global, DELETE :id | Autenticado |
| Config | `/api/config` | GET config público (Google Client IDs, feature flags) | Público |
| Files | `/api/files/:filename`, `/api/files/:folder/:filename` | Sirve archivos con auth (JWT en header o ?token=) | Autenticado |
| Health | `/health`, `/api/ping` | Health check con verificación de BD | Público |

### Middleware Chain (orden)
1. HTTPS redirect (producción) → 2. Helmet → 3. CORS → 4. Security headers → 5. Compression → 6. Rate limiting → 7. Timeout (30s) → 8. Body parsing (JSON 10MB) → 9. Sanitización XSS → 10. HPP → 11. Morgan logging

### Seguridad
- JWT con access token (24h) + refresh token (7d)
- bcrypt para hash de contraseñas (salt rounds: 10)
- Rate limiting: 100 req/15min general, 10 req/15min auth, 3 req/1h password reset
- Google OAuth (Web + Android client IDs)
- Archivos servidos con autenticación (no estáticos)
- Soft delete para usuarios (paranoid mode de Sequelize)

### Variables de Entorno Clave
`DATABASE_URL` (requerido), `JWT_SECRET` (requerido), `PORT` (5000), `CORS_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `EMAIL_USER`/`EMAIL_PASS`, `UPLOAD_DIR` (../../uploads), `REDIS_URL` (opcional)

---

## 5. Frontend Web — `apps/web-admin/`

### Arquitectura: Feature-based + Standalone Components (Angular 21)

```
src/app/
├── core/                  # Singleton services, guards, interceptors, models
│   ├── guards/            # AuthGuard, LoginRedirectGuard (funcionales)
│   ├── interceptors/      # tokenInterceptor, errorInterceptor (funcionales)
│   ├── services/          # AuthService, ApiRoutesService, AlertService, etc.
│   ├── models/            # ApiResponse, UserData, error codes
│   └── utils/             # constants, helpers, validators
├── features/              # Módulos por funcionalidad
│   ├── dashboard/         # Dashboard con analytics y charts
│   ├── users/             # CRUD de usuarios (tabla + dialogs)
│   ├── anchor-points/     # CRUD de puntos de anclaje
│   ├── virtual-assets/    # CRUD de modelos 3D + preview 3D
│   ├── map/               # Mapa canvas del parque + stickers + config
│   ├── animator/          # Editor de secuencias de animación 3D (Three.js)
│   ├── stats/             # 5 sub-vistas de estadísticas
│   └── auth-form/         # Formulario de login
├── layouts/               # MainLayout (sidenav + header + footer)
├── pages/                 # LoginPage, RecoverPasswordPage
└── shared/                # Componentes reutilizables, controles, validators
```

### Rutas Principales

| Ruta | Componente | Guard |
|------|------------|-------|
| `/login` | LoginPageComponent | LoginRedirectGuard |
| `/recover-password` | RecoverPasswordPageComponent | — |
| `/` (shell) | MainLayoutComponent | **AuthGuard** |
| `/dashboard` | DashboardContainerComponent | (hereda) |
| `/users` | UsersContainerComponent | (hereda) |
| `/anchor-points` | AnchorPointsContainerComponent | (hereda) |
| `/virtual-assets` | AssetsContainerComponent | (hereda) |
| `/map` | MapContainerComponent | (hereda) |
| `/animator` | AnimatorContainerComponent | (hereda) |
| `/stats/session-history` | SessionHistoryContainerComponent | (hereda) |
| `/stats/interaction-stats` | InteractionStatsContainerComponent | (hereda) |
| `/stats/zone-visits` | ZoneVisitsContainerComponent | (hereda) |
| `/stats/user-interactions` | UserInteractionStatsContainerComponent | (hereda) |
| `/stats/user-access` | UserAccessPatternsContainerComponent | (hereda) |

### Patrones Angular Clave
- **100% Standalone Components** (sin NgModules)
- **Lazy loading** en todas las rutas con `loadComponent()`
- **Guards e interceptors funcionales** (Angular 18+ style)
- **Signals** para estado del tema (ThemeManagerService)
- **Container/Presentation pattern** en cada feature
- **Chart.js + ng2-charts** para gráficos del dashboard
- **Three.js** para preview y animación de modelos 3D
- **Mapa canvas custom** (no Google Maps) con coordenadas WGS84, polígono del parque, secciones, stickers
- **PWA** con Service Worker habilitado en producción
- **SSR** con Angular SSR (provideClientHydration)
- **Angular Material + Tailwind CSS** para UI
- **CreateDialogComponent** genérico: genera formularios CRUD dinámicos desde configuración

### Features Destacadas

**Mapa del Parque:** Mapa canvas HTML5 personalizado (~2000 líneas) que renderiza el polígono del parque con las 4 secciones, marcadores de anchor points, sistema de stickers (44 stickers predefinidos), capas con save/load, zoom/rotación/pan. Coordenadas GPS reales del parque.

**Animator 3D:** Editor de secuencias de animación para modelos GLB/GLTF/FBX. Carga modelos desde el backend, muestra clips de animación disponibles, permite crear secuencias de timeline con drag-and-drop, reproduce con play/pause/stop. Usa Three.js con OrbitControls.

**Dashboard:** Tarjetas KPI (usuarios totales, activos, assets, anchor points, interacciones), gráficos pie/doughnut/bar (roles, estados, interacciones por sección), rankings (top assets, top usuarios), series temporales de sesiones e interacciones con navegación temporal.

---

## 6. App Móvil Android — `apps/mobile-android/`

### Arquitectura: Layered + MVVM (View-based, no Compose UI)

```
app/src/main/java/com/univalle/pedrochacolla/
├── data/                  # Capa de datos
│   ├── local/             # Room (declarado, no activamente usado)
│   ├── remote/            # Retrofit API services (7 interfaces)
│   │   └── api/           # AuthApiService, LocationApiService, VirtualAssetApiService, InteractionApiService, SessionApiService, MapConfigApiService, ConfigApiService
│   ├── model/             # DTOs y modelos de datos (12+)
│   └── repository/        # 6 repositorios
├── di/                    # Hilt modules (NetworkModule, RepositoryModule)
├── ui/                    # Capa de presentación
│   ├── activities/        # AuthActivity, MainActivity
│   ├── fragments/         # 12 fragments (auth: 4, main: 8)
│   ├── viewmodels/        # 7 ViewModels
│   ├── components/        # Vistas custom (ParkMapView)
│   └── adapters/          # RecyclerView adapters
└── utils/                 # AR managers, auth, session, config, validation (20+)
```

### Build Config
- Package: `com.univalle.pedrochacolla`
- minSdk 30 (Android 11), targetSdk 35, compileSdk 35
- Kotlin 2.1.0, JDK 17
- Signed release builds (key.properties)

### Pantallas

| Pantalla | Tipo | Propósito |
|----------|------|-----------|
| **LoginFragment** | Auth | Login email/password + Google Sign-In |
| **RegisterFragment** | Auth | Registro de usuario |
| **ForgotPasswordFragment** | Auth | Recuperación de contraseña |
| **ForceChangePasswordFragment** | Auth | Cambio obligatorio de contraseña |
| **StatsFragment** | Main→Inicio | Home: bienvenida, progreso encontrados/total, cards de navegación |
| **MainFragment** | Main→Colección | Grid de anchor points por sección |
| **DashboardFragment** | Main→Mapa | ParkMapView custom + GPS + brújula + stickers + POI |
| **ArFragment** | Main→AR | **Realidad Mixta** completa (ARCore + Cloud Anchors) |
| **ArMapFragment** | Main→AR | **Mapa AR Explorer** estilo Pokémon Go (mapa + cámara integrados) |
| **ArSimpleFragment** | Main→AR | **Realidad Aumentada** simple (Camera2 + SceneView, sin ARCore) |
| **ArUnsupportedFragment** | Main→AR | Fallback para dispositivos no compatibles |
| **ProfileFragment** | Main→Perfil | Ver/editar perfil, cambiar contraseña, logout |

### Bottom Navigation (5 tabs)
`Mapa | Colección | Inicio | AR | Perfil`

### Tres Modos de Realidad Aumentada

**1. Realidad Mixta (ArFragment)** — Requiere dispositivo ARCore-compatible
- ARCore 1.48 + SceneView 2.3 (arsceneview)
- **Cloud Anchors:** Admin coloca anclas en el espacio real → se suben a la nube → visitantes las resuelven y ven los modelos 3D anclados
- Máquina de estados: Idle → Placement → Quality Capture → Resolve
- Detección de planos, tap-to-place, escala/rotación via menú FAB
- Panel de descripción del animal al tocar modelo
- Registro automático de interacciones (deduplicado por día via InteractionTracker)
- Screenshot de escena AR
- **RemoteAnchorResolver:** Batch loading optimizado (2N+1 → 3 API calls)

**2. Mapa AR Explorer (ArMapFragment)** — Estilo Pokémon Go
- Mapa del parque integrado con cámara AR
- Navega por el mapa para encontrar animales
- Al acercarse a un anchor point, se activa la vista AR

**3. Realidad Aumentada Simple (ArSimpleFragment)** — Funciona en CUALQUIER dispositivo
- Camera2 API (preview de cámara) + SceneView (renderizado 3D sin AR, fondo transparente)
- No necesita ARCore — modelos 3D flotan sobre la cámara
- Admin: selecciona animal → guarda ubicación GPS
- Usuario: carga locations sin anchor_code → navega con carousel prev/next
- Gestos: arrastrar (reposicionar), pinch (escalar)

### Compatibilidad de Dispositivos
`ArDeviceCompatibility` verifica en dos capas: runtime ARCore + allowlist curada (Samsung Galaxy S/A/Z, Pixel 4+, OnePlus 8+, Xiaomi 12+, etc.). Dispositivos no compatibles ven ArUnsupportedFragment.

### Autenticación
1. App lanza → `AuthActivity.tryAutoLogin()` verifica `SessionManager`
2. Login email/password → `POST /api/auth/login` con platform="mobile"
3. Google Sign-In via Credential Manager API → obtiene idToken → `POST /api/auth/google`
4. JWT almacenado en `EncryptedSharedPreferences`
5. `AuthInterceptor` (OkHttp) inyecta `Authorization: Bearer` automáticamente
6. Si `must_change_password=true`, fuerza a `ForceChangePasswordFragment`

### Mapa Custom (ParkMapView)
Vista custom completa que reemplaza Google Maps: marcadores de anchor points, dot de ubicación del usuario, brújula con heading, navegación con path punteado, overlay de POIs, sistema de stickers (44 predefinidos), gestos pan/zoom, tema oscuro.

### Networking
- Retrofit 2.9 + OkHttp 4.12 + Gson
- `RetrofitClient` singleton para todas las API services
- `AuthInterceptor` para JWT injection
- `TokenAuthenticator` para refresh automático de tokens expirados
- `AuthEventBus` para señalizar expiración de sesión entre componentes
- `ApiError` sealed class con mapeo completo de errores HTTP
- `RetryPolicy` con backoff exponencial (3 intentos)
- Glide con OkHttp autenticado para imágenes

---

## 7. Uploads — `shared/uploads/`

Directorio compartido en la raíz del proyecto con archivos multimedia:

| Tipo | Cantidad | Formato | Tamaño |
|------|----------|---------|--------|
| Iconos de animales | 12 | PNG 512x512 transparente | <200KB c/u |
| Modelos 3D | 12 | GLB (GLTF 2.0 Binary) | <5MB c/u |
| Fotos de perfil | Dinámico | PNG/JPG/WebP | <5MB c/u |
| Iconos del mapa | 11 POI | SVG | — |
| Stickers del mapa | 44 | PNG | — |

Los archivos se sirven por la API autenticada en `/api/files/` (no estáticos). Las rutas `/uploads/` se redirigen 301 a `/api/files/`.

La app móvil normaliza URLs de `/uploads/` → `/api/files/` via `ImageUrlHelper.buildUrl()`.

---

## 8. Base de Datos — Esquema Completo

### Modelo ER

```
User ──1:N──> Session        (user_id)
User ──1:N──> Interaction    (user_id)
User ──1:N──> MapConfiguration (user_id)
VirtualAsset ──1:N──> Location      (virtual_asset_id)
VirtualAsset ──1:N──> Interaction   (virtual_asset_id)
Location ──1:N──> Interaction       (location_id)
```

### Tabla: users
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | UUIDv4 auto |
| name | STRING(100) | Nullable |
| email | STRING(100) | Unique, required |
| google_id | STRING(255) | Unique, nullable |
| password_hash | STRING(255) | Nullable (Google users) |
| role | STRING(20) | `admin` / `user` / `moderator` |
| is_active | BOOLEAN | Default true |
| avatar_url | STRING(500) | Nullable |
| must_change_password | BOOLEAN | Default false |
| deleted_at | DATE | Soft delete (paranoid) |
| email_verified_at, last_login_at, created_at, updated_at | DATE | Timestamps |

### Tabla: virtual_assets
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | UUIDv4 auto |
| name | STRING(100) | Required |
| scientific_name | STRING(150) | Nullable |
| description | TEXT | Nullable |
| model_url | STRING(500) | Required (.glb path) |
| icon_url | STRING(500) | Nullable (.png path) |
| thumbnail_url | STRING(500) | Nullable |
| category | STRING(50) | Mamífero, Ave, Reptil, Mito |
| habitat | STRING(200) | Nullable |
| display_order | INTEGER | Default 0 |
| is_active | BOOLEAN | Default true |

### Tabla: locations (anchor points)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | UUIDv4 auto |
| name | STRING(100) | Required |
| anchor_code | TEXT | Cloud Anchor ID de ARCore (nullable) |
| latitude | DECIMAL(10,8) | Required [-90, 90] |
| longitude | DECIMAL(11,8) | Required [-180, 180] |
| section | STRING(50) | Tierras Altas/Medias/Bajas, Mitos y Leyendas |
| show_in_map | BOOLEAN | Default true |
| scale | FLOAT | Default 1.0 [0.01, 10.0] |
| rotation_y | FLOAT | Default 0.0 [-360, 360] |
| virtual_asset_id | UUID FK→virtual_assets | Nullable |
| spatial_data | JSONB | VPSMap data for AR persistence (nullable) |
| is_active | BOOLEAN | Default true |

### Tabla: sessions
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users | Required |
| platform | ENUM | web / mobile / desktop |
| ip_address | STRING(45) | |
| user_agent | TEXT | |
| logged_in_at | DATE | Default NOW |
| logged_out_at | DATE | Nullable |
| session_duration_seconds | INTEGER | Nullable |

### Tabla: interactions
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users | Required |
| virtual_asset_id | UUID FK→virtual_assets | Nullable |
| location_id | UUID FK→locations | Nullable |
| interaction_type | ENUM | view, click, scan, share, favorite, zoom, rotate |
| metadata | JSONB | Nullable |
| created_at | DATE | Default NOW |

### Tabla: map_configurations
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users | Required |
| name | STRING(100) | Required |
| description | TEXT | Nullable |
| platform | ENUM | mobile / web |
| config_data | JSONB | Mapstate, stickers, POI positions, etc. |
| is_public | BOOLEAN | Default false |

---

## 9. Flujos Principales del Sistema

### Flujo 1: Admin coloca animal en el parque
1. Admin inicia sesión en frontend web (`/login`)
2. Va a **Contenido 3D** (`/virtual-assets`) → crea/edita modelo con archivo .glb y .png
3. Va a **Puntos de Anclaje** (`/anchor-points`) → crea punto con coordenadas GPS, sección y virtual_asset asociado
4. Opcionalmente en app móvil → modo AR → "Colocar ancla" → tap en superficie real → sube Cloud Anchor

### Flujo 2: Visitante busca animales con AR
1. Visitante instala la app móvil y se registra (email o Google)
2. Va al tab **AR** → "Buscar anclas" → la app resuelve cloud anchors cercanos
3. Apunta la cámara → ve modelos 3D anclados en el espacio real
4. Toca un animal → ve panel de descripción con nombre, nombre científico, habitat
5. Se registra una interacción tipo "view" automáticamente
6. En el tab **Colección** ve su progreso: qué animales ha encontrado vs total

### Flujo 3: Visitante sin ARCore usa AR Simple
1. Dispositivo sin ARCore → la app redirige a ArSimpleFragment
2. Se activa Camera2 como fondo → SceneView renderiza modelo 3D sobre la cámara
3. El visitante navega animales con carousel prev/next
4. Puede escalar y mover el modelo con gestos

### Flujo 4: Admin revisa estadísticas
1. Frontend web → **Dashboard** (`/dashboard`) → KPIs, charts, rankings
2. **Estadísticas** → sesiones por plataforma, interacciones por animal, visitas por zona, accesos por usuario, series temporales

### Flujo 5: Configuración del mapa
1. Frontend web → **Mapa** (`/map`) → mapa canvas del parque
2. Admin agrega stickers (44 disponibles), configura capas, posiciona POIs
3. Guarda configuración → se sincroniza con app móvil via MapConfiguration API
4. App móvil → ParkMapView carga la configuración pública

---

## 10. Convenciones de Código

### General
- **Variables:** camelCase
- **Clases/Componentes:** PascalCase
- **Constantes:** UPPER_SNAKE_CASE
- **Archivos:** kebab-case.extension
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

### Backend (Node.js)
- Arquitectura hexagonal con DI manual (container.js)
- Repos extienden BaseRepository con findAll/findById/create/update/delete
- Validación con Joi (schemas en `shared/validators/`)
- Errores custom (AppError → NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError)
- Respuestas estandarizadas: `{ success, message, data?, code?, timestamp, errors? }`
- La BD usa snake_case; la API acepta camelCase y snake_case

### Frontend (Angular 21)
- 100% standalone components
- Container/Presentation pattern
- Guards e interceptors funcionales
- Signals para estado reactivo
- Lazy loading en todas las rutas
- SSR-safe: `isPlatformBrowser()` checks
- Angular Material + Tailwind CSS
- `CreateDialogComponent` genérico para CRUD dialogs

### Mobile (Kotlin)
- View-based UI (Fragments + ViewBinding), NO Jetpack Compose UI
- Hilt para DI
- StateFlow para estado reactivo en ViewModels
- Sealed classes para UI states
- Retrofit + OkHttp + Gson
- EncryptedSharedPreferences para tokens
- Timber para logging

---

## 11. Stack Tecnológico Completo

| Capa | Tecnologías |
|------|-------------|
| **Backend** | Node.js 24, Express 4, Sequelize 6, PostgreSQL 14+, JWT, bcrypt 6, Joi 18, Winston, Multer, Nodemailer, google-auth-library, helmet, compression, Redis (opcional) |
| **Frontend** | Angular 21, TypeScript 5.9, Angular Material 21, Tailwind CSS 3.4, RxJS 7.8, Three.js 0.182, Chart.js 4.4, ng2-charts 8, ngx-progressbar, zone.js |
| **Mobile** | Kotlin 2.1, Android SDK 35, ARCore 1.48, SceneView 2.3, Hilt 2.52, Retrofit 2.9, OkHttp 4.12, Gson 2.11, Glide 4.16, Room 2.6 (declarado), Navigation 2.8, Credential Manager 1.5, Security Crypto 1.1, Timber 5.0 |
| **Testing** | Jest 30 (backend), Jasmine 5.5 + Karma 6.4 (frontend), JUnit + Mockito Kotlin + Turbine (mobile) |
| **DevOps** | Git, GitHub, Docker (opcional), nginx, Render/Railway/Vercel (deploy) |

---

## 12. Credenciales por Defecto (Desarrollo)

```
Email:    chacolla43@gmail.com
Password: Cybercenter1
Rol:      admin
```

El seeder crea 15 usuarios (1 admin, 1 moderador, 13 usuarios), 12 virtual assets y 12 locations pre-configurados.

---

## 13. Comandos de Desarrollo

### Backend
```bash
cd apps/backend
npm install && npm run dev           # Desarrollo (port 5000)
npm run db:reset                     # Reset BD completa
npm test                             # Jest tests
npm run lint:fix                     # ESLint fix
```

### Frontend
```bash
cd apps/web-admin
npm install && npm start             # Desarrollo (port 4200)
npm test                             # Karma/Jasmine tests
npm run build                        # Build producción
```

### Mobile
```bash
cd apps/mobile-android
./gradlew assembleDebug              # Build debug APK
./gradlew installDebug               # Instalar en dispositivo
./gradlew test                       # Unit tests
```

---

## 14. Servicios Externos Requeridos

| Servicio | Uso | Variables |
|----------|-----|-----------|
| **Google OAuth 2.0** | Login con Google (web + Android) | `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Google Maps** | No se usa directamente (mapa custom), pero la key está disponible | `GOOGLE_MAPS_API_KEY` |
| **SMTP Email** | Recuperación de contraseñas, bienvenida | `EMAIL_USER`, `EMAIL_PASS` (o Gmail OAuth2) |
| **PostgreSQL** | Base de datos principal | `DATABASE_URL` |
| **Redis** | Cache (opcional, mejora performance) | `REDIS_URL` |

---

## 15. Archivos de Configuración Clave

| Archivo | Propósito |
|---------|-----------|
| `apps/backend/.env` | Variables de entorno del backend |
| `apps/web-admin/.env` | Variables de entorno del frontend (API_URL) |
| `apps/mobile-android/local.properties` | Config Android (BASE_URL, WEB_CLIENT_ID) |
| `apps/backend/src/config/container.js` | DI container manual |
| `apps/backend/src/config/env.js` | Parsing de variables de entorno |
| `apps/web-admin/src/app/environments/environment.ts` | Auto-generado desde .env |
| `apps/web-admin/angular.json` | Config de build Angular |
| `apps/mobile-android/app/build.gradle.kts` | Config de build Gradle |
| `shared/uploads/map-icons/map-config.json` | Config de POIs y zonas del parque |
| `shared/data/database-model.mmd` | Diagrama ER (Mermaid) |

---

## 16. Notas Importantes para la IA

1. **La tabla `locations` en la BD se mapea como "AnchorPoint" en el frontend y "Location" en el backend/mobile.** Los nombres son intercambiables.
2. **`virtual_assets` era antes `animal_models`.** Aún hay referencias legacy como `animalModelId` o `animal/:id` en las rutas.
3. **El mapa del parque es canvas custom, NO Google Maps.** Usa coordenadas WGS84 reales con un polígono de ~100 puntos.
4. **Tres modos AR:** Realidad Mixta (ARCore + Cloud Anchors, solo dispositivos compatibles), Mapa AR Explorer (estilo Pokémon Go) y Realidad Aumentada Simple (Camera2 + SceneView, cualquier dispositivo).
5. **El frontend es panel de administración.** Los visitantes usan exclusivamente la app móvil.
6. **Los archivos se sirven autenticados** via `/api/files/`. Los `<img>` tags usan `?token=JWT` como query param.
7. **El backend acepta tanto camelCase como snake_case** en los request bodies para anchor points y map configurations.
8. **Soft delete** solo aplica a `users` (Sequelize paranoid). Los demás son hard delete o toggle `is_active`.
9. **La app móvil NO usa Jetpack Compose.** Usa Fragments + ViewBinding + layouts XML tradicionales.
10. **`must_change_password`** fuerza al usuario a cambiar su contraseña al próximo login (tanto web como móvil).
11. **`locations` ya NO tiene campo `description`** — fue eliminado en migración `20260305000001-remove-description-from-locations.js`.
12. **`locations` tiene campo `spatial_data` (JSONB)** — agregado en migración `20260226000000-add-spatial-data-to-locations.js` para persistencia de datos VPSMap AR.
13. **RemoteAnchorResolver** en la app móvil optimiza batching de API calls (de 2N+1 a solo 3 llamadas).
14. **TokenAuthenticator** en la app móvil hace refresh automático de tokens expirados sin intervención del usuario.
15. **Map3DRendererService** existe en el frontend pero NO está activamente integrado en la UI del mapa (preparado para futuro).
