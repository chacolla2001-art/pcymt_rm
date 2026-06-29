/**
 * Manual verification: unified shell-load-overlay across main routes.
 * Run: node scripts/manual-shell-overlay-theme.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.WEB_ADMIN_URL || 'http://localhost:4200';
const EMAIL = 'chacolla43@gmail.com';
const PASSWORD = 'Cybercenter1';

const ROUTES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/users', label: 'Usuarios' },
  { path: '/virtual-assets', label: 'Contenido 3D' },
  { path: '/anchor-points', label: 'Puntos de anclaje' },
  { path: '/stats/session-history', label: 'Historial sesiones' },
  { path: '/settings', label: 'Configuración' },
];

function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[formcontrolname="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|users|map)/, { timeout: 60000 });
}

async function measureRouteOverlay(page, route, theme) {
  await page.evaluate((mode) => {
    localStorage.setItem('theme-mode', mode);
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${mode}-theme`);
  }, theme);

  await page.goto(`${BASE}${route.path}`, { waitUntil: 'commit' });

  const overlay = page.locator('.shell-overlay');
  let sawOverlay = false;
  try {
    await overlay.waitFor({ state: 'visible', timeout: 12000 });
    sawOverlay = true;
  } catch {
    sawOverlay = false;
  }

  if (!sawOverlay) {
    return { route: route.label, sawOverlay: false, error: 'overlay never appeared' };
  }

  const metrics = await overlay.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const scrim = document.querySelector('.spinner-container, .loading-overlay');
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      position: style.position,
      width: Math.round(rect.width),
      hasLegacyBlackOverlay: !!scrim,
      legacyBg: scrim ? getComputedStyle(scrim).backgroundColor : null,
    };
  });

  await overlay.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});

  return {
    route: route.label,
    sawOverlay: true,
    ...metrics,
    luminance: luminance(metrics.backgroundColor),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await login(page);

    const results = [];
    for (const route of ROUTES) {
      results.push(await measureRouteOverlay(page, route, 'light'));
      results.push(await measureRouteOverlay(page, route, 'dark'));
    }

    console.log('\n=== Unified shell loader manual test ===\n');
    let failed = 0;

    for (const r of results) {
      const theme = results.indexOf(r) % 2 === 0 ? 'light' : 'dark';
      const ok = r.sawOverlay
        && r.position === 'absolute'
        && !r.hasLegacyBlackOverlay
        && (theme === 'light' ? r.luminance > 0.5 : r.luminance < 0.3);

      const mark = ok ? 'PASS' : 'FAIL';
      console.log(`${mark}  ${r.route} (${theme})`, r.sawOverlay ? r : r.error ?? r);
      if (!ok) failed += 1;
    }

    if (failed > 0) {
      process.exitCode = 1;
      console.log(`\n${failed} check(s) failed.`);
    } else {
      console.log('\nAll route/theme checks passed.');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
