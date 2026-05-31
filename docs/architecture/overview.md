# Arquitectura del sistema

PCyMT RM es un **monorepo** con tres aplicaciones y recursos compartidos.

```
pcymt_rm/
├── apps/
│   ├── backend/          → API REST (Node.js + Express + PostgreSQL)
│   ├── web-admin/        → Panel admin (Angular 21)
│   └── mobile-android/   → App visitantes (Kotlin + ARCore)
├── tools/
│   └── cloud-anchor-cli/ → CLI para gestionar Cloud Anchors
├── shared/
│   ├── uploads/          → Modelos 3D, iconos, fotos
│   ├── map-stickers/     → Stickers del mapa (fuente única)
│   └── data/             → Coordenadas GPS, diagrama ER
├── docs/                 → Documentación humana
└── scripts/              → Automatización (tests, dev-start)
```

## Flujo de datos

1. **Admin** usa `web-admin` para crear animales 3D y puntos de anclaje GPS.
2. **Backend** persiste en PostgreSQL y sirve archivos desde `shared/uploads/`.
3. **Visitantes** usan `mobile-android` para descubrir animales con AR.
4. **Cloud Anchors** se gestionan desde la app móvil o con `tools/cloud-anchor-cli`.

Documentación completa: [`AGENTS.md`](../../AGENTS.md)
