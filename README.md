# 🌍 PCyMT RM - Plataforma de Conservación y Mitigación del Tráfico de Especies con Realidad Mixta

Sistema integral de realidad mixta para educación y concientización sobre especies en riesgo, combinando tecnología AR/VR con datos georeferenciales.

## Estructura del monorepo

```
pcymt_rm/
├── apps/backend/           API REST (Node.js + PostgreSQL)
├── apps/web-admin/         Panel de administración (Angular 21)
├── apps/mobile-android/    App para visitantes (Kotlin + ARCore)
├── tools/cloud-anchor-cli/ CLI para Cloud Anchors de Google
├── shared/uploads/         Modelos 3D, iconos, fotos (gitignored)
├── shared/map-stickers/    Stickers del mapa (fuente única)
├── docs/                   Documentación
├── scripts/                Scripts de desarrollo y tests
└── AGENTS.md               Contexto completo para IA
```

---

## 📑 Índice General

- [**Capítulo 1: Inicio Rápido**](#capítulo-1-inicio-rápido) ⚡
- [Capítulo 2: Arquitectura del Sistema](#capítulo-2-arquitectura-del-sistema)
- [Capítulo 3: Tecnologías](#capítulo-3-tecnologías)
- [Capítulo 4: Componentes del Proyecto](#capítulo-4-componentes-del-proyecto)
- [Capítulo 5: Configuración Detallada](#capítulo-5-configuración-detallada)
- [Capítulo 6: Servicios Externos](#capítulo-6-servicios-externos)
- [Capítulo 7: Flujo de Desarrollo](#capítulo-7-flujo-de-desarrollo)
- [Capítulo 8: Despliegue](#capítulo-8-despliegue)
- [Capítulo 9: Solución de Problemas](#capítulo-9-solución-de-problemas)

---

## Capítulo 1: Inicio Rápido

### Visión General

El proyecto consta de **3 componentes**:
1. **Backend API** - Node.js + Express + PostgreSQL
2. **Frontend Web** - Angular 21 + Material Design
3. **App Móvil** - Kotlin + ARCore + Fragments (ViewBinding)

### Prerrequisitos Globales

**Instalaciones necesarias:**
- Node.js 18+ ([Descargar](https://nodejs.org/))
- PostgreSQL 14+ ([Descargar](https://www.postgresql.org/))
- Android Studio ([Descargar](https://developer.android.com/studio))
- Git ([Descargar](https://git-scm.com/))

🔐 **Credenciales de Acceso Administrador (después de ejecutar seeders del backend):**
```
Email:    chacolla43@gmail.com
Password: Cybercenter1
Rol:      admin
```

---

### Configuración Rápida Completa

**1. Clonar repositorio**
```bash
git clone https://github.com/Rybak2001/pcymt_rm.git
cd pcymt_rm
```

**2. Backend Setup (5 minutos)**
```bash
cd apps/backend
npm install
cp .env.example .env
# Editar .env: configurar DB_HOST, DB_USER, DB_PASSWORD, DB_NAME y JWT_SECRET
npm run db:create
npm run db:migrate:all
npm run db:seed:all
npm run dev
```
✅ Backend en: `http://localhost:5000`

Ver guía completa: [Instalación detallada](docs/getting-started/INSTALL.md)

**3. Frontend Setup (3 minutos)**
```bash
cd ../web-admin
npm install
cp .env.example .env
# Editar .env: configurar API_URL=http://localhost:5000
npm start
```
✅ Frontend en: `http://localhost:4200`

Ver guía completa: [Frontend README](apps/web-admin/README.md#capítulo-1-configuración-rápida)

**4. Mobile Setup (10 minutos)**
```bash
cd ../mobile-android
cp local.properties.example local.properties
# Editar local.properties: configurar BASE_URL, WEB_CLIENT_ID, MAPS_API_KEY
# Abrir proyecto en Android Studio
./gradlew assembleDebug
```
✅ APK generado para instalación en dispositivo

Ver guía completa: [Mobile README](apps/mobile-android/README.md#capítulo-1-configuración-rápida)

---

## Capítulo 2: Arquitectura del Sistema

### Diagrama de Alto Nivel

```
┌─────────────────────┐         ┌─────────────────────┐
│   Frontend Web      │         │   Mobile App        │
│   Angular 21        │         │   Kotlin + ARCore   │
│   localhost:4200    │         │   Android Device    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │ HTTP/REST                     │ HTTP/REST
           │ (JWT Auth)                    │ (JWT Auth)
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │   Backend API         │
           │   Express + Node.js   │
           │   localhost:5000      │
           └───────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │PostgreSQL│  │  Redis   │  │  Google  │
  │ Database │  │  Cache   │  │  APIs    │
  └──────────┘  └──────────┘  └──────────┘
```

### Flujo de Datos

**1. Autenticación**
```
Usuario → Frontend/Mobile → Backend API → Google OAuth
  ↓
JWT Token almacenado localmente
  ↓
Todas las requests incluyen: Authorization: Bearer <token>
```

**2. Visualización AR**
```
Mobile App → Solicita modelos → Backend API
  ↓
Backend → Consulta BD → Retorna lista de animales
  ↓
Mobile → Descarga modelos 3D → ARCore renderiza en cámara
```

**3. Puntos de Anclaje**
```
Frontend → Mapa Google Maps → Usuario crea punto
  ↓
Backend → Valida coordenadas → Guarda en BD
  ↓
Mobile → Consulta puntos cercanos → Muestra en AR
```

### Patrones Arquitectónicos

**Backend:** Hexagonal Architecture (Ports & Adapters)
- **API Layer** - Controllers + Routes
- **Domain Layer** - Business Logic + Services
- **Infrastructure Layer** - Database + External APIs

**Frontend:** Feature-based + Standalone Components
- **Core** - Guards + Interceptors + Services
- **Features** - Módulos por funcionalidad
- **Shared** - Componentes reutilizables

**Mobile:** Clean Architecture + MVVM
- **Data** - Repository + API + Database
- **Domain** - Use Cases + Models
- **Presentation** - ViewModels + Compose UI

---

## Capítulo 3: Tecnologías

### Stack Tecnológico

| Componente | Tecnologías |
|------------|-------------|
| **Backend** | Node.js, Express, Sequelize ORM, PostgreSQL, Redis, JWT, Helmet, bcrypt |
| **Frontend** | Angular 21, Material Design, RxJS, TypeScript, SCSS, Google Maps API |
| **Mobile** | Kotlin, Jetpack Compose, ARCore, Hilt, Retrofit, Room, Coil, Google Sign-In |
| **DevOps** | Git, GitHub Actions, Docker, nginx, Render/Railway (deploy) |
| **Testing** | Jest (backend), Jasmine+Karma (frontend), JUnit+Mockk (mobile) |

### Versiones Específicas

**Backend:**
- Node.js: `24.13.0`
- Express: `^4.21.2`
- Sequelize: `^6.37.6`
- PostgreSQL: `14+`

**Frontend:**
- Angular: `21.1.2`
- TypeScript: `~5.7.2`
- Material: `^21.0.4`

**Mobile:**
- Kotlin: `2.1.0`
- ARCore: `1.40.0`
- Compose: `1.8.1`
- minSDK: `30`, targetSDK: `35`

---

## Capítulo 4: Componentes del Proyecto

### 🔧 Backend API

**Responsabilidades:**
- Autenticación y autorización (JWT)
- CRUD de usuarios, modelos 3D, puntos de anclaje
- Integración con Google OAuth y Maps
- Validación de datos
- Rate limiting y seguridad

**Endpoints principales:**
- `/api/auth/*` - Autenticación
- `/api/users/*` - Gestión de usuarios
- `/api/animal-models/*` - Modelos 3D
- `/api/anchor-points/*` - Puntos geográficos
- `/api/interactions/*` - Registro de interacciones

📖 **Guía completa:** [Backend README](apps/backend/README.md)

### 🌐 Frontend Web

**Responsabilidades:**
- Dashboard administrativo
- Visualización de datos
- Gestión de contenido
- Mapa interactivo (Google Maps)
- Panel de estadísticas

**Características:**
- Responsive design
- Animaciones fluidas
- Lazy loading de módulos
- PWA capabilities
- Server-Side Rendering (SSR)

📖 **Guía completa:** [Frontend README](apps/web-admin/README.md)

### 📱 App Móvil Android

**Responsabilidades:**
- Visualización AR de modelos 3D
- Detección de planos con ARCore
- Geolocalización de puntos
- Registro de interacciones
- Sincronización offline

**Características:**
- Realidad aumentada (ARCore)
- Jetpack Compose UI
- Google Sign-In
- Mapas integrados
- Caché local (Room)

📖 **Guía completa:** [Mobile README](apps/mobile-android/README.md)

---

## Capítulo 5: Configuración Detallada

### Variables de Entorno

Cada componente tiene su archivo de configuración:

**Backend: `.env`**
```env
# Obligatorio
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pcymtrm_dev
DB_USER=postgres
DB_PASSWORD=tu_password
# O usar DATABASE_URL directamente:
# DATABASE_URL=postgresql://user:pass@host:5432/db

JWT_SECRET=tu_secret_aqui

# Opcional (defaults funcionales)
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200
```

💡 **Símbolos:** `##!` en `.env.example` indica que hay que descomentar para producción.

Ver completo: [Backend .env.example](apps/backend/.env.example)

**Frontend: `.env`**
```env
# Obligatorio
API_URL=http://localhost:5000

# Opcional
ENV_NAME=development
PRODUCTION=false
```

🔄 **Producción:** Comentar variables de desarrollo y descomentar variables de producción.

Ver completo: [Frontend .env.example](apps/web-admin/.env.example)

**Mobile: `local.properties`**
```properties
# Obligatorio
sdk.dir=C\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
BASE_URL=http://10.0.2.2:5000
WEB_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```
MAPS_API_KEY=tu_maps_key

# Automático (SDK location)
sdk.dir=C\:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
```

Ver completo: [Mobile local.properties.example](apps/mobile-android/local.properties.example)

### Base de Datos

**Diagrama ER completo:** [database-model.mmd](database-model.mmd)  
**Esquema backend:** [shared/data/database-model.mmd](../../shared/data/database-model.mmd)

**Tablas principales:**
- `Users` - Usuarios del sistema
- `AnimalModels` - Modelos 3D de especies
- `AnchorPoints` - Puntos geográficos
- `UserSessions` - Sesiones activas
- `UserInteractions` - Historial de uso

---

## Capítulo 6: Servicios Externos

### Google Cloud Platform

**APIs necesarias:**
1. **OAuth 2.0** - Autenticación
2. **Maps JavaScript API** - Mapas web
3. **Maps SDK for Android** - Mapas móvil
4. **Geocoding API** - Validación de coordenadas

**Setup completo:**

**1. Crear proyecto en Google Cloud**
- https://console.cloud.google.com
- Crear nuevo proyecto `pcymt-rm`

**2. Habilitar APIs**
```
APIs & Services → Library → Buscar y habilitar:
- Google Maps JavaScript API
- Maps SDK for Android
- Geocoding API
```

**3. Crear credenciales**

**a) API Key (Maps):**
```
Credentials → Create Credentials → API Key
- Restringir a dominios permitidos
- Usar en: Frontend y Mobile
```

**b) OAuth Client ID (Web):**
```
Credentials → Create Credentials → OAuth client ID
- Application type: Web application
- Authorized redirect URIs: http://localhost:4200, https://tudominio.com
- Usar en: Backend (GOOGLE_CLIENT_ID)
```

**c) OAuth Client ID (Android):**
```
Credentials → Create Credentials → OAuth client ID
- Application type: Android
- Package name: com.univalle.pedrochacolla
- SHA-1: Obtener con `./gradlew signingReport`
- Usar en: Mobile (WEB_CLIENT_ID)
```

### PostgreSQL Database

**Opción 1: Local**
```bash
# Instalar PostgreSQL
sudo apt-get install postgresql    # Ubuntu/Debian
brew install postgresql@14          # macOS
choco install postgresql14          # Windows

# Crear base de datos
createdb pcymt_rm_db

# Connection string
DATABASE_URL=postgresql://user:password@localhost:5432/pcymt_rm_db
```

**Opción 2: Cloud (Render/Supabase)**
```
1. Crear cuenta en render.com o supabase.com
2. Crear PostgreSQL database
3. Copiar connection string
4. Pegar en DATABASE_URL del backend
```

### Redis Cache (Opcional)

**Para producción (mejora performance):**

```bash
# Local
docker run -d -p 6379:6379 redis:alpine

# Cloud
# Usar Render Redis o Upstash
REDIS_URL=redis://usuario:password@host:6379
```

---

## Capítulo 7: Flujo de Desarrollo

### Workflow Recomendado

**1. Crear feature branch**
```bash
git checkout -b feature/nueva-funcionalidad
```

**2. Desarrollo**
- Backend: Escribir pruebas → Implementar → Validar
- Frontend: Diseñar UI → Conectar API → Testear
- Mobile: Diseñar UX → Implementar lógica → Probar en dispositivo

**3. Testing**
```bash
# Backend
cd apps/backend
npm test

# Frontend
cd apps/web-admin
npm test

# Mobile
cd apps/mobile-android
./gradlew test
```

**4. Commit**
```bash
git add .
git commit -m "feat: descripción de la funcionalidad"
```

**5. Push y Pull Request**
```bash
git push origin feature/nueva-funcionalidad
# Crear PR en GitHub
```

### Convenciones de Código

**Commits (Conventional Commits):**
```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formato
refactor: refactorización
test: pruebas
chore: mantenimiento
```

**Naming:**
- **Variables:** camelCase
- **Clases:** PascalCase
- **Constantes:** UPPER_SNAKE_CASE
- **Archivos:** kebab-case.extension

---

## Capítulo 8: Despliegue

### Backend (Production)

**Opción 1: Render**
```yaml
# render.yaml
services:
  - name: pcymt-backend
    type: web
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase: pcymt-db
      - key: JWT_SECRET
        generateValue: true
```

**Opción 2: Railway**
```bash
# Instalar CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Frontend (Production)

**Opción 1: Vercel**
```bash
# Instalar CLI
npm i -g vercel

# Deploy
cd apps/web-admin
vercel --prod
```

**Opción 2: Netlify**
```bash
# Build settings
build command: npm run build
publish directory: dist/angular-front/browser
```

**Opción 3: nginx (VPS)**
```bash
npm run build
scp -r dist/angular-front/browser/* user@server:/var/www/html/
```

### Mobile (Production)

**Google Play Store:**

1. **Generar keystore firmado**
```bash
cd apps/mobile-android
./gradlew bundleRelease
```

2. **Subir a Play Console**
- https://play.google.com/console
- Create app → Upload bundle
- Complete store listing
- Submit for review

Ver guía completa: [Mobile README - Capítulo 8](apps/mobile-android/README.md#capítulo-8-firma-de-apk)

---

## Capítulo 9: Solución de Problemas

### Errores Comunes

**Backend:**

❌ **`DATABASE_URL not found`**
```bash
# Verificar .env existe y contiene DATABASE_URL
cp .env.example .env
nano .env  # Editar manualmente
```

❌ **`Port 5000 already in use`**
```bash
# Cambiar puerto en .env
PORT=5001

# O matar proceso
lsof -ti:5000 | xargs kill -9  # Linux/Mac
netstat -ano | findstr :5000   # Windows
```

❌ **`JWT_SECRET is not set`**
```bash
# Generar secret seguro
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copiar output a .env
```

**Frontend:**

❌ **`API_URL not defined`**
```bash
# Verificar .env contiene API_URL
echo "API_URL=http://localhost:5000" > .env
# Reiniciar: npm start
```

❌ **`Google Maps error`**
```bash
# Verificar API Key válida
# Verificar API habilitada en Google Cloud Console
# Verificar restricciones de dominio
```

**Mobile:**

❌ **`BASE_URL not set`**
```bash
# Verificar local.properties existe
cp local.properties.example local.properties
# Editar BASE_URL (usar 10.0.2.2 para emulador)
```

❌ **`ARCore not supported`**
```bash
# Verificar dispositivo compatible:
# https://developers.google.com/ar/devices
# Instalar Google Play Services for AR
```

❌ **`Google Sign-In failed`**
```bash
# Obtener SHA-1:
./gradlew signingReport
# Agregar a Google Cloud Console
# Esperar 5 minutos para propagación
```

### Logs y Debug

**Backend:**
```bash
# Ver logs en desarrollo
npm run dev

# Modo debug
npm run dev:debug
# Abrir chrome://inspect
```

**Frontend:**
```bash
# DevTools del navegador
F12 → Console

# Logs de compilación
ng serve --verbose
```

**Mobile:**
```bash
# Logcat
adb logcat | grep PCymtRM

# Android Studio
View → Tool Windows → Logcat
```

---

## 📚 Documentación por Componente

### Guías Detalladas

- **[Backend README](apps/backend/README.md)** - API, base de datos, autenticación
- **[Frontend README](apps/web-admin/README.md)** - UI, componentes, servicios
- **[Mobile README](apps/mobile-android/README.md)** - ARCore, Kotlin, Android

### Diagramas

- **[Modelo de Base de Datos](database-model.mmd)** - Esquema completo ER
- **[Esquema Backend](apps/backend/database-schema.mmd)** - Detalles de BD

---

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch
3. Commit cambios
4. Push a la rama
5. Abrir Pull Request

**Código de conducta:** Respetar convenciones y escribir pruebas.

---

## 📄 Licencia

Proyecto académico - Universidad del Valle

---

## 👥 Equipo

**Desarrollo:** Pedro Chacolla Rybak  
**Contacto:** pedro.rybak@univalle.edu  
**Repositorio:** https://github.com/Rybak2001/pcymt_rm

---

**Versión:** 2.0.0  
**Última actualización:** Febrero 2026

---

## 🚀 Quick Links

| Acción | Link |
|--------|------|
| **Backend Setup** | [Ver guía](apps/backend/README.md#capítulo-1-configuración-rápida) |
| **Frontend Setup** | [Ver guía](apps/web-admin/README.md#capítulo-1-configuración-rápida) |
| **Mobile Setup** | [Ver guía](apps/mobile-android/README.md#capítulo-1-configuración-rápida) |
| **Google APIs** | [Configurar](httpsconsole.cloud.google.com) |
| **Base de Datos** | [Diagrama](database-model.mmd) |
| **Reportar Issue** | [GitHub Issues](https://github.com/Rybak2001/pcymt_rm/issues) |
