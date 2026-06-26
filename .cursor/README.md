# Configuración Cursor — PCyMT RM

Reglas y ajustes del workspace para **Cursor Agent** en este monorepo. Al clonar el repo, Cursor las carga automáticamente.

## Estructura

```
.cursor/
├── README.md              ← este archivo
├── cli.json               ← permisos CLI del agente (sandbox, shell, MCP)
├── permissions.json       ← allowlist de terminal y auto-run
├── sandbox.json           ← política de red del sandbox
└── rules/                 ← reglas de prompt (always apply)
    ├── ponytail.mdc
    ├── project-docs-context.mdc
    └── response-attribution.mdc
```

## Reglas de prompt (`rules/`)

| Archivo | Propósito |
|---------|-----------|
| **ponytail.mdc** | Modo “lazy senior dev”: YAGNI, reutilizar código, diffs mínimos, tests solo cuando aportan. |
| **project-docs-context.mdc** | Usar `AGENTS.md` y los `.md` del repo como fuente de verdad antes de implementar. |
| **response-attribution.mdc** | Primera línea de cada respuesta del agente: atribución breve (reglas/herramientas usadas). |

Las tres tienen `alwaysApply: true` — aplican en todo el workspace sin @-mencionarlas.

## Archivos de entorno

- **cli.json** — modo de aprobación, sandbox y denegación de lectura/escritura en `.env`.
- **permissions.json** — comandos de terminal permitidos (`npm`, `git`, `gh`, `gradle`, etc.) e instrucciones de auto-run.
- **sandbox.json** — acceso de red del sandbox en el workspace.

## Uso en otro equipo

1. Clonar el repo con la carpeta `.cursor/` incluida.
2. Abrir la raíz del monorepo en Cursor Desktop.
3. Las reglas aparecen en **Cursor Settings → Rules** (project rules).
4. Para cambiar el comportamiento del agente, editar los `.mdc` en `rules/` y hacer commit.

## Relación con `AGENTS.md`

`AGENTS.md` es el contexto de dominio y arquitectura. Las reglas de `.cursor/rules/` definen **cómo** debe trabajar el agente (estilo, documentación, formato de respuestas). Ambos se complementan.
