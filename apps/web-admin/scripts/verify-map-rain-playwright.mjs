/**
 * Verifica visualmente la lluvia del mapa con Playwright.
 * Run: node scripts/verify-map-rain-playwright.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';
const OUT_DIR = path.resolve('tmp/rain-verify');

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[formcontrolname="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|users|map)/, { timeout: 60000 });
}

async function openMapPanelSection(page, title) {
  const collapsed = page.locator('.collapse-btn.collapsed');
  if (await collapsed.count()) {
    await collapsed.click();
    await page.waitForTimeout(400);
  }
  await page.getByText(title, { exact: true }).click();
  await page.waitForTimeout(300);
}

async function enableRain(page, intensityPercent = 75) {
  await openMapPanelSection(page, 'Escena ambiental');
  const rainRow = page.locator('.param-row').filter({ hasText: 'Lluvia en el mapa' });
  const toggle = rainRow.locator('button.section-toggle-btn');
  const label = (await toggle.textContent())?.trim();
  if (label === 'OFF') await toggle.click();

  const slider = page.locator('.section-content').filter({ hasText: 'Intensidad lluvia' }).locator('input[type="range"]');
  await slider.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, intensityPercent);
  await page.waitForTimeout(100);
}

async function sampleCanvasRain(page, region = 'center') {
  return page.evaluate((regionKey) => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return { error: 'no canvas' };

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const cssW = rect.width;
    const cssH = rect.height;

    let x0 = 0;
    let y0 = 0;
    let x1 = w;
    let y1 = h;
    if (regionKey === 'center') {
      x0 = Math.floor(w * 0.28);
      y0 = Math.floor(h * 0.12);
      x1 = Math.floor(w * 0.88);
      y1 = Math.floor(h * 0.92);
    }

    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let streakLike = 0;
    let rippleLike = 0;
    let highContrastPairs = 0;
    let total = 0;
    const step = 3;

    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < x1 - x0; x += step) {
        const i = (y * (x1 - x0) + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 60) continue;
        total += 1;
        if (b > 200 && g > 185 && r > 70 && r < 250) streakLike += 1;
        if (b > 160 && g > 150 && a > 100 && Math.abs(r - g) < 40) rippleLike += 1;

        const j = i + step * 4;
        if (j + 3 < data.length) {
          const dr = Math.abs(data[j] - r);
          const dg = Math.abs(data[j + 1] - g);
          const db = Math.abs(data[j + 2] - b);
          if (dr + dg + db > 90 && b > 170) highContrastPairs += 1;
        }
      }
    }

    return {
      canvasCss: { w: cssW, h: cssH, dpr },
      region: regionKey,
      total,
      streakLike,
      rippleLike,
      highContrastPairs,
      streakRatio: total ? streakLike / total : 0,
      rippleRatio: total ? rippleLike / total : 0,
      motionHint: total ? highContrastPairs / total : 0,
    };
  }, region);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const report = { ts: new Date().toISOString(), steps: [] };

  try {
    await login(page);
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
    await page.waitForSelector('app-map-control canvas', { timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(OUT_DIR, '01-map-no-rain.png'), fullPage: false });
    const before = await sampleCanvasRain(page);
    report.steps.push({ label: 'before-rain', metrics: before });

    await enableRain(page, 80);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT_DIR, '02-map-rain-t2.5s.png') });
    const mapBox = await page.locator('app-map-control canvas').boundingBox();
    if (mapBox) {
      const crop = {
        x: mapBox.x + mapBox.width * 0.22,
        y: mapBox.y + mapBox.height * 0.08,
        width: mapBox.width * 0.58,
        height: mapBox.height * 0.72,
      };
      await page.screenshot({ path: path.join(OUT_DIR, '02b-map-rain-closeup.png'), clip: crop });
    }
    const mid = await sampleCanvasRain(page);
    report.steps.push({ label: 'rain-2.5s', metrics: mid });

    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT_DIR, '03-map-rain-t5s.png') });
    const later = await sampleCanvasRain(page);
    report.steps.push({ label: 'rain-5s', metrics: later });

    // Rotar mapa: la lluvia debe seguir orientación del mapa
    await page.keyboard.down('Control');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Control');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '04-map-rain-rotated.png') });
    const rotated = await sampleCanvasRain(page);
    report.steps.push({ label: 'rain-rotated', metrics: rotated });

    const rainVisible = (mid.streakRatio ?? 0) > 0.0015 || (mid.motionHint ?? 0) > 0.008;
    const rainIncreased =
      (mid.streakRatio ?? 0) > (before.streakRatio ?? 0) * 1.15 ||
      (mid.motionHint ?? 0) > (before.motionHint ?? 0) * 1.2;
    const ripplesLikely = (mid.rippleRatio ?? 0) > 0.0008 || (later.rippleRatio ?? 0) > 0.0008;
    const stillVisibleWhenRotated =
      (rotated.streakRatio ?? 0) > 0.001 || (rotated.motionHint ?? 0) > 0.006;

    report.verdict = {
      rainVisible,
      rainIncreased,
      ripplesLikely,
      stillVisibleWhenRotated,
      naturalnessHints: [],
    };

    if (!rainVisible) report.verdict.naturalnessHints.push('Muy pocos píxeles de lluvia — densidad baja');
    if ((mid.streakRatio ?? 0) > 0.06) report.verdict.naturalnessHints.push('Demasiada lluvia en pantalla — puede verse artificial');
    if (!ripplesLikely) report.verdict.naturalnessHints.push('Ondas de impacto poco visibles');
    if (!stillVisibleWhenRotated) report.verdict.naturalnessHints.push('Lluvia desaparece al rotar — bug de espacio mapa');

    const pass = rainVisible && rainIncreased && stillVisibleWhenRotated;
    report.pass = pass;

    await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nScreenshots: ${OUT_DIR}`);
    process.exitCode = pass ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
