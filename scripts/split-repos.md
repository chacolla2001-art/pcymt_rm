# Separar el monorepo en repositorios independientes

Objetivo: un repo por app para que **Vercel** despliegue con solo conectar el repo en el dashboard.

## Estado (Jun 2026)

| Repo | URL | Deploy |
|------|-----|--------|
| `pcymt-rm-api` | https://github.com/chacolla2001-art/pcymt-rm-api | **Manual** (ver `scripts/deploy-vercel-manual.md`) |
| `pcymt-rm-web` | https://github.com/chacolla2001-art/pcymt-rm-web | **Manual** |
| `pcymt-rm-android` | https://github.com/chacolla2001-art/pcymt-rm-android | APK manual |
| Monorepo | https://github.com/chacolla2001-art/pcymt_rm | **Manual** desde `apps/backend` y `apps/web-admin` |

**No hay GitHub Actions de deploy a Vercel.** Solo tests en CI (`backend-ci`, `frontend-ci`).

**Script para crear repos separados:** `./scripts/split-repos.sh`

## Deploy manual

Ver guía completa: [`scripts/deploy-vercel-manual.md`](./deploy-vercel-manual.md)

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

Deploy **manual** desde cada repo clonado o desde el monorepo (`apps/backend`, `apps/web-admin`).  
Guía: [`deploy-vercel-manual.md`](./deploy-vercel-manual.md)

## Alternativa sin split

Mantener monorepo y desplegar manualmente desde `apps/backend` y `apps/web-admin`.
