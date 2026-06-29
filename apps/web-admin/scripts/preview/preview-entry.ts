/**
 * Previsualizador de "bases de los gráficos" del mapa.
 * Importa las funciones REALES de dibujo y las renderiza en un canvas grande
 * para inspección visual. No forma parte del bundle de la app.
 */
import { buildGroundPatternTile, GroundPatternCache, fillPolygonWithGroundTexture } from '../../src/app/features/map/utils/draw-ground-texture';
import { drawSimpleTree } from '../../src/app/features/map/utils/draw-simple-tree';
import { MapRainEffect } from '../../src/app/features/map/utils/map-rain-effect';
import { MapMotesEffect } from '../../src/app/features/map/utils/map-motes-effect';
import { MapLeavesEffect } from '../../src/app/features/map/utils/map-leaves-effect';
import { MapFogEffect } from '../../src/app/features/map/utils/map-fog-effect';
import { MapCloudShadowEffect } from '../../src/app/features/map/utils/map-cloud-shadow-effect';
import { MapLightningEffect } from '../../src/app/features/map/utils/map-lightning-effect';

const SECTION_LABELS = ['Tierras Altas', 'Tierras Medias', 'Tierras Bajas'];

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dark = false): void {
  ctx.font = '13px Inter, Segoe UI, sans-serif';
  ctx.fillStyle = dark ? '#ddd' : '#222';
  ctx.fillText(text, x, y);
}

function header(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = 'bold 16px Inter, Segoe UI, sans-serif';
  ctx.fillStyle = '#0a4';
  ctx.fillText(text, x, y);
}

function fillWithTile(
  ctx: CanvasRenderingContext2D,
  section: number,
  isDark: boolean,
  x: number,
  y: number,
  size: number,
  tilePx: number,
): void {
  const tile = buildGroundPatternTile(section, isDark, tilePx);
  const pat = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // escalar el patrón para apreciar el grano
  const scale = 3;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = pat as CanvasPattern;
  ctx.fillRect(0, 0, size / scale, size / scale);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(x, y, size, size);
}

function snapshotEffect(
  ctx: CanvasRenderingContext2D,
  effect: { tick: (o: any, dt?: number) => void; draw: (...a: any[]) => void; setIntensity?: (v: number) => void },
  x: number,
  y: number,
  size: number,
  bg: string,
  ticks = 140,
  lightning = false,
): void {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  const bounds = { minX: 0, maxX: size, minY: 0, maxY: size };
  for (let i = 0; i < ticks; i++) {
    if (lightning) (effect as MapLightningEffect).tick(true, 1);
    else effect.tick({ bounds }, 1);
  }
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.translate(x, y);
  const toScreen = (bx: number, by: number) => ({ x: bx, y: by });
  if (lightning) (effect as MapLightningEffect).draw(ctx, null, size, size);
  else effect.draw(ctx, null, toScreen, 1, true, size, size);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(x, y, size, size);
}

export function render(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cell = 150;
  const gap = 24;
  let y = 40;

  // ── Texturas del suelo (claro) ──
  header(ctx, 'Texturas del suelo — tema claro', 30, y);
  y += 16;
  const tiles: Array<[number, string]> = [
    [0, 'Tierras Altas'],
    [1, 'Tierras Medias'],
    [2, 'Tierras Bajas'],
    [-1, 'Base parque'],
    [-2, 'Fondo mapa'],
  ];
  tiles.forEach(([sec, name], i) => {
    const x = 30 + i * (cell + gap);
    fillWithTile(ctx, sec, false, x, y, cell, 14);
    label(ctx, name, x, y + cell + 16);
  });
  y += cell + 40;

  // ── Texturas del suelo (oscuro) ──
  header(ctx, 'Texturas del suelo — tema oscuro', 30, y);
  y += 16;
  tiles.forEach(([sec, name], i) => {
    const x = 30 + i * (cell + gap);
    fillWithTile(ctx, sec, true, x, y, cell, 14);
    label(ctx, name, x, y + cell + 16);
  });
  y += cell + 44;

  // ── Árboles por ecosistema ──
  header(ctx, 'Árboles por ecosistema (siluetas A / B / C)', 30, y);
  y += 24;
  const treeBaseY = y + cell - 10;
  for (let sec = 0; sec < 3; sec++) {
    for (let v = 0; v < 3; v++) {
      const idx = sec * 3 + v;
      const x = 60 + idx * (cell * 0.62);
      drawSimpleTree(ctx, x, treeBaseY, 92, 0, idx * 1.7 + 3, v as 0 | 1 | 2, false, sec);
    }
    label(ctx, SECTION_LABELS[sec], 60 + sec * 3 * (cell * 0.62) - 4, treeBaseY + 22);
  }
  y += cell + 40;

  // ── Vista amplia "de lejos" (pipeline real: súper-baldosa + variación macro) ──
  header(ctx, 'Vista amplia — de lejos NO debe verse como grilla (baldosa pequeña)', 30, y);
  y += 16;
  const farZones: Array<[number, string]> = [
    [0, 'Altas'],
    [1, 'Medias'],
    [2, 'Bajas'],
  ];
  const fw = 360;
  const fh = 132;
  farZones.forEach(([sec, name], i) => {
    const x = 30 + i * (fw + gap);
    const cache = new GroundPatternCache();
    cache.setTilePx(5); // baldosa pequeña = simula estar lejos (muchas repeticiones)
    const poly = [
      { x, y },
      { x: x + fw, y },
      { x: x + fw, y: y + fh },
      { x, y: y + fh },
    ];
    fillPolygonWithGroundTexture(ctx, poly, sec, false, '#000', 0, cache, 1.15);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(x, y, fw, fh);
    label(ctx, name, x, y + fh + 16);
  });
  y += fh + 44;

  // ── Efectos ambientales (snapshot) ──
  header(ctx, 'Efectos ambientales (instantánea)', 30, y);
  y += 16;
  const efx = cell;

  const rain = new MapRainEffect(); rain.setIntensity(0.85);
  snapshotEffect(ctx, rain, 30, y, efx, '#2a3550');
  label(ctx, 'Lluvia', 30, y + efx + 16, true);

  const motes = new MapMotesEffect(); motes.setIntensity(0.95);
  snapshotEffect(ctx, motes, 30 + (efx + gap), y, efx, '#1a1430');
  label(ctx, 'Luciérnagas', 30 + (efx + gap), y + efx + 16, true);

  const leaves = new MapLeavesEffect(); leaves.setIntensity(0.85);
  snapshotEffect(ctx, leaves, 30 + 2 * (efx + gap), y, efx, '#6a8a40', 45);
  label(ctx, 'Hojas', 30 + 2 * (efx + gap), y + efx + 16, true);

  const fog = new MapFogEffect(); fog.setIntensity(0.8);
  snapshotEffect(ctx, fog, 30 + 3 * (efx + gap), y, efx, '#5a6a78');
  label(ctx, 'Niebla', 30 + 3 * (efx + gap), y + efx + 16, true);

  const cloud = new MapCloudShadowEffect(); cloud.setIntensity(0.7);
  snapshotEffect(ctx, cloud, 30 + 4 * (efx + gap), y, efx, '#8aa060');
  label(ctx, 'Sombras nube', 30 + 4 * (efx + gap), y + efx + 16, true);

  const bolt = new MapLightningEffect();
  bolt.setEnabled(true); bolt.setRainIntensity(1);
  bolt.forceFlash(true);
  ctx.save();
  const lx = 30 + 5 * (efx + gap);
  ctx.fillStyle = '#1c2438';
  ctx.fillRect(lx, y, efx, efx);
  ctx.beginPath(); ctx.rect(lx, y, efx, efx); ctx.clip();
  ctx.translate(lx, y);
  bolt.draw(ctx, null, efx, efx);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(lx, y, efx, efx);
  label(ctx, 'Relámpago', lx, y + efx + 16, true);
}

(window as any).renderPreview = render;
