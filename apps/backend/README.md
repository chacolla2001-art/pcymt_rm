# 🚀 Backend API - Node.js + Express + PostgreSQL

Sistema de gestión de realidad mixta con autenticación, base de datos y servicios REST.

---

## 📑 Índice

- [**Capítulo 1: Configuración Rápida**](#capítulo-1-configuración-rápida) ⚡
- [Capítulo 2: Estructura del Proyecto](#capítulo-2-estructura-del-proyecto)
- [Capítulo 3: Base de Datos](#capítulo-3-base-de-datos)
- [Capítulo 4: API Endpoints](#capítulo-4-api-endpoints)
- [Capítulo 5: Seguridad](#capítulo-5-seguridad)
- [Capítulo 6: Servicios Externos](#capítulo-6-servicios-externos)
- [Capítulo 7: Comandos Útiles](#capítulo-7-comandos-útiles)
- [Capítulo 8: Pruebas](#capítulo-8-pruebas)

---

## Capítulo 1: Configuración Rápida

🔐 **Credenciales de Acceso Administrador (después de ejecutar seeders):**
```
Email:    chacolla43@gmail.com
Password: Cybercenter1
Rol:      admin
```

---

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Pasos

**1. Clonar y entrar al directorio**
```bash
cd apps/backend
```

**2. Instalar dependencias**
```bash
npm install
```

**3. Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env` y configurar:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Conexión a PostgreSQL (o usar `DATABASE_URL` directamente)
- `JWT_SECRET` - Secret para tokens (generar con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")`

💡 **Nota:** En `.env.example` las líneas con `##!` indican valores que hay que descomentar (quitar `##!`) para producción.

🔄 **Para cambiar a producción:** Comentar variables de desarrollo (agregar `#`) y descomentar variables de producción (quitar `##!`).

**4. Crear base de datos**
```bash
npm run db:create
```

**5. Ejecutar migraciones**
```bash
npm run db:migrate:all
```

**6. Cargar datos iniciales (opcional)**
```bash
npm run db:seed:all
```

**7. Iniciar servidor**
```bash
npm run dev
```

✅ **Servidor corriendo en:** `http://localhost:5000`

---

## Capítulo 2: Estructura del Proyecto

```
apps/backend/
├── src/
│   ├── api/              # Capa de presentación
│   │   ├── controllers/    # Controladores HTTP
│   │   ├── routes/         # Rutas Express
│   │   └── middlewares/    # Middlewares HTTP
│   ├── domain/           # Lógica de negocio
│   │   ├── services/       # Servicios de dominio
│   │   └── repositories/   # Interfaces de persistencia
│   ├── infrastructure/   # Implementaciones técnicas
│   │   ├── database/       # Modelos Sequelize
│   │   ├── cache/          # Redis
│   │   └── external/       # APIs externas
│   ├── shared/           # Código compartido
│   │   ├── utils/          # Utilidades
│   │   ├── errors/         # Manejo de errores
│   │   └── constants/      # Constantes
│   └── config/           # Configuración
├── migrations/           # Migraciones de BD
├── seeders/              # Datos iniciales
└── tests/                # Pruebas automatizadas
```

**Arquitectura:** Hexagonal (Ports & Adapters)

---

## Capítulo 3: Base de Datos

### Modelos Principales

- **Users** - Usuarios del sistema
- **AnimalModels** - Modelos 3D de animales
- **AnchorPoints** - Puntos de anclaje geográficos
- **UserSessions** - Sesiones activas
- **UserInteractions** - Interacciones con modelos

### Migraciones

```bash
# Ejecutar todas las migraciones
npm run db:migrate:all

# Revertir última migración
npm run db:migrate:undo

# Revertir todas las migraciones
npm run db:migrate:undo:all

# Revertir migración específica
npm run db:migrate:undo --name 20260115090000-create-users.js

# Estado de migraciones
npx sequelize-cli db:migrate:status
```

### Seeders

```bash
# Cargar todos los seeders
npm run db:seed:all

# Revertir todos los seeders
npm run db:seed:undo:all

# Revertir último seeder
npm run db:seed:undo
```

### Resetear BD completa

```bash
npm run db:reset
```

---

## Capítulo 4: API Endpoints

### Autenticación
```
POST   /api/auth/register          # Registro
POST   /api/auth/login             # Login
POST   /api/auth/google            # Login con Google
POST   /api/auth/refresh           # Renovar token
POST   /api/auth/logout            # Cerrar sesión
```

### Usuarios
```
GET    /api/users                  # Listar usuarios (admin)
GET    /api/users/:id              # Obtener usuario
PUT    /api/users/:id              # Actualizar usuario
DELETE /api/users/:id              # Eliminar usuario
```

### Modelos de Animales
```
GET    /api/animal-models          # Listar modelos
GET    /api/animal-models/:id      # Obtener modelo
POST   /api/animal-models          # Crear modelo (admin)
PUT    /api/animal-models/:id      # Actualizar modelo (admin)
DELETE /api/animal-models/:id      # Eliminar modelo (admin)
```

### Puntos de Anclaje
```
GET    /api/anchor-points          # Listar puntos
GET    /api/anchor-points/:id      # Obtener punto
POST   /api/anchor-points          # Crear punto
PUT    /api/anchor-points/:id      # Actualizar punto
DELETE /api/anchor-points/:id      # Eliminar punto
```

### Interacciones
```
POST   /api/interactions           # Registrar interacción
GET    /api/interactions/user/:id  # Historial de usuario
GET    /api/interactions/model/:id # Stats de modelo
```

**Documentación completa:** Importar `docs/postman_collection.json` en Postman

---

## Capítulo 5: Seguridad

### Autenticación JWT

Todas las rutas protegidas requieren header:
```
Authorization: Bearer <token>
```

**Configuración en `.env`:**
- `JWT_SECRET` - Secret para firmar tokens
- `JWT_EXPIRES_IN` - Duración del token (default: 24h)

### CORS

**Desarrollo:**
```env
CORS_ORIGIN=*
```

**Producción:**
```env
CORS_ORIGIN=https://tudominio.com,https://app.tudominio.com
```

### Rate Limiting

Protección contra ataques DDoS:
- **Window:** 15 minutos (configurable con `RATE_LIMIT_WINDOW_MS`)
- **Máx requests:** 100 por IP (configurable con `RATE_LIMIT_MAX`)

### Validación de Datos

Todas las entradas son validadas con:
- **express-validator** - Validación de parámetros
- **sanitización** - Limpieza de inputs
- **schemas** - Validación de estructura

---

## Capítulo 6: Servicios Externos

### Google OAuth

Permite login con cuenta de Google.

**1. Crear proyecto en Google Cloud**
- https://console.cloud.google.com

**2. Habilitar OAuth 2.0**
- Crear credenciales OAuth 2.0
- Agregar URIs autorizados

**3. Configurar en `.env`**
```env
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=tu-android-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
```

### Google Maps API
### Email (SMTP)

Para recuperación de contraseñas y notificaciones.

**Gmail example:**
```env
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
```

**Nota:** Usar "App Password" no la contraseña normal.

### Redis Cache (Opcional)

Para mejorar performance en producción.

```env
REDIS_URL=redis://localhost:6379
```

---

## Capítulo 7: Comandos Útiles

### Desarrollo
```bash
npm run dev              # Servidor con hot-reload
npm run dev:debug        # Con inspector de Node.js
npm run start            # Servidor producción
```

### Base de Datos
```bash
npm run db:create        # Crear base de datos
npm run db:drop          # Eliminar base de datos
npm run db:migrate:all  # Ejecutar migraciones
npm run db:migrate:undo  # Revertir última migración
npm run db:migrate:undo:all # Revertir todas las migraciones
npm run db:seed:all      # Cargar datos iniciales
npm run db:seed:undo     # Revertir último seeder
npm run db:seed:undo:all # Limpiar todos los datos de seed
npm run db:reset         # Resetear BD completa (undo all + migrate + seed)
```

### Linting y Formato
```bash
npm run lint             # Verificar código
npm run lint:fix         # Corregir automáticamente
```

### Utilidades
```bash
npm run validate:env     # Validar variables de entorno
```

---

## Capítulo 8: Pruebas

### Tipos de Pruebas

**Unitarias** - Funciones individuales
**Integración** - Endpoints completos
**E2E** - Flujos completos de usuario

### Ejecutar Pruebas

```bash
# Todas las pruebas
npm test

# Solo unitarias
npm run test:unit

# Solo integración
npm run test:integration

# Con coverage
npm run test:coverage

# Modo watch
npm run test:watch
```

### Estructura de Pruebas

```
tests/
├── unit/              # Pruebas unitarias
│   ├── services/
│   ├── repositories/
│   └── utils/
├── integration/       # Pruebas de integración
│   ├── auth.test.js
│   ├── users.test.js
│   └── animal-models.test.js
└── setup.js           # Configuración global
```

### Escribir Nuevas Pruebas

```javascript
const request = require('supertest');
const app = require('../src/app');

describe('GET /api/animals', () => {
  it('debe retornar lista de animales', async () => {
    const response = await request(app)
      .get('/api/animal-models')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

---

## 📚 Recursos Adicionales

- **[Diagrama de BD](database-schema.mmd)** - Esquema completo de base de datos
- **[README Principal](../README.md)** - Documentación del proyecto completo
- **[Frontend README](../web-admin/README.md)** - Documentación del frontend
- **[Mobile README](../mobile-android/README.md)** - Documentación de la app móvil

---

## 🆘 Soporte

¿Problemas? Verifica:
1. Variables de entorno configuradas correctamente
2. PostgreSQL corriendo
3. Migraciones ejecutadas
4. Puerto 5000 disponible

**Errores comunes:** Ver sección de troubleshooting en el README principal.

---

**Versión:** 2.0.0  
**Última actualización:** Febrero 2026
