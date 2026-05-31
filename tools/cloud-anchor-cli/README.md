# Administrador de ARCore Cloud Anchors

Herramienta CLI para administrar los **Cloud Anchors** del proyecto PCyMT RM desde la línea de comandos.

Permite listar, inspeccionar, eliminar y sincronizar los anchors de Google ARCore Cloud con la base de datos local de la plataforma.

---

## ⚠️ CONFIGURACIÓN PREVIA OBLIGATORIA

Antes de poder usar la herramienta, debes agregar la URI de redirección al cliente OAuth2 del proyecto en Google Cloud Console.

### Paso 1 — Agregar Redirect URI en Google Cloud Console

1. Ve a: **https://console.cloud.google.com/apis/credentials**
2. Selecciona el proyecto `pcymt-rm` (ID: `715749958092`)
3. Haz clic en el cliente OAuth2 **Web client** (tu cliente existente)
4. En la sección **"URIs de redireccionamiento autorizadas"**, haz clic en **"+ Agregar URI"**
5. Escribe exactamente: `http://127.0.0.1:18765/oauth2callback`
6. Haz clic en **Guardar**

> Sin este paso, recibirás un error `redirect_uri_mismatch` al intentar autenticarte.

### Paso 2 — Verificar que la ARCore API está habilitada

1. Ve a: **https://console.cloud.google.com/apis/library/arcorecloudanchor.googleapis.com**
2. Asegúrate de que la API esté habilitada para el proyecto.

---

## Instalación

```bash
cd tools/cloud-anchor-cli
npm install
```

---

## Uso

```bash
npm start
# o equivalente:
node index.js
```

### Modo debug (muestra stack traces en errores)

```bash
DEBUG=true node index.js
```

---

## Primera ejecución

1. La herramienta verificará si el backend (`http://localhost:5000`) está disponible.
2. Abrirá tu navegador con la página de autenticación de Google.
3. Inicia sesión con `chacolla43@gmail.com` y concede los permisos solicitados.
4. Serás redirigido automáticamente a `http://127.0.0.1:18765/oauth2callback`.
5. El token quedará guardado en `.token.json` para sesiones futuras.

El token se renueva automáticamente. Solo necesitarás volver a autenticarte si el refresh token expira (>6 meses de inactividad) o usas la opción **Re-autenticar con Google** del menú.

---

## Menú de opciones

| Opción | Descripción |
|--------|-------------|
| 📋 Listar todos los Cloud Anchors | Muestra todos los anchors de ARCore con estado (activo/expirado), fecha de creación, vencimiento y referencia cruzada con la BD local |
| 🔍 Ver detalles de un Anchor | Muestra información completa de un anchor: ID, fechas, última localización, y a qué location de la BD está vinculado |
| 🗄️ Ver Anchor Points de la BD local | Lista todas las locations de la BD con sus coordenadas, sección, animal vinculado y anchor_code actual |
| 🔄 Comparar ARCore ↔ BD | Muestra qué anchors de la BD existen en ARCore, cuáles están expirados y cuáles son huérfanos |
| ✏️ Actualizar anchor_code en BD | Permite cambiar o limpiar el `anchor_code` de cualquier location en la BD |
| 🧹 Limpiar anchor_codes huérfanos | Elimina de la BD los `anchor_code` que ya no existen en ARCore |
| 🗑️ Eliminar un Anchor de ARCore | Elimina permanentemente un cloud anchor de Google ARCore |
| 💥 Eliminar TODOS los anchors expirados | Elimina en masa todos los anchors expirados de ARCore y opcionalmente limpia la BD |
| 🔐 Re-autenticar con Google | Elimina el token guardado y abre el navegador para una nueva autenticación |

---

## Estructura de archivos

```
tools/cloud-anchor-cli/
├── index.js           ← CLI principal (este archivo se ejecuta)
├── package.json
├── .env               ← Credenciales (no se sube a git)
├── .token.json        ← Token OAuth2 guardado (se genera automáticamente)
├── .gitignore
└── lib/
    ├── auth.js        ← OAuth2 flow con Google (token persistente)
    ├── arcore.js      ← Cliente REST API de ARCore Management v1beta2
    ├── backend.js     ← Cliente del backend local (JWT auth)
    └── display.js     ← Tablas formateadas con chalk + cli-table3
```

---

## Variables de entorno (.env)

```dotenv
# Cliente OAuth2 Web (Google Cloud Console)
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret

# Backend local de PCyMT RM
BACKEND_URL=http://localhost:5000
ADMIN_EMAIL=tu-email@ejemplo.com
ADMIN_PASSWORD=tu-contraseña-admin
```

---

## Notas sobre Cloud Anchors

- Los Cloud Anchors se crean desde la **app móvil** al colocar un modelo 3D en AR.
- Cada anchor tiene un tiempo de vida máximo definido por ARCore (normalmente ~365 días).
- Un anchor **expirado** significa que el modelo AR ya no podrá localizarse en ese punto. Se debe volver a colocar desde la app.
- El `anchor_code` en la BD local es el ID retornado por ARCore en formato `ua:XXXXXXXXXXXX`.

---

## Requisitos

- Node.js ≥ 18
- Acceso a internet (para ARCore Management API)
- Backend local corriendo en `http://localhost:5000` (para funciones de BD)
- Cuenta Google: `chacolla43@gmail.com` con acceso al proyecto GCP `715749958092`
