# Frontend Web Admin — Contexto para IA

Panel de administración Angular 21 en `apps/web-admin/`. **Los visitantes usan la app móvil**, no este frontend.

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`../../AGENTS.md`](../../AGENTS.md) §5 | Rutas, features, patrones Angular |
| [`../../docs/project-audit.md`](../../docs/project-audit.md) §2 | Auditoría: qué está bien/mal, prioridades |
| [`../../docs/frontend-ui-guide.md`](../../docs/frontend-ui-guide.md) | Tema M3, tokens, i18n, a11y |

## Estado rápido (Jun 2026)

- **Deploy:** Vercel → `dist/angular-front/browser`; API via `scripts/load-env.js`.
- **UX:** Fases 1–3 aplicadas (a11y, i18n stats, tokens semánticos).
- **Crítico:** sin `AdminGuard`; mapa/animator aún con strings ES hardcodeados.
- **Peso:** Chart.js global; mapa ~4k LOC en componentes lazy.

## Comandos

```bash
cd apps/web-admin && npm install && npm start   # :4200
npm run build
npm test
```
