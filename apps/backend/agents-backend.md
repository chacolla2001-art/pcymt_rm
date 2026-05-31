# Backend — Contexto para IA

Documentación completa del backend en [`../../AGENTS.md`](../../AGENTS.md) (secciones 4, 8, 9, 14).

Este componente vive en `apps/backend/`.

## Setup Supabase (cloud)

Desde la raíz del monorepo:

```bash
./scripts/supabase-login.sh          # autenticar CLI (una vez)
./scripts/setup-supabase.sh          # uploads + migrate + seed
```

Variables opcionales: `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`.

Ver también: [`../../scripts/setup-supabase.sh`](../../scripts/setup-supabase.sh)
