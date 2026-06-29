# 🚀 PCyMT RM — Guía de Instalación Rápida

> Guía para levantar el backend y frontend desde cero en una nueva sesión.  
> **Prerrequisito único:** PostgreSQL 18 instalado, contraseña del usuario `postgres`: `Cybercenter1`.  
> **Ejecuta los comandos desde la raíz del repositorio** (`pcymt_rm/`).

---

## 1. Configurar PATH de PostgreSQL

```powershell
$pgPath = "C:\Program Files\PostgreSQL\18\bin"
$env:PATH = "$pgPath;$env:PATH"
$env:PGPASSWORD = "Cybercenter1"
```

## 2. Crear la base de datos

```powershell
psql -U postgres -c "CREATE DATABASE pcymtrm_dev ENCODING 'UTF8' LC_COLLATE 'Spanish_Bolivia.1252' LC_CTYPE 'Spanish_Bolivia.1252' TEMPLATE template0;"
```

> Si ya existe, omite este paso. Verifica con:
> ```powershell
> psql -U postgres -c "SELECT datname FROM pg_database WHERE datname = 'pcymtrm_dev';"
> ```

---

## 3. Crear `.env` del Backend

Archivo: `apps/backend/.env`

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pcymtrm_dev
DB_USER=postgres
DB_PASSWORD=Cybercenter1
DATABASE_URL=postgresql://postgres:Cybercenter1@localhost:5432/pcymtrm_dev

PORT=5000
NODE_ENV=development

JWT_SECRET=pcymt_rm_jwt_secret_dev_2026_secure_key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=pcymt_rm_refresh_secret_dev_2026_secure_key
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:4200
UPLOAD_DIR=../../uploads

EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@pcymt.com
EMAIL_SERVICE=Gmail

GOOGLE_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
```

---

## 4. Crear `.env` del Frontend

Archivo: `apps/web-admin/.env`

```env
API_URL=http://localhost:5000
ENV_NAME=development
PRODUCTION=false
```

---

## 5. Habilitar ejecución de scripts en PowerShell

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

---

## 6. Instalar dependencias npm

```powershell
# Backend
Set-Location "apps/backend"
npm install

# Frontend
Set-Location "..\web-admin"
npm install
```

---

## 7. Ejecutar migraciones y seeders

```powershell
Set-Location "..\backend"

# Migraciones (crea todas las tablas)
npx sequelize-cli db:migrate

# Seeders (datos iniciales: 12 animales, 15 usuarios, 12 puntos de anclaje)
npx sequelize-cli db:seed:all
```

> **Reset completo** (si necesitas empezar de cero):
> ```powershell
> npx sequelize-cli db:migrate:undo:all
> npx sequelize-cli db:migrate
> npx sequelize-cli db:seed:all
> ```

---

## 8. Levantar el Backend

En una terminal **nueva** (o background):

```powershell
Set-Location "apps/backend"
cmd /c "node index.js"
```

✅ Debería mostrar: `[SERVER] Running on port 5000`

---

## 9. Levantar el Frontend

En otra terminal **nueva**:

```powershell
Set-Location "apps/web-admin"
cmd /c "node scripts\load-env.js && npx ng serve --host 0.0.0.0 --port 4200"
```

✅ Debería mostrar: `➜ Local: http://localhost:4200/`

---

## 10. Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Email | `chacolla43@gmail.com` |
| Contraseña | `Cybercenter1` |
| Rol | `admin` |

---

## Resumen de URLs

| Servicio | URL |
|----------|-----|
| Frontend (Panel Admin) | http://localhost:4200 |
| Backend API | http://localhost:5000 |
| Health check | http://localhost:5000/health |

---

## Troubleshooting

### `npm` no se reconoce
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Error de autenticación PostgreSQL
Verificar que `$env:PGPASSWORD = "Cybercenter1"` esté seteado antes de cualquier comando `psql`.

### Puerto 5000 u 4200 ocupado
```powershell
# Ver qué proceso usa el puerto
netstat -ano | findstr ":5000"
# Matar proceso por PID
taskkill /PID <PID> /F
```

### Error `map-3d-renderer.service` faltante
El archivo ya existe en `apps/web-admin/src/app/features/map/services/map-3d-renderer.service.ts`.  
Si falta, revisar el historial de sesiones — fue creado durante la sesión inicial de setup.

### Migraciones fallan
```powershell
# Verificar conexión
$env:PGPASSWORD = "Cybercenter1"
psql -U postgres -d pcymtrm_dev -c "SELECT version();"
```
