# Pipeline de contenido — PCyMT RM

Flujo para que el staff suba animales 3D e iconos y los visitantes los vean en móvil.

## 1. Nuevo animal (staff)

1. Inicia sesión en el panel web (`admin` / `moderator`).
2. **Contenido 3D** → Crear:
   - Archivo `.glb` (modelo 3D, &lt; 5 MB recomendado)
   - Archivo `.png` icono (512×512 transparente)
3. **Puntos de anclaje** → Crear ubicación GPS + asociar virtual asset.
4. (Opcional) En el parque, modo admin móvil → colocar Cloud Anchor.

## 2. Dónde se guardan los archivos

| Entorno | Escritura | Lectura |
|---------|-----------|---------|
| **Local** | `shared/uploads/` (Multer) | `/api/files/:filename` |
| **Producción (Vercel)** | **Supabase Storage** si `SUPABASE_SERVICE_ROLE_KEY` está configurada | `/api/files/` → proxy Supabase |

Variables requeridas en producción:

```env
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_STORAGE_BUCKET=uploads
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3. Jerarquía del bucket `uploads` (Supabase)

```
uploads/
├── model-icons/*.png              ← avatares predefinidos (script upload-avatars-supabase.js)
├── profile-pictures/{userId}.webp ← fotos de perfil personalizadas (API PATCH profile-picture)
├── bear.glb, cow.glb, …           ← modelos 3D (legacy en raíz; ideal: map-models/)
└── (NO usar) avatars/             ← ruta legacy, migrada a model-icons/
```

Auditar el bucket:

```bash
vercel env pull /tmp/pcymt-api-env.txt --environment=production
node scripts/audit-supabase-storage.mjs
```

## 4. Subida de avatares predefinidos

Los avatares usan la ruta canónica `/api/files/model-icons/*.png`:

```bash
node scripts/upload-avatars-supabase.js
```

Fuente local: `shared/uploads/model-icons/`.

## 5. Configuración ARCore (TTL anclas)

- Panel **Configuración** → TTL Cloud Anchors.
- En producción se persiste en tabla `app_settings` (no en `runtime-config.json`).
- Fallback local: `apps/backend/runtime-config.json` (gitignored).

Migración:

```bash
cd apps/backend && npm run db:migrate
```

## 5. Verificación post-deploy

1. Sube un icono desde web en producción.
2. `GET /api/virtual-assets/active` → URL `/api/files/...`.
3. Abre la app móvil → el icono carga tras refresh (Glide + JWT).

## 6. Geometría del mapa

Editar **un solo lugar**: `shared/data/park-boundary.json` y `park-sections.json`, luego redeploy web + APK.

```bash
node scripts/export-park-shared-data.mjs   # solo si partiste del editor web legacy
```
