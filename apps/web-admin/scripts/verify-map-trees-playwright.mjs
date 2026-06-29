/**
 * Verifica árboles animados del mapa (visibilidad, verde, balanceo).
 * Run: node scripts/verify-map-trees-playwright.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';
const OUT_DIR = path.resolve('tmp/trees-verify');

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

async function toggleOff(page, label) {
  const row = page.locator('.param-row').filter({ hasText: label });
  const btn = row.locator('button.section-toggle-btn');
  if ((await btn.textContent())?.trim() === 'ON') await btn.click();
}

async function zoomIn(page, times = 5) {
  const canvas = page.locator('app-map-control canvas');
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(140);
  }
}

async function sampleGreenMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.floor(w * 0.2);
    const y0 = Math.floor(h * 0.15);
    const x1 = Math.floor(w * 0.8);
    const y1 = Math.floor(h * 0.85);
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let total = 0;
    let canopy = 0;
    let trunk = 0;
    let darkGreen = 0;
    const step = 2;
    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < x1 - x0; x += step) {
        const i = (y * (x1 - x0) + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 40) continue;
        total++;
        // canopy greens (tree foliage)
        if (g > 90 && g > r + 12 && g > b + 8 && r < 120) canopy++;
        // trunk browns
        if (r > 55 && r < 130 && g > 40 && g < 100 && b < 80 && r > g) trunk++;
        if (g > 60 && g < 110 && r < 70 && b < 70) darkGreen++;
      }
    }
    return {
      total,
      canopy,
      trunk,
      darkGreen,
      canopyRatio: total ? canopy / total : 0,
      trunkRatio: total ? trunk / total : 0,
    };
  });
}

async function captureFrameHash(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const strip = ctx.getImageData(Math.floor(w * 0.35), Math.floor(h * 0.3), 200, 200).data;
    let sum = 0;
    for (let i = 0; i < strip.length; i += 16) sum += strip[i] + strip[i + 1] + strip[i + 2];
    return sum;
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const report = { ts: new Date().toISOString(), steps: [], issues: [] };

  try {
    await login(page);
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
    await page.waitForSelector('app-map-control canvas', { timeout: 30000 });
    await openScenePanel(page);

    // OFF baseline
    await toggleOff(page, 'Árboles');
    await page.waitForTimeout(1500);
    const offMetrics = await sampleGreenMetrics(page);
    await page.screenshot({ path: path.join(OUT_DIR, '00-trees-off.png') });
    report.steps.push({ label: 'trees-off', metrics: offMetrics });

    // ON max
    await toggleOn(page, 'Árboles');
    await setSlider(page, 'Densidad', 100);
    await setSlider(page, 'Tamaño', 160);
    await page.waitForTimeout(2000);
    const onMetrics = await sampleGreenMetrics(page);
    await page.screenshot({ path: path.join(OUT_DIR, '01-trees-on-wide.png') });
    report.steps.push({ label: 'trees-on-wide', metrics: onMetrics });

    const canopyDelta = (onMetrics.canopyRatio ?? 0) - (offMetrics.canopyRatio ?? 0);
    const trunkDelta = (onMetrics.trunkRatio ?? 0) - (offMetrics.trunkRatio ?? 0);
    if (canopyDelta < 0.002 && trunkDelta < 0.0005) {
      report.issues.push('Árboles casi invisibles en vista amplia (poco verde/marrón vs OFF).');
    }

    // Jungle scenario — already framed on Tierras Bajas
    await page.locator('.scenario-btn').filter({ hasText: 'Selva húmeda' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT_DIR, '02-jungle-scenario.png') });
    const jungleMetrics = await sampleGreenMetrics(page);
    report.steps.push({ label: 'jungle-scenario', metrics: jungleMetrics });

    if ((jungleMetrics.trunkRatio ?? 0) < 0.0003 && (jungleMetrics.canopyRatio ?? 0) < 0.012) {
      report.issues.push('Selva húmeda: pocos árboles visibles en Tierras Bajas.');
    }

    // Zoom centered (scenario already fit section)
    await zoomIn(page, 4);
    await page.waitForTimeout(2000);
    const hashA = await captureFrameHash(page);
    await page.screenshot({ path: path.join(OUT_DIR, '03-trees-zoomed-a.png') });
    await page.waitForTimeout(600);
    const hashB = await captureFrameHash(page);
    await page.screenshot({ path: path.join(OUT_DIR, '04-trees-zoomed-b.png') });
    const zoomedMetrics = await sampleGreenMetrics(page);
    report.steps.push({
      label: 'zoomed-sway',
      metrics: zoomedMetrics,
      frameDelta: Math.abs((hashB ?? 0) - (hashA ?? 0)),
    });

    if (Math.abs((hashB ?? 0) - (hashA ?? 0)) < 80) {
      report.issues.push('Poco cambio entre frames — balanceo débil o árboles fuera de vista.');
    }
    if ((zoomedMetrics.canopyRatio ?? 0) < 0.004) {
      report.issues.push('Zoom: poca copa en el encuadre actual.');
    }

    report.verdict = {
      visibleAtWide: canopyDelta >= 0.002 || trunkDelta >= 0.0005,
      animating: Math.abs((hashB ?? 0) - (hashA ?? 0)) >= 80,
      pass: report.issues.length === 0,
    };

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
