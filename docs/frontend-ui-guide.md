# Guía UI — Panel Admin (`apps/web-admin`)

Referencia rápida de convenciones visuales y de accesibilidad del frontend Angular 21 + Material 3.

## Tema y tokens

- **Tema M3:** paletas violet (primary) y rose (tertiary) en `src/styles.scss`.
- **Alias globales:** `--sys-*` mapean `--mat-sys-*` para uso en componentes.
- **Tokens semánticos:** `src/styles/_semantic-tokens.scss` — KPI, roles, badges, secciones del parque, medallas de ranking.
- **Preferencia:** usar `var(--sys-primary)`, `var(--semantic-role-admin)`, etc. en lugar de hex sueltos.

### Secciones del parque

| Token | Uso |
|-------|-----|
| `--semantic-section-1` | Tierras Altas |
| `--semantic-section-2` | Tierras Medias |
| `--semantic-section-3` | Tierras Bajas |
| `--semantic-section-4` | Mitos y Leyendas |

## Botones

| Contexto | Variante Material |
|----------|-------------------|
| Acción principal | `mat-flat-button` |
| Acción secundaria | `mat-stroked-button` |
| Icon-only | `mat-icon-button` + `aria-label` |

Formularios admin: `appearance="outline"`.

## Layout

- **Páginas CRUD/stats:** clases de `src/styles/_page-layout.scss` (`.page-container`, `.page-header`, `.empty-state`).
- **Auth:** clases globales en `src/styles/_auth-layout.scss` (`.auth-shell`, `.auth-card`, …).
- **Sidenav:** `<a mat-button routerLink="…" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">`.
- **Skip link:** enlace `#main-content` en `main-layout`; destino `#main-content` en `.content-wrapper`.

## Accesibilidad

- Icon buttons: siempre `[attr.aria-label]` (preferir clave i18n).
- Estados vacíos: `.empty-state` con icono + texto descriptivo.
- Tablas: fila `*matNoDataRow` cuando no hay datos.
- **`prefers-reduced-motion`:** reglas globales en `styles.scss` reducen animaciones/transiciones.
- Mapa: panel config con `aria-expanded`, `role="status"` en toasts, iconos Material en lugar de emojis.

## i18n

- Claves en `src/app/core/i18n/es.ts` y `en.ts`.
- Pipe: `{{ 'stats.back' | translate }}` — importar `TranslatePipe` en componentes standalone.
- Prefijos: `nav.*`, `header.*`, `auth.*`, `dashboard.*`, `table.*`, `stats.*`, `map.*`, `a11y.*`.

## Mapa del parque

- Fondo del área: `var(--sys-surface)`.
- Panel lateral (`sticker-panel`): acento `--sys-primary`; botones Guardar/Cargar con `mat-icon`.
- Panel config global: `map-layer-config-panel` — Material icons + tokens `--sys-*`.

## Breakpoints

- **768px:** utilidades `.hide-mobile` / `.show-mobile` y drawer en modo `over`.
- **480px:** ajustes adicionales en dashboard KPIs.

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/styles.scss` | Tema M3, reset, scrollbar, skip-link, reduced-motion |
| `src/styles/_semantic-tokens.scss` | Colores de dominio |
| `src/styles/_page-layout.scss` | Layout de páginas y empty states |
| `src/styles/_auth-layout.scss` | Login / recover password |

---

*Última revisión: Fase 3 UX/UI — Marzo 2026*
