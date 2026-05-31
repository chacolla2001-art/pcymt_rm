# 🌐 Frontend Web - Angular 21 + Material Design

Aplicación web para visualización de realidad mixta con mapas interactivos y autenticación.

---

## 📑 Índice

- [**Capítulo 1: Configuración Rápida**](#capítulo-1-configuración-rápida) ⚡
- [Capítulo 2: Estructura del Proyecto](#capítulo-2-estructura-del-proyecto)
- [Capítulo 3: Componentes Principales](#capítulo-3-componentes-principales)
- [Capítulo 4: Servicios y Estado](#capítulo-4-servicios-y-estado)
- [Capítulo 5: Autenticación](#capítulo-5-autenticación)
- [Capítulo 6: Servicios Externos](#capítulo-6-servicios-externos)
- [Capítulo 7: Comandos Útiles](#capítulo-7-comandos-útiles)
- [Capítulo 8: Despliegue](#capítulo-8-despliegue)
- [Capítulo 9: Pruebas](#capítulo-9-pruebas)

---

## Capítulo 1: Configuración Rápida

🔐 **Credenciales de Acceso Administrador (configuradas en backend):**
```
Email:    chacolla43@gmail.com
Password: Cybercenter1
Rol:      admin
```

---

### Requisitos
- Node.js 18+
- npm o yarn
- Angular CLI 21+

### Pasos

**1. Instalar Angular CLI**
```bash
npm install -g @angular/cli@21
```

**2. Entrar al directorio**
```bash
cd apps/web-admin
```

**3. Instalar dependencias**
```bash
npm install
```

**4. Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env` y configurar:
- `API_URL` - URL del backend API (ej: `http://localhost:5000`)

💡 **Nota:** En `.env.example` las líneas con `##!` indican valores que hay que descomentar (quitar `##!`) para producción.

🔄 **Para cambiar a producción:** 
1. Comentar las 3 variables de desarrollo (agregar `#` al inicio)
2. Descomentar variables de producción (quitar `##!`)
3. Compilar con `npm run build`

**5. Iniciar servidor de desarrollo**
```bash
npm start
```

✅ **Aplicación corriendo en:** `http://localhost:4200`

---

## Capítulo 2: Estructura del Proyecto

```
apps/web-admin/
├── src/
│   ├── app/
│   │   ├── core/              # Funcionalidad core
│   │   │   ├── guards/          # Route guards
│   │   │   ├── interceptors/    # HTTP interceptors
│   │   │   ├── services/        # Servicios globales
│   │   │   └── models/          # Interfaces y tipos
│   │   ├── features/          # Features por módulo
│   │   │   ├── auth-form/       # Autenticación
│   │   │   ├── dashboard/       # Dashboard principal
│   │   │   ├── map/             # Mapa interactivo
│   │   │   ├── virtual-animals/ # Visualización AR
│   │   │   └── users/           # Gestión de usuarios
│   │   ├── shared/            # Componentes compartidos
│   │   │   ├── components/      # Componentes reutilizables
│   │   │   ├── controls/        # Form controls
│   │   │   ├── pipes/           # Pipes personalizados
│   │   │   └── validators/      # Validadores
│   │   ├── layouts/           # Layouts de página
│   │   └── environments/      # Configuración de entornos
│   ├── assets/                # Recursos estáticos
│   └── styles/                # Estilos globales
├── scripts/                   # Scripts de build
└── public/                    # Archivos públicos
```

**Arquitectura:** Feature-based con Standalone Components

---

## Capítulo 3: Componentes Principales

### Dashboard
Panel principal con estadísticas y navegación.

```typescript
// src/app/features/dashboard/dashboard.component.ts
@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html'
})
```

### Mapa Interactivo
Visualización de puntos de anclaje con Google Maps.

**Features:**
- Visualización de markers
- Búsqueda de ubicaciones
- Click para crear puntos
- Integración con AR

### Virtual Animals
Catálogo y visualización de modelos 3D.

**Características:**
- Grid de modelos
- Filtros y búsqueda
- Vista previa 3D
- Detalles del modelo

### Autenticación
Login, registro y OAuth con Google.

**Rutas:**
- `/login` - Inicio de sesión
- `/register` - Registro
- `/recover-password` - Recuperar contraseña

---

## Capítulo 4: Servicios y Estado

### AuthService
Gestión de autenticación y tokens.

```typescript
login(credentials): Observable<User>
logout(): void
refreshToken(): Observable<Token>
isAuthenticated(): boolean
```

### ApiService
Cliente HTTP para comunicación con backend.

```typescript
get<T>(url: string): Observable<T>
post<T>(url: string, body: any): Observable<T>
put<T>(url: string, body: any): Observable<T>
delete<T>(url: string): Observable<T>
```

### MapService
Lógica de negocio para mapas.

```typescript
initMap(element: HTMLElement): void
addMarker(location: LatLng): void
setCenter(location: LatLng): void
```

### Estado Global
Manejo de estado con Signals de Angular 21.

```typescript
// Ejemplo: estado de usuario
userSignal = signal<User | null>(null);
isLoggedIn = computed(() => !!userSignal());
```

---

## Capítulo 5: Autenticación

### JWT Tokens
Los tokens se almacenan en `localStorage` y se envían automáticamente.

**Interceptor automático:**
```typescript
// Se agrega automáticamente el header
Authorization: Bearer <token>
```

### Guards de Ruta

**AuthGuard** - Protege rutas privadas
```typescript
{
  path: 'dashboard',
  canActivate: [AuthGuard],
  component: DashboardComponent
}
```

**GuestGuard** - Redirige si ya está autenticado
```typescript
{
  path: 'login',
  canActivate: [GuestGuard],
  component: LoginComponent
}
```

### Google OAuth

**1. Configurar credenciales en `.env`**
```env
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

**2. El botón se renderiza automáticamente**
- Callback manejado por `AuthService`
- Token JWT retornado por backend

---

## Capítulo 6: Servicios Externos

### Google Maps

**Instalación incluida:**
```json
"@angular/google-maps": "^21.0.0"
```

**Obtener API Key:**
1. https://console.cloud.google.com/google/maps-apis
2. Habilitar: Maps JavaScript API
### Google OAuth

Ver Capítulo 5 para configuración completa.

---

## Capítulo 7: Comandos Útiles

### Desarrollo
```bash
npm start              # Servidor dev (http://localhost:4200)
npm run dev            # Alias de start
ng serve              # Servidor con opciones
ng serve --open       # Abre navegador automáticamente
ng serve --port 4300  # Puerto personalizado
```

### Build
```bash
npm run build          # Build de producción
npm run build:dev      # Build de desarrollo
npm run build:SSR      # Build con Server-Side Rendering
ng build --configuration production
```

### Generadores (Angular CLI)
```bash
ng g c feature/mi-componente    # Crear componente
ng g s core/services/mi-service # Crear servicio
ng g m feature/mi-modulo        # Crear módulo
ng g g core/guards/mi-guard     # Crear guard
ng g i core/models/mi-interface # Crear interface
ng g p shared/pipes/mi-pipe     # Crear pipe
```

### Linting
```bash
npm run lint           # Verificar código
npm run lint:fix       # Corregir automáticamente
```

### Testing
```bash
npm test               # Ejecutar pruebas unitarias
npm run test:coverage  # Con coverage
ng e2e                # Pruebas E2E (si configurado)
```

### Análisis
```bash
npm run analyze        # Analizar tamaño de bundle
```

---

## Capítulo 8: Despliegue

### Build de Producción

```bash
npm run build
```

Genera archivos en `/dist/angular-front/browser/`

### Variables de Entorno

**Producción:**
```env
API_URL=https://api.tudominio.com
ENV_NAME=production
PRODUCTION=true
```

### Servidor Estático

**Opción 1: nginx**
```bash
# Copiar archivos build
cp -r dist/angular-front/browser/* /var/www/html/

# Configuración nginx incluida: nginx.conf
```

**Opción 2: Node.js (SSR)**
```bash
npm run build:SSR
npm run serve:SSR
```

**Opción 3: Vercel/Netlify**
```bash
# Build command: npm run build
# Output directory: dist/angular-front/browser
```

### Docker (opcional)

```dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/angular-front/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

## Capítulo 9: Pruebas

### Framework y Configuración

| Herramienta | Versión | Rol |
|---|---|---|
| Jasmine | 5.5 | Framework de pruebas (assertions, spies) |
| Karma | 6.4 | Test runner (ejecuta en Chrome) |
| Angular TestBed | 21+ | Configuración de módulos y DI para tests |
| HttpTestingController | - | Mock de peticiones HTTP |

### Ejecutar las pruebas

```bash
# Ejecutar todas las pruebas unitarias
npm test

# Ejecutar con reporte de cobertura
npm run test:coverage
```

El reporte de cobertura se genera en `coverage/index.html`.

---

### Catálogo completo de pruebas

Se crearon **18 archivos de prueba** con más de **180 test cases** cubriendo modelos, servicios, guards, validadores, utilidades, componentes y rutas.

#### 1. Modelos de datos

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `features/users/models/user.model.spec.ts` | 12 | Constructor con valores por defecto y parciales, `fullDisplayName`, `isAdmin()`, `hasRole()` case-insensitive, `getInitials()`, `canOperate()`, `UserRole` enum |
| `features/anchor-points/models/anchor-point.model.spec.ts` | 6 | Constructor, coordenadas formateadas, relación bidireccional `animalModelId` ↔ `virtualAssetId` |
| `features/virtual-assets/models/virtual-asset.model.spec.ts` | 4 | Constructor, campos opcionales `undefined`, parseo de fechas |
| `core/models/api-response.model.spec.ts` | 7 | 12 códigos de error definidos, mensajes en español para cada código, `isSuccessResponse()` y `isErrorResponse()` type guards |

#### 2. Validadores

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `core/utils/validators.spec.ts` | 28 | `email()`, `emailDomain()`, `gmailOnly()`, `passwordStrength()` (uppercase, lowercase, number, special char), `minPasswordLength()`, `passwordMatch()`, `idCardNumber()` (numérico, longitud), `username()`, `lettersOnly()`, `latitude()`, `longitude()` |
| `shared/validators/custom-validators.spec.ts` | 20 | `noWhitespace()`, `emailFormat()`, `passwordStrength()` (12+ chars, requisitos), `fileSize()`, `fileType()` (extensión y MIME), `matchesControl()`, `usernameFormat()`, `numberRange()` |

#### 3. Utilidades

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `core/utils/helpers.spec.ts` | 20 | `formatDate()`, `formatDateISO()`, `formatDateTime()`, `handleHttpError()` (status 0, 4xx, 5xx, otros), `capitalize()`, `capitalizeWords()`, `truncate()`, `generateId()` unicidad, `isEmpty()`, `deepClone()`, `removeNullish()`, `debounce()` con jasmine.clock |
| `core/utils/constants.spec.ts` | 3 | Mensajes de error, roles de usuario, paginación por defecto |

#### 4. Servicios core

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `core/services/auth.service.spec.ts` | 14 | `login()` POST + almacenamiento de token, manejo de error 401/red, `logout()` limpia storage + navega, `isUserAuthenticated()` con/sin token y sesión expirada, `getToken()`, `getRefreshToken()`, `refreshAccessToken()` POST y error sin token, `updateCurrentUser()` persiste en storage |
| `core/services/api-routes.service.spec.ts` | 15 | Todos los grupos de endpoints (auth, users, virtualAssets, anchorPoints, analytics, userSessions, mapConfigurations), funciones dinámicas `byId()`, `getFullUrl()`, `getAssetUrl()` (null, absoluta, `/uploads/` → `/api/files/`), `isSameOrigin()` |
| `core/services/alert.service.spec.ts` | 6 | `showAlert()` con MatSnackBar mock, duración default 5000ms, `showSuccess()`, `showWarning()`, `showError()`, `showInfo()` |
| `core/services/drawer.service.spec.ts` | 6 | Operaciones sin drawer (no lanza error), `toggle()`, `open()`, `close()` con MatDrawer mock |
| `core/services/logger.service.spec.ts` | 12 | `debug()`, `info()`, `warn()`, `error()` con console spy, contexto en output, timestamp ISO, `logHttpError()` status 404 y 0, `logAuthError()` HttpErrorResponse y Error, `logValidationError()` campos, `logNetworkError()`, SSR no loguea |
| `core/services/theme-manager.service.spec.ts` | 10 | Tema por defecto `light`, `setThemeMode()` dark/light/system, clase CSS en `<html>`, emisión de `themeChanged$`, `toggleTheme()` ciclo light→dark→system→light, `isDarkMode()`, `getThemeModeIcon()` iconos, restauración desde localStorage |

#### 5. Guards

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `core/guards/auth.guard.spec.ts` | 2 | Permite acceso cuando está autenticado, redirige a `/login` cuando no está autenticado |
| `core/guards/login-redirect.guard.spec.ts` | 2 | Redirige a `/main` si ya está autenticado, permite acceso si no está autenticado |

#### 6. Servicios de features

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `features/users/services/user.service.spec.ts` | 13 | `getAllUsers()` GET + filtro `isActive`, `createUser()` POST FormData, `getUserById()`, `updateUser()` PUT, `deleteUser()` DELETE, `toggleUserActive()` PATCH, `checkEmailExists()` POST, `checkUsernameExists()` POST, `recoverPassword()`, `changePassword()`, `updateProfilePicture()` PATCH con File |
| `features/anchor-points/services/anchor-point.service.spec.ts` | 8 | `getAllAnchorPoints()` GET + mapeo DTO→model, filtro isActive, conversión string coords a number, `getAnchorPointById()`, `createAnchorPoint()` POST, `updateAnchorPoint()` PUT, `deleteAnchorPoint()` DELETE, `getActiveAnchorPoints()` |
| `features/virtual-assets/services/virtual-asset.service.spec.ts` | 8 | `getAllVirtualAssets()` GET + mapeo, filtro isActive, `getVirtualAssetById()`, `createVirtualAsset()` POST (objeto y FormData), `updateVirtualAsset()` PUT, `deleteVirtualAsset()` DELETE, `updateAnimationSequence()` PUT body |
| `features/dashboard/services/analytics.service.spec.ts` | 14 | `getUsersByRole()`, `getActiveUsersCount()`, `getTotalCounts()`, `getTopVirtualAssets()` con limit, `getTopUsers()`, `getInteractionsBySection()`, `getTimeSeriesBySection()` con/sin sección, `getTimeSeriesInteractionsByVirtualAsset()` con/sin params opcionales, CRUD `userInteractions` (GET all, GET by ID, POST, PUT, DELETE) |
| `features/dashboard/services/dashboard-metrics.service.spec.ts` | 13 | `loadAllMetrics()` forkJoin (4 llamadas), fallback en error, `loadRankings()` (3 llamadas), error handling, `buildRoleChartData()` pie, `buildUserStatusChartData()` doughnut, `buildSectionChartData()` con colores, `generateTimeLabels()` day/month/year + offset, `getPeriodLabel()` español, `loadVirtualAssets()` caching + invalidación |

#### 7. Componentes

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `features/auth-form/components/auth-form.component.spec.ts` | 14 | Creación del formulario con controles email/password/rememberMe, validaciones required y email, toggle visibility contraseña, submit con formulario inválido (no llama login), submit exitoso (login + redirect a `/dashboard`), errores 401/403/0/429, "Recuérdame" guarda/elimina/restaura email en localStorage |
| `features/stats/zone-visits/zone-visits.component.spec.ts` | 8 | Carga de secciones, llamada inicial a `getTimeSeriesBySection`, click en zona, actualización de chart data, navegación de período |

#### 8. Rutas

| Archivo de prueba | Tests | Qué se prueba |
|---|---|---|
| `app.routes.spec.ts` | 8 | Ruta `/login` con `LoginRedirectGuard`, ruta `/recover-password`, layout principal con `AuthGuard`, 11 rutas hijas (dashboard, users, anchor-points, virtual-assets, map, animator, 5 stats), redirect por defecto a dashboard, wildcard a login, lazy loading verificado, títulos en `data.title` |

---

### Estructura de archivos de prueba

```
src/app/
├── app.routes.spec.ts
├── core/
│   ├── guards/
│   │   ├── auth.guard.spec.ts
│   │   └── login-redirect.guard.spec.ts
│   ├── models/
│   │   └── api-response.model.spec.ts
│   ├── services/
│   │   ├── alert.service.spec.ts
│   │   ├── api-routes.service.spec.ts
│   │   ├── auth.service.spec.ts
│   │   ├── drawer.service.spec.ts
│   │   ├── logger.service.spec.ts
│   │   └── theme-manager.service.spec.ts
│   └── utils/
│       ├── constants.spec.ts
│       ├── helpers.spec.ts
│       └── validators.spec.ts
├── features/
│   ├── anchor-points/
│   │   ├── models/anchor-point.model.spec.ts
│   │   └── services/anchor-point.service.spec.ts
│   ├── auth-form/components/auth-form.component.spec.ts
│   ├── dashboard/services/
│   │   ├── analytics.service.spec.ts
│   │   └── dashboard-metrics.service.spec.ts
│   ├── stats/zone-visits/zone-visits.component.spec.ts
│   ├── users/
│   │   ├── models/user.model.spec.ts
│   │   └── services/user.service.spec.ts
│   └── virtual-assets/
│       ├── models/virtual-asset.model.spec.ts
│       └── services/virtual-asset.service.spec.ts
└── shared/
    └── validators/custom-validators.spec.ts
```

### Pruebas E2E (Integración)

El archivo `src/app/tests/e2e-integration.spec.ts` contiene pruebas de integración con `HttpTestingController` que cubren flujos completos:
- Autenticación (login, error, perfil)
- CRUD de usuarios (crear, listar, toggle active)
- Puntos de anclaje (listar, crear, filtrar por sección)
- Assets virtuales (listar, crear, actualizar secuencia de animación)
- Analytics (usuarios por rol, usuarios activos, totales, top assets, interacciones por sección)
- Flujo completo: registro → login → carga de datos

> **Nota:** Este archivo está excluido de `ng test` en `tsconfig.spec.json`. Para ejecutarlo, actualiza el exclude.

### Tips para ejecutar las pruebas

```bash
# Ejecutar solo un archivo específico
npx ng test --include='**/auth.service.spec.ts'

# Ejecutar en modo watch (re-ejecuta al guardar cambios)
npm test

# Generar reporte de cobertura HTML
npm run test:coverage
# Abrir coverage/index.html en el navegador
```

---

## 📚 Recursos Adicionales

- **[Angular Documentation](https://angular.io/)** - Documentación oficial
- **[Material Design](https://material.angular.io/)** - Componentes de UI
- **[Google Maps API](https://developers.google.com/maps/documentation/javascript)** - Docs de Maps
- **[README Principal](../README.md)** - Documentación del proyecto completo
- **[Backend README](../backend/README.md)** - Documentación del backend

---

## 🆘 Soporte

¿Problemas? Verifica:
1. Variables de entorno en `.env` configuradas
2. Backend corriendo en la URL especificada
3. Node.js versión correcta (18+)
4. Dependencias instaladas correctamente

**Errores comunes:**
- `API_URL not defined` → Configurar `.env`
- `Google Maps error` → Verificar API Key
- `Module not found` → Ejecutar `npm install`

---

**Versión:** 2.0.0  
**Última actualización:** Febrero 2026
