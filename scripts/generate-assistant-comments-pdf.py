#!/usr/bin/env python3
"""Genera PDF con las 4 respuestas del asistente sobre auditoría del proyecto PCyMT RM."""

from pathlib import Path
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "PCyMT-Comentarios-Asistente.pdf"
FONT = "/usr/share/fonts/google-carlito-fonts/Carlito-Regular.ttf"
FONT_B = "/usr/share/fonts/google-carlito-fonts/Carlito-Bold.ttf"
FONT_I = "/usr/share/fonts/google-carlito-fonts/Carlito-Italic.ttf"


class Doc(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font("Carlito", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Página {self.page_no()}", align="C")


def section(pdf: Doc, title: str, level: int = 1):
    pdf.ln(4 if level > 1 else 6)
    size = 16 if level == 1 else (13 if level == 2 else 11)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "B", size)
    pdf.set_text_color(40, 40, 80 if level == 1 else 50)
    pdf.multi_cell(pdf.epw, 7, title)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)


def body(pdf: Doc, text: str):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "", 10)
    pdf.multi_cell(pdf.epw, 5.5, text)
    pdf.ln(1)


def bullet(pdf: Doc, text: str):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "", 10)
    pdf.multi_cell(pdf.epw, 5.5, f"  -  {text}")


def main():
    pdf = Doc()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("Carlito", "", FONT)
    pdf.add_font("Carlito", "B", FONT_B)
    pdf.add_font("Carlito", "I", FONT_I)

    pdf.set_margins(20, 20, 20)
    pdf.add_page()
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "B", 20)
    pdf.multi_cell(pdf.epw, 10, "PCyMT RM - Comentarios del asistente")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "I", 11)
    pdf.multi_cell(pdf.epw, 6, "Auditoria, opinion visitante, enfoque alternativo y notas de uso de Cursor")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Carlito", "", 10)
    pdf.multi_cell(pdf.epw, 5, "Proyecto: Plataforma de Conservacion y Mitigacion del Trafico de Especies con Realidad Mixta")
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 5, "Autor del proyecto: Pedro Chacolla Rybak - Junio 2026")
    pdf.ln(4)

    # ── RESPUESTA 1 ──
    section(pdf, "Respuesta 1 — Auditoría práctica del proyecto", 1)
    body(pdf,
        "Análisis del monorepo (frontend web → backend → móvil): objetivo, entrelazado de datos, "
        "fortalezas, deuda técnica y prioridades. Documentación actualizada en docs/project-audit.md "
        "y AGENTS.md sección 17.")

    section(pdf, "Qué es el producto", 2)
    body(pdf,
        "Juego educativo en el Parque de las Culturas y la Madre Tierra: visitantes descubren 12 animales "
        "virtuales con AR; staff gestiona contenido desde panel web. Flujo central: VirtualAsset → Location "
        "→ Interaction → Analytics / Colección móvil; MapConfiguration sincronizada web→móvil.")

    section(pdf, "Frontend web — bien / mal / cambiar", 2)
    bullet(pdf, "Bien: Angular 21, panel completo, mapa canvas avanzado, UX Fases 1–3, tokens semánticos.")
    bullet(pdf, "Mal: sin guard de rol; i18n a medias en mapa/animator; código muerto (TableControl, tilemap-editor); Chart.js global.")
    bullet(pdf, "Cambiar: AdminGuard; lazy Chart.js; eliminar dead code; verificar endpoint animation-sequence.")

    section(pdf, "Backend — bien / mal / cambiar", 2)
    bullet(pdf, "Bien: API REST, Vercel+DB, avatares whitelist, rate limits, config pública.")
    bullet(pdf, "Mal: RBAC casi ausente; uploads Multer no persisten en Vercel; tests integración stale (/api/v1/).")
    bullet(pdf, "Cambiar: adminOnly middleware; upload directo Supabase; alinear tests; config mutable en BD.")

    section(pdf, "Mobile — bien / mal / cambiar", 2)
    bullet(pdf, "Bien: 3 modos AR, ParkMapView, networking robusto, avatares perfil, monorepo stickers.")
    bullet(pdf, "Mal: admin duplica web; fragments >1400 LOC; README desactualizado; mapa duplicado vs Angular.")
    bullet(pdf, "Cambiar: decidir admin móvil; un camino AR; JSON shared boundary; actualizar README.")

    section(pdf, "Prioridades roadmap", 2)
    bullet(pdf, "1. Seguridad: AdminGuard + adminOnly backend.")
    bullet(pdf, "2. Uploads prod Supabase end-to-end.")
    bullet(pdf, "3. Decisión admin móvil vs solo web.")
    bullet(pdf, "4. Limpieza código muerto.")
    bullet(pdf, "5. i18n + tests integración.")

    # ── RESPUESTA 2 ──
    pdf.add_page()
    section(pdf, "Respuesta 2 — Opinión visitante (caja negra) y fases de deuda", 1)

    section(pdf, "El juego a grandes rasgos", 2)
    body(pdf,
        "Pokédex del parque: caminar, encontrar 12 figuras, verlas en AR, completar colección. "
        "Loop: login → progreso X/12 → Mapa / Juku Go / Colección → AR → interacción registrada → trofeos.")

    section(pdf, "Prueba como visitante — qué funciona", 2)
    bullet(pdf, "Meta clara: «Has encontrado X de 12».")
    bullet(pdf, "Juku Go es la experiencia más «juego» (exploración + encuentros).")
    bullet(pdf, "Celebración al completar 12 — sensación de logro real.")
    bullet(pdf, "Fallback RA simple en dispositivos sin ARCore.")

    section(pdf, "Prueba como visitante — qué falla o confunde", 2)
    bullet(pdf, "App se llama «Realidad Mixta» pero el botón principal es «Juku Go».")
    bullet(pdf, "Sin onboarding: no sé si usar Mapa, Juku Go o Colección.")
    bullet(pdf, "Fuera del parque la app parece rota (sin mensaje de geofence).")
    bullet(pdf, "Realidad Mixta poco visible para visitantes (card oculta si no eres admin).")
    bullet(pdf, "Sin anclas colocadas, RM parece bug, no contenido pendiente.")
    bullet(pdf, "Banners «Modo Admin» visibles con cuenta staff — confunde en demo.")
    bullet(pdf, "Panel web accesible con cuenta visitante — no debería existir ese camino.")

    section(pdf, "Veredicto producto", 2)
    body(pdf,
        "Base lúdica sólida (meta + exploración + AR). Falta un solo camino claro, tutorial, "
        "y alinear promesa del nombre con lo que vive la mayoría (RA simple / Juku Go).")

    section(pdf, "Deuda dividida en fases", 2)
    body(pdf, "Fase 1 — Puedo jugar sin confundirme: onboarding, naming, geofence, ocultar admin, RM visible, empty states AR.")
    body(pdf, "Fase 2 — Juego enseña: misiones por sección, feedback unificado al encontrar, narrativa educativa.")
    body(pdf, "Fase 3 — Solo staff en consola: AdminGuard, RBAC backend, decidir admin móvil.")
    body(pdf, "Fase 4 — Producción evento: uploads Supabase, anclas en parque, CI tests reales.")
    body(pdf, "Fase 5 — Pulido: i18n mapa, identidad visual, dead code, tests mapa/AR.")
    body(pdf, "Fase 6 — Escalar (post-TFG): JSON shared mapa, partir fragments, flavors visitor/staff.")

    # ── RESPUESTA 3 ──
    pdf.add_page()
    section(pdf, "Respuesta 3 — Cómo haría la app yo (enfoque alternativo)", 1)

    section(pdf, "Respeto por tu enfoque actual", 2)
    body(pdf,
        "Monorepo + Node + Angular admin + Kotlin ARCore + mapa custom + Vercel/Supabase es defendible "
        "para TFG solo con cliente real. No reescribiría todo; podaría producto y endurecer decisiones.")

    section(pdf, "Dos productos claros", 2)
    body(pdf,
        "PCyMT Explorer (visitante, Android): un loop explorar → AR → coleccionar 12. "
        "PCyMT Console (staff, web): CRUD + mapa + analytics. Sin «modo admin» en APK visitante.")

    section(pdf, "Stack que elegiría (2026)", 2)
    bullet(pdf, "Backend: TypeScript + NestJS/Fastify + Prisma + PostgreSQL + Supabase Storage (uploads día 1).")
    bullet(pdf, "Admin: Angular 21 o React; Material; Chart.js lazy; sin SSR/PWA en panel interno.")
    bullet(pdf, "Móvil: Kotlin + Jetpack Compose; Navigation Compose; 4 tabs; Hilt completo; Coil/Retrofit.")
    bullet(pdf, "Shared: park-boundary.geojson + park-sections.json — una verdad, dos renderers (web canvas + ParkMapView).")
    bullet(pdf, "AR: 1 modo principal (explorador GPS) + RM opcional en POIs icónicos; cloud-anchor-cli para staff.")
    bullet(pdf, "DevOps: pnpm/Nx monorepo; GitHub Actions; Sentry; OpenAPI.")

    section(pdf, "Qué NO cambiaría de lo tuyo", 2)
    bullet(pdf, "Kotlin nativo para AR.")
    bullet(pdf, "Mapa custom del parque.")
    bullet(pdf, "PostgreSQL + REST + JWT.")
    bullet(pdf, "Monorepo con shared/uploads.")
    bullet(pdf, "Panel Angular para staff.")
    bullet(pdf, "Analytics e interacciones.")

    section(pdf, "Prioridad sin reescribir", 2)
    bullet(pdf, "Renombrar: «Explorador PCyMT»; RM como feature.")
    bullet(pdf, "Juku Go = corazón del juego.")
    bullet(pdf, "Quitar admin del APK visitante.")
    bullet(pdf, "RBAC + AdminGuard + uploads Supabase.")
    bullet(pdf, "JSON shared del parque + onboarding 3 pantallas.")

    section(pdf, "Veredicto", 2)
    body(pdf,
        "El desvío principal fue de producto (demasiados modos AR y roles en un binario), no técnico. "
        "La demo al jurado: «Explorador del parque — 12 especies, staff en consola web».")

    # ── RESPUESTA 4 ──
    pdf.add_page()
    section(pdf, "Respuesta 4 — Este documento y scroll en Cursor", 1)

    section(pdf, "Sobre este PDF", 2)
    body(pdf,
        f"Archivo generado: docs/PCyMT-Comentarios-Asistente.pdf "
        f"(script: scripts/generate-assistant-comments-pdf.py). "
        "Contiene resumen fiel de las cuatro respuestas del chat sobre auditoría, visitante, "
        "enfoque alternativo e instrucciones de uso de Cursor.")

    section(pdf, "Scroll suave en el chat de Cursor", 2)
    body(pdf,
        "En Cursor, las flechas ↑ ↓ a menudo navegan entre bloques/mensajes del hilo cuando el foco "
        "está en el panel de conversación, no desplazan el scroll como en un documento. "
        "Por eso «saltan comentarios» en lugar de bajar línea a línea.")

    section(pdf, "Formas de desplazarte suavemente", 2)
    bullet(pdf, "Rueda del ratón o gesto de dos dedos en trackpad sobre el área del chat — scroll continuo (lo más natural).")
    bullet(pdf, "Barra de scroll lateral del panel de chat — arrastrar con el ratón.")
    bullet(pdf, "Page Down / Page Up — salto por pantalla dentro del panel.")
    bullet(pdf, "Shift + rueda del ratón — en algunos entornos Linux desplaza horizontal/vertical según configuración.")
    bullet(pdf, "Clic primero dentro del texto de una respuesta larga, luego rueda — asegura que el scroll va al contenedor correcto.")
    bullet(pdf, "Evita tener el foco en la caja de input abajo si quieres scroll; las flechas ahí mueven el cursor del texto que escribes.")

    section(pdf, "Atajos útiles (basados en VS Code / Cursor)", 2)
    bullet(pdf, "Ctrl + Home / Ctrl + End — inicio/fin del documento o panel con foco (según contexto).")
    bullet(pdf, "Ctrl + ↑ / Ctrl + ↓ — a veces mueven línea en editor; en chat pueden no aplicar.")
    bullet(pdf, "Esc — quita foco del input y permite que el siguiente scroll vaya al historial.")

    section(pdf, "Si las flechas siguen saltando mensajes", 2)
    bullet(pdf, "Es comportamiento de diseño del chat (navegación por turnos), no un bug de tu sistema.")
    bullet(pdf, "Para lectura larga: exportar o usar este PDF; o copiar la respuesta a un archivo .md en el proyecto.")
    bullet(pdf, "Ajustes: Cursor Settings → buscar «scroll» / «chat» por opciones de smooth scroll del editor (el chat puede no exponer todas).")
    bullet(pdf, "Alternativa: panel Agent en ventana más ancha o en monitor secundario para más área de scroll con rueda.")

    section(pdf, "Regenerar el PDF", 2)
    body(pdf, "Desde la raíz del repo: python3 scripts/generate-assistant-comments-pdf.py")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"PDF generado: {OUT}")


if __name__ == "__main__":
    main()
