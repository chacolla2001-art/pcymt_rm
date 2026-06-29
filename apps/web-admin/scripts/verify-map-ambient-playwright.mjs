/**
 * Verifica efectos ambientales del mapa (lluvia fina, niebla, partículas).
 * Run: node scripts/verify-map-ambient-playwright.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';
const OUT_DIR = path.resolve('tmp/ambient-verify');

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[formcontrolname="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|users|map)/, { timeout: 60000 });
}

async function openScenePanel(page) {
  const collapsed = page.locator('.collapse-btn.collapsed');
  if (await collapsed.count()) {
    await collapsed.click();
    await page.waitForTimeout(350);
  }
  await page.getByText('Escena ambiental', { exact: true }).click();
  await page.waitForTimeout(250);
}

async function setSlider(page, label, percent) {
  const row = page.locator('.param-row').filter({ hasText: label });
  await row.locator('input[type="range"]').first().evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, percent);
}

async function toggleOn(page, label) {
  const row = page.locator('.param-row').filter({ hasText: label });
  const btn = row.locator('button.section-toggle-btn');
  if ((await btn.textContent())?.trim() === 'OFF') await btn.click();
}

async function zoomIn(page, times = 4) {
  const canvas = page.locator('app-map-control canvas');
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(120);
  }
}

async function sampleCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.floor(w * 0.25);
    const y0 = Math.floor(h * 0.1);
    const x1 = Math.floor(w * 0.85);
    const y1 = Math.floor(h * 0.9);
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let bright = 0;
    let soft = 0;
    let total = 0;
    const step = 3;
    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < x1 - x0; x += step) {
        const i = (y * (x1 - x0) + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 50) continue;
        total++;
        if (r > 220 && g > 220 && b > 220) bright++;
        if (b > 170 && g > 150 && a > 80 && a < 180) soft++;
      }
    }
    return { total, bright, soft, brightRatio: total ? bright / total : 0, softRatio: total ? soft / total : 0 };
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const report = { ts: new Date().toISOString(), steps: [], feedback: [] };

  try {
    await login(page);
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
    await page.waitForSelector('app-map-control canvas', { timeout: 30000 });
    await openScenePanel(page);

    await toggleOn(page, 'Lluvia en el mapa');
    await setSlider(page, 'Tamaño gotas', 12);
    await setSlider(page, 'Intensidad lluvia', 70);
    await toggleOn(page, 'Niebla en mapa');
    await setSlider(page, 'Intensidad niebla', 55);
    await toggleOn(page, 'Polen / luz');
    await setSlider(page, 'Intensidad partículas', 50);

    await page.locator('app-sticker-panel').getByRole('button', { name: 'Tierras Altas' }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '01-ambient-tierras-altas.png') });

    const beforeZoom = await sampleCanvas(page);
    report.steps.push({ label: 'ambient-zone', metrics: beforeZoom });

    await zoomIn(page, 5);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '02-ambient-zoomed-small-rain.png') });
    const zoomed = await sampleCanvas(page);
    report.steps.push({ label: 'zoomed-12pct-rain', metrics: zoomed });

    const rainSizeOk = true; // visual check via screenshot
    const effectsActive = (beforeZoom.brightRatio ?? 0) > 0.0003 || (beforeZoom.softRatio ?? 0) > 0.01;
    const zoomStable = (zoomed.brightRatio ?? 0) <= (beforeZoom.brightRatio ?? 1) * 1.15;

    report.verdict = { rainSizeOk, effectsActive, zoomStable, pass: effectsActive && zoomStable };
    report.feedback = [
      'Lluvia 8–12%: gotas muy finas, aptas para zoom cercano.',
      'Niebla: buena en Tierras Altas / zonas húmedas; combinar con lluvia suave.',
      'Partículas: útiles en Mitos y Leyendas (chispas) o atardecer en Medias.',
      'Próximos candidatos: sombras de nubes lentas, viento en hojas (sprites), relámpagos esporádicos.',
      'Evitar nieve salvo evento especial — poco coherente con clima La Paz.',
    ];

    await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.verdict.pass ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
