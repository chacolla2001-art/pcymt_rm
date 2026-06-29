# Smoke test manual — PCyMT RM

Checklist rápido antes de demo, defensa TFG o deploy. Duración ~15 min.

## Visitante (app Android — Juku Go)

1. **Instalar / abrir** APK debug o release con `BASE_URL` apuntando al API correcto.
2. **Onboarding** — completar 3 pantallas → “Empezar a explorar”.
3. **Login** — cuenta visitante (`user`) o registro nuevo.
4. **Inicio** — ver progreso `X / 12` y CTA “Explorar el parque”.
5. **Encuentro** — tab Mapa → acercarse a un punto → guardar encuentro → ver ficha educativa y progreso actualizado en Colección.

**Criterio OK:** un animal pasa de no encontrado a encontrado sin crash; banner fuera del parque solo informa (no bloquea).

## Staff (panel web)

1. **Login** — cuenta `admin` o `moderator` en `/login`.
2. **Acceso denegado** — login con rol `user` debe ir a `/access-denied` (no al dashboard).
3. **Dashboard** — KPIs y gráficos cargan (Chart.js en ruta lazy).
4. **CRUD** — listar usuarios; abrir mapa del parque; subir o editar un virtual asset (si Supabase configurado en prod).

**Criterio OK:** visitante no accede a `/users`; staff sí.

## API (opcional, curl)

```bash
# Público
curl -s "$API/api/config" | head -c 200

# 401 sin token
curl -s -o /dev/null -w "%{http_code}" "$API/api/auth/me"

# Integración automatizada (requiere PostgreSQL)
cd apps/backend && npm run test:integration
```

## CI (GitHub Actions)

| Workflow | Qué valida |
|----------|------------|
| `backend-ci.yml` | lint, migrate, unit + integration tests |
| `frontend-ci.yml` | build Angular producción |
| `mobile-ci.yml` | unit tests + `assembleDebug` |

## Live smoke (servidor local)

Con backend en `localhost:5000`:

```bash
cd apps/backend && RUN_LIVE_SMOKE=1 BASE_URL=http://localhost:5000 npm test -- tests/smoke.test.js
```
