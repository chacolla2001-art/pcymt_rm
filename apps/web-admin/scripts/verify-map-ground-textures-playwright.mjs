/**
 * Verifica texturas de suelo: capas en espacio mapa, diversidad visual, pan/zoom.
 * Run: node scripts/verify-map-ground-textures-playwright.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';
const OUT_DIR = path.resolve('tmp/map-ground-audit');

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

async function ensureGroundTexturesOn(page) {
  await openPanel(page);
  const header = page.locator('.section-header').filter({ hasText: 'Capas' }).first();
  const chevron = header.locator('.section-chevron');
  const isOpen = await chevron.evaluate((el) => el.classList.contains('open')).catch(() => false);
  if (!isOpen) await header.click();
  await page.waitForTimeout(200);
  const row = page.locator('.layer-label', { hasText: 'Texturas suelo' });
  if (!(await row.count())) return false;
  const btn = row.locator('..').locator('button.vis-btn');
  const hidden = await btn.evaluate((el) => el.classList.contains('hidden-layer')).catch(() => false);
  if (hidden) await btn.click();
  await page.waitForTimeout(400);
  return true;
}

async function samplePixel(page, sx, sy) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(x * dpr);
    const py = Math.floor(y * dpr);
    const d = ctx.getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }, { x: sx, y: sy });
}

async function sampleRegionStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('app-map-control canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.floor(w * 0.2);
    const y0 = Math.floor(h * 0.2);
    const x1 = Math.floor(w * 0.8);
    const y1 = Math.floor(h * 0.8);
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let total = 0;
    let green = 0;
    let brown = 0;
    let unique = new Set();
    const step = 4;
    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < x1 - x0; x += step) {
        const i = (y * (x1 - x0) + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 40) continue;
        total++;
        unique.add(`${r >> 3},${g >> 3},${b >> 3}`);
        if (g > 70 && g > r + 8 && g > b + 5) green++;
        if (r > 60 && r > g && b < 100) brown++;
      }
    }
    return {
      total,
      greenRatio: total ? green / total : 0,
      brownRatio: total ? brown / total : 0,
      colorBuckets: unique.size,
    };
  });
}

async function panMap(page, dx, dy) {
  const canvas = page.locator('app-map-control canvas');
  const box = await canvas.boundingBox();
  if (!box) return false;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  return true;
}

function colorDelta(a, b) {
  if (!a || !b) return 999;
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const report = { ts: new Date().toISOString(), checks: [], pass: true };

  const addCheck = (id, ok, detail) => {
    report.checks.push({ id, ok, detail });
    if (!ok) report.pass = false;
  };

  try {
    await login(page);
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
    await page.waitForSelector('app-map-control canvas', { timeout: 30000 });

    const texturesOn = await ensureGroundTexturesOn(page);
    addCheck('ground-textures-toggle', texturesOn, texturesOn ? 'Texturas suelo ON' : 'No se encontró toggle');

    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '01-ground-baseline.png') });

    const stats = await sampleRegionStats(page);
    addCheck('canvas-has-pixels', (stats.total ?? 0) > 500, `pixeles=${stats.total}`);
    addCheck('texture-diversity', (stats.colorBuckets ?? 0) > 40,
      `buckets=${stats.colorBuckets} (esperado >40 con texturas)`);
    addCheck('zone-green-signal', (stats.greenRatio ?? 0) > 0.05,
      `green=${((stats.greenRatio ?? 0) * 100).toFixed(1)}%`);
    addCheck('zone-earth-signal', (stats.brownRatio ?? 0) > 0.003 || (stats.colorBuckets ?? 0) > 200,
      `brown=${((stats.brownRatio ?? 0) * 100).toFixed(1)}% buckets=${stats.colorBuckets}`);

    // Backdrop must move with map (not screen-fixed)
    const pBefore = await samplePixel(page, 320, 280);
    await panMap(page, 180, 0);
    const pAfterPan = await samplePixel(page, 320, 280);
    const panDelta = colorDelta(pBefore, pAfterPan);
    addCheck('backdrop-moves-with-pan', panDelta > 25,
      `delta RGB=${panDelta} (esperado >25 si capa va con el mapa)`);
    await page.screenshot({ path: path.join(OUT_DIR, '02-after-pan.png') });

    // Viewport margin stays solid theme color when park is off-center
    const corner = await samplePixel(page, 8, 8);
    const isDarkCorner = corner && corner.r < 50 && corner.g < 50 && corner.b < 60;
    const isLightCorner = corner && corner.r > 160 && corner.g > 160 && corner.b > 150;
    addCheck('viewport-solid-margin', isDarkCorner || isLightCorner,
      `corner rgb=(${corner?.r},${corner?.g},${corner?.b})`);

    // Zoom should keep texture signal (not flat fill)
    const canvasEl = page.locator('app-map-control canvas');
    const box = await canvasEl.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(400);
      const statsZoom = await sampleRegionStats(page);
      addCheck('zoom-texture-diversity', (statsZoom.colorBuckets ?? 0) > 12,
        `buckets zoom=${statsZoom.colorBuckets}`);

      for (let i = 0; i < 18; i++) {
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(45);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '03-after-zoom.png') });
      await page.waitForTimeout(500);
    }
    const maxScale = await page.evaluate(() => {
      let scale = 0;
      try {
        const raw = localStorage.getItem('pcymt_map_state_v3');
        if (raw) scale = JSON.parse(raw).scale ?? 0;
      } catch { /* ignore */ }
      const canvas = document.querySelector('app-map-control canvas');
      if (!canvas) return { scale, buckets: 0 };
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const data = ctx.getImageData(Math.floor(w * 0.35), Math.floor(h * 0.35), 120, 120).data;
      const uniq = new Set();
      for (let i = 0; i < data.length; i += 16) {
        uniq.add(`${data[i] >> 2},${data[i + 1] >> 2},${data[i + 2] >> 2}`);
      }
      return { scale, buckets: uniq.size };
    });
    addCheck('deep-zoom-reached', (maxScale.scale ?? 0) >= 50,
      `scale máximo alcanzado=${Number(maxScale.scale).toFixed(2)} (límite ${120})`);
    await page.screenshot({ path: path.join(OUT_DIR, '04-max-zoom.png') });

    await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.pass ? 0 : 1);
  } catch (err) {
    report.checks.push({ id: 'fatal', ok: false, detail: String(err) });
    report.pass = false;
    await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
