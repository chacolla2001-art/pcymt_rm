# App Móvil Android — Contexto para IA

App visitante (y admin legacy en mismo APK) en `apps/mobile-android/`.

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`../../AGENTS.md`](../../AGENTS.md) §6 | Pantallas, AR, networking |
| [`../../docs/project-audit.md`](../../docs/project-audit.md) §4 | Auditoría: 3 modos AR, deuda, admin en APK |
| [`../../docs/ar/mixed-reality.md`](../../docs/ar/mixed-reality.md) | Cloud anchors, flujos RM |

## Estado rápido (Jun 2026)

- **UI:** ViewBinding + Fragments (**no Compose** — ignorar README antiguo).
- **AR:** RM (`ArFragment`), Juku Go (`ArMapFragment`), RA simple (`ArSimpleFragment`).
- **Perfil:** avatares desde `GET /api/config` + `PATCH avatar`.
- **Crítico:** fragments muy grandes; admin duplica web; `TileMapView` sin usar.

## Comandos

```bash
cd apps/mobile-android && ./gradlew assembleDebug
./gradlew installDebug
./gradlew test
```
