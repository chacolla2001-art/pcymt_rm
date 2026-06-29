/**
 * Auditoría visual/funcional del mapa web (panel, escenarios, efectos, viento, árboles).
 * Run: node scripts/verify-map-full-playwright.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';
const OUT_DIR = path.resolve('tmp/map-audit');

const SCENARIOS = [
  'Día despejado',
  'Tormenta Bajas',
  'Neblina Altas',
  'Atardecer Medias',
  'Noche Mítica',
  'Lluvia fina (zoom)',
  'Selva húmeda',
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[formcontrolname="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|users|map)/, { timeout: 60000 });
}

async function openPanel(page) {
  const collapsed = page.locator('.collapse-btn.collapsed');
  if (await collapsed.count()) {
    await collapsed.click();
    await page.waitForTimeout(300);
  }
}

async function ensureSectionOpen(page, title) {
  const header = page.locator('.section-header').filter({ hasText: title }).first();
  const chevron = header.locator('.section-chevron');
  const isOpen = await chevron.evaluate((el) => el.classList.contains('open')).catch(() => false);
  if (!isOpen) await header.click();
  await page.waitForTimeout(250);
}

async function setSlider(page, label, percent) {
  const row = page.locator('.param-row').filter({ hasText: label });
  if (!(await row.count())) return false;
  await row.locator('input[type="range"]').first().evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, percent);
  return true;
}

async function toggleOn(page, label) {
  const row = page.locator('.param-row').filter({ hasText: label });
  if (!(await row.count())) return false;
  const btn = row.locator('button.section-toggle-btn');
  if ((await btn.textContent())?.trim() === 'OFF') await btn.click();
  return true;
}

async function zoomIn(page, times = 4) {
  const canvas = page.locator('app-map-control canvas');
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, -130);
    await page.waitForTimeout(100);
  }
}

async function sampleCanvas(page, region = 'center') {
  return page.evaluate((reg) => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const regions = {
      center: [0.25, 0.15, 0.75, 0.85],
      full: [0.05, 0.05, 0.95, 0.95],
    };
    const [x0f, y0f, x1f, y1f] = regions[reg] ?? regions.center;
    const x0 = Math.floor(w * x0f);
    const y0 = Math.floor(h * y0f);
    const x1 = Math.floor(w * x1f);
    const y1 = Math.floor(h * y1f);
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let total = 0;
    let bright = 0;
    let foggy = 0;
    let green = 0;
    let brown = 0;
    let dark = 0;
    const step = 3;
    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < x1 - x0; x += step) {
        const i = (y * (x1 - x0) + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 40) continue;
        total++;
        if (r > 220 && g > 220 && b > 220) bright++;
        if (b > 170 && g > 150 && a > 60 && a < 200) foggy++;
        if (g > 80 && g > r + 10 && g > b + 5) green++;
        if (r > 70 && r > g && b < 90) brown++;
        if (r < 40 && g < 40 && b < 50) dark++;
      }
    }
    const ratio = (n) => (total ? n / total : 0);
    return {
      total,
      brightRatio: ratio(bright),
      foggyRatio: ratio(foggy),
      greenRatio: ratio(green),
      brownRatio: ratio(brown),
      darkRatio: ratio(dark),
      avgLuma: total ? 'sampled' : 0,
    };
  }, region);
}

async function frameHash(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const strip = ctx.getImageData(Math.floor(w * 0.3), Math.floor(h * 0.25), 220, 220).data;
    let sum = 0;
    for (let i = 0; i < strip.length; i += 12) sum += strip[i] + strip[i + 1] + strip[i + 2];
    return sum;
  });
}

async function waitAnim(page, ms = 1800) {
  await page.waitForTimeout(ms);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const report = {
    ts: new Date().toISOString(),
    checks: [],
    scenarios: [],
    issues: [],
    missing: [],
    improvements: [],
    pass: true,
  };

  const addCheck = (id, ok, detail) => {
    report.checks.push({ id, ok, detail });
    if (!ok) report.pass = false;
  };

  try {
    await login(page);
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
    const canvasOk = await page.waitForSelector('app-map-control canvas', { timeout: 30000 }).then(() => true).catch(() => false);
    addCheck('canvas-mounted', canvasOk, canvasOk ? 'Canvas presente' : 'Sin canvas');

    await openPanel(page);
    await page.screenshot({ path: path.join(OUT_DIR, '00-map-baseline.png'), fullPage: false });

    const baseline = await sampleCanvas(page);
    addCheck('baseline-has-content', (baseline.total ?? 0) > 1000, `pixeles=${baseline.total}`);

    // Panel sections
    const sectionTitles = ['Capas', 'Editor de secciones', 'Escena ambiental', 'Referencias espaciales', 'Herramientas', 'Stickers'];
    for (const t of sectionTitles) {
      await ensureSectionOpen(page, t);
      const visible = await page.locator('.section-header').filter({ hasText: t }).count() > 0;
      addCheck(`panel-${t}`, visible, visible ? 'Sección accesible' : 'No encontrada');
    }

    // Capas: secciones ON
    await ensureSectionOpen(page, 'Capas');
    const sectionsRow = page.locator('.layer-label', { hasText: 'Secciones' });
    addCheck('layers-sections-row', await sectionsRow.count() > 0, 'Fila secciones en capas');

    // Escena ambiental — escenarios
    await ensureSectionOpen(page, 'Escena ambiental');
    for (const name of SCENARIOS) {
      await ensureSectionOpen(page, 'Escena ambiental');
      const btn = page.locator('.scenario-btn').filter({ hasText: name }).first();
      const exists = await btn.count() > 0;
      if (!exists) {
        report.issues.push(`Escenario no encontrado: ${name}`);
        continue;
      }
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await waitAnim(page, 2200);
      const safeName = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await page.screenshot({ path: path.join(OUT_DIR, `scenario-${safeName}.png`) });
      const metrics = await sampleCanvas(page);
      const hA = await frameHash(page);
      await page.waitForTimeout(500);
      const hB = await frameHash(page);
      const animating = Math.abs(hB - hA) > 60;
      const entry = { name, metrics, animating, frameDelta: Math.abs(hB - hA) };
      report.scenarios.push(entry);

      if (name === 'Día despejado' && (metrics.foggyRatio ?? 0) > 0.08) {
        report.issues.push('Día despejado: demasiada niebla/overlay residual');
      }
      if (name === 'Tormenta Bajas' && (metrics.darkRatio ?? 0) < 0.02 && (metrics.foggyRatio ?? 0) < 0.02) {
        report.issues.push('Tormenta Bajas: poco contraste oscuro/lluvia visible');
      }
      if (name === 'Selva húmeda' && (metrics.greenRatio ?? 0) < 0.05) {
        report.issues.push('Selva húmeda: pocos árboles/verde en encuadre');
      }
      if (['Tormenta Bajas', 'Selva húmeda', 'Neblina Altas'].includes(name) && !animating) {
        report.issues.push(`${name}: poca animación entre frames`);
      }
    }

    // Viento — cambiar dirección y comparar
    await ensureSectionOpen(page, 'Escena ambiental');
    await page.getByText('Viento / orientación', { exact: true }).scrollIntoViewIfNeeded();
    await toggleOn(page, 'Lluvia en el mapa');
    await setSlider(page, 'Intensidad lluvia', 75);
    await page.getByRole('button', { name: 'E', exact: true }).click();
    await waitAnim(page, 1500);
    const hashEast = await frameHash(page);
    await page.getByRole('button', { name: 'O', exact: true }).click();
    await waitAnim(page, 1500);
    const hashWest = await frameHash(page);
    await page.screenshot({ path: path.join(OUT_DIR, 'wind-west.png') });
    addCheck('wind-changes-rain', Math.abs(hashEast - hashWest) > 80, `delta=${Math.abs(hashEast - hashWest)}`);

    // Árboles por zona
    await page.locator('.scenario-btn').filter({ hasText: 'Día despejado' }).click();
    await toggleOn(page, 'Árboles');
    await setSlider(page, 'Densidad', 100);
    await setSlider(page, 'Tamaño', 140);
    const zones = ['Todo el parque', 'Tierras Altas', 'Tierras Medias', 'Tierras Bajas'];
    for (const z of zones) {
      await page.locator('.section-pick-btn').filter({ hasText: z }).click();
      await waitAnim(page, 1800);
      const m = await sampleCanvas(page);
      const zSafe = z.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await page.screenshot({ path: path.join(OUT_DIR, `trees-${zSafe}.png`) });
      report.checks.push({
        id: `trees-zone-${zSafe}`,
        ok: (m.greenRatio ?? 0) > 0.01 || z === 'Todo el parque',
        detail: `greenRatio=${((m.greenRatio ?? 0) * 100).toFixed(1)}%`,
      });
      if (z !== 'Todo el parque' && (m.greenRatio ?? 0) < 0.015) {
        report.issues.push(`Árboles en ${z}: poca copa visible (revisar encuadre o slots)`);
      }
    }

    // Referencias espaciales
    await ensureSectionOpen(page, 'Referencias espaciales');
    const refsToggle = page.locator('.param-row').filter({ hasText: 'Mostrar en mapa' }).locator('button.section-toggle-btn');
    if (await refsToggle.count()) {
      if ((await refsToggle.textContent())?.trim() === 'OFF') await refsToggle.click();
      await waitAnim(page, 1500);
      await page.screenshot({ path: path.join(OUT_DIR, 'spatial-refs.png') });
      addCheck('spatial-refs-on', true, 'Toggle referencias espaciales');
    } else {
      addCheck('spatial-refs-on', false, 'No se encontró toggle');
    }

    // Zoom + animación combinada
    await ensureSectionOpen(page, 'Escena ambiental');
    await page.locator('.scenario-btn').filter({ hasText: 'Selva húmeda' }).first().click();
    await waitAnim(page, 2000);
    await zoomIn(page, 5);
    await waitAnim(page, 1500);
    await page.screenshot({ path: path.join(OUT_DIR, 'jungle-zoomed.png') });
    const zoomM = await sampleCanvas(page);
    addCheck('jungle-zoom-green', (zoomM.greenRatio ?? 0) > 0.08, `green=${((zoomM.greenRatio ?? 0) * 100).toFixed(1)}%`);

    // UI / faltantes conocidos
    report.missing = [
      'i18n: textos del panel Escena ambiental solo en español hardcodeado',
      'Sección "Mitos y Leyendas" no existe en park-sections.json (solo 3 zonas)',
      'Efectos ambientales no portados a app móvil (solo web)',
      'Sin persistencia de viento/escena en map config guardada (solo sesión)',
      'Sin modo colocar árbol de catálogo con clic (solo stickers tree-*)',
      'Relámpago: difícil de validar en screenshot (esporádico)',
      'Bruma nocturna solo visible con tema oscuro del mapa',
      'Niebla: efecto sutil en métricas de píxeles (revisar contraste visual)',
    ];

    report.improvements = [
      'Panel Escena ambiental muy largo: sub-pestañas o grupos colapsables',
      'CSS sticker-panel supera budget (~19 kB): extraer a .scss',
      'Indicador visual de viento en el canvas (flecha discreta)',
      'Persistir ambientWind + escenario en map_configuration JSON',
      'Integrar verify-map-full-playwright.mjs en CI frontend (opcional)',
      'Slider de viento con grados (0–360) además de 8 botones',
      'Añadir 4ª sección Mitos al JSON o documentar que es temática transversal',
    ];

    if (report.issues.length === 0) report.pass = report.checks.every((c) => c.ok);

    await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.pass && report.issues.length === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
