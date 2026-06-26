# Backend — Contexto para IA

API REST Node.js + Express + Sequelize en `apps/backend/`.

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`../../AGENTS.md`](../../AGENTS.md) §4, 8, 9 | Endpoints, tablas, flujos |
| [`../../docs/project-audit.md`](../../docs/project-audit.md) §3 | Auditoría: RBAC, Vercel, uploads |

## Estado rápido (Jun 2026)

- **Deploy:** Vercel serverless (`api/index.js`); PostgreSQL cloud (Supabase/Neon).
- **Archivos:** lectura híbrida local/Supabase; **escritura Multer local** — problemática en Vercel.
- **Avatares:** `predefinedAvatars.js`, `PATCH /api/users/:id/avatar`, listado en `GET /api/config`.
- **Crítico:** RBAC casi ausente; tests integración con rutas legacy `/api/v1/`.

## Setup Supabase (cloud)

```bash
./scripts/supabase-login.sh
./scripts/setup-supabase.sh
```

Variables: `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`.

## Comandos

```bash
cd apps/backend && npm install && npm run dev   # :5000
npm test
npm run db:reset
```
