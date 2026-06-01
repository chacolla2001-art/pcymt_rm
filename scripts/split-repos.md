# Separar el monorepo en repositorios independientes

Objetivo: un repo por app para que **Vercel** (y GitHub Actions) desplieguen con solo conectar el repo en el dashboard.

## Repos recomendados

| Repo GitHub | Contenido | Vercel Root Directory |
|-------------|-----------|------------------------|
| `pcymt-rm-api` | `apps/backend` + `shared/uploads` (opcional, mejor Supabase) | `.` |
| `pcymt-rm-web` | `apps/web-admin` | `.` |
| `pcymt-rm-android` | `apps/mobile-android` | — (APK / Play Store) |

## Pasos (git filter-repo)

```bash
# Instalar: pip install git-filter-repo

# 1. Backend
git clone https://github.com/chacolla2001-art/pcymt_rm.git pcymt-rm-api
cd pcymt-rm-api
git filter-repo --path apps/backend --path shared/uploads --path-rename apps/backend/:
git remote add origin https://github.com/chacolla2001-art/pcymt-rm-api.git
git push -u origin main

# 2. Frontend
git clone https://github.com/chacolla2001-art/pcymt_rm.git pcymt-rm-web
cd pcymt-rm-web
git filter-repo --path apps/web-admin --path-rename apps/web-admin/:
# Copiar shared/map-stickers al repo o publicar como npm package
git remote add origin https://github.com/chacolla2001-art/pcymt-rm-web.git
git push -u origin main

# 3. Android
git clone https://github.com/chacolla2001-art/pcymt_rm.git pcymt-rm-android
cd pcymt-rm-android
git filter-repo --path apps/mobile-android --path-rename apps/mobile-android/:
git remote add origin https://github.com/chacolla2001-art/pcymt-rm-android.git
git push -u origin main
```

## Vercel (después del split)

1. [vercel.com/new](https://vercel.com/new) → Importar `pcymt-rm-api`
2. Framework: **Other** (Express serverless) o usar `vercel.json` existente
3. Repetir con `pcymt-rm-web` (Angular)
4. Variables de entorno: copiar desde proyectos actuales `pcymt-rm-api` / `pcymt-rm-web`

Con Git conectado, cada `git push` a `main` despliega automáticamente sin GitHub Actions extra.

## Alternativa sin split

Mantener monorepo y conectar **un proyecto Vercel por carpeta** (`Root Directory`: `apps/backend`, `apps/web-admin`) en [github.com/apps/vercel](https://github.com/apps/vercel).
