import { clampGroundTilePx, PARK_MAP_VIS, parkGroundPatternDensity } from './map-park-visual-scale';

/** Procedural ground — sections 0=Altas, 1=Medias, 2=Bajas, -1=park, -2=map backdrop. */

function n(tile: number, density: number, min = 1): number {
  return Math.max(min, Math.round((tile * tile / 64) * density));
}

export interface GroundTexturePalette {
  base: string;
  accent: string;
  speck: string;
  line: string;
  light: string;
}

export function groundPaletteForSection(sectionIndex: number, isDark: boolean): GroundTexturePalette {
  if (sectionIndex === 0) {
    return isDark
      ? { base: '#3A3228', accent: '#564838', speck: '#685850', line: '#2E261E', light: '#7A6A58' }
      : { base: '#8E7C64', accent: '#6E5C48', speck: '#5A4A38', line: '#4A3E30', light: '#A8987C' };
  }
  if (sectionIndex === 2) {
    return isDark
      ? { base: '#1C3024', accent: '#305840', speck: '#3C6848', line: '#142018', light: '#4A7858' }
      : { base: '#3E7A50', accent: '#2E6640', speck: '#245834', line: '#327048', light: '#569868' };
  }
  return isDark
    ? { base: '#2E3A22', accent: '#4C6430', speck: '#5C7438', line: '#202818', light: '#6C8848' }
    : { base: '#7A9638', accent: '#628028', speck: '#527020', line: '#6A8C30', light: '#96B050' };
}

export function parkBasePalette(isDark: boolean): GroundTexturePalette {
  return isDark
    ? { base: '#2C3024', accent: '#404C34', speck: '#505C44', line: '#242818', light: '#5C6850' }
    : { base: '#8A9A6C', accent: '#6E8054', speck: '#5E7048', line: '#7A8C60', light: '#A4B480' };
}

export function mapBackdropPalette(isDark: boolean): GroundTexturePalette {
  return isDark
    ? { base: '#242830', accent: '#383E4A', speck: '#464E5A', line: '#1C2028', light: '#525C68' }
    : { base: '#A8B4A0', accent: '#8C9A84', speck: '#7C8A74', line: '#94A08C', light: '#BCC8B4' };
}

function seededRand(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function softWashes(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number, count: number): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() > 0.5 ? p.accent : p.line;
    ctx.globalAlpha = 0.09 + rand() * 0.11;
    const x = rand() * tile;
    const y = rand() * tile;
    const r = tile * (0.2 + rand() * 0.26);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function softSpecks(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number, count: number, alpha = 0.34): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() > 0.4 ? p.speck : p.line;
    ctx.globalAlpha = alpha * (0.55 + rand() * 0.45);
    const s = 0.4 + rand() * 0.5;
    ctx.fillRect(rand() * tile, rand() * tile, s, s * 0.85);
  }
  ctx.globalAlpha = 1;
}

function softGrain(ctx: CanvasRenderingContext2D, tile: number, rand: () => number, isDark: boolean): void {
  for (let i = 0; i < n(tile, 1.8, 8); i++) {
    ctx.fillStyle = isDark ? `rgba(255,255,255,${0.035 * rand()})` : `rgba(0,0,0,${0.028 * rand()})`;
    ctx.fillRect(rand() * tile, rand() * tile, 0.5, 0.5);
  }
}

function paintHighlands(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number): void {
  softWashes(ctx, p, rand, tile, n(tile, 0.4, 2));
  softSpecks(ctx, p, rand, tile, n(tile, 1.3, 5), 0.24);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 0.2;
  ctx.globalAlpha = 0.16;
  const step = Math.max(2, Math.round(tile / 2.5));
  for (let d = -tile; d < tile * 2; d += step) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + tile, tile);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintValley(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number): void {
  softWashes(ctx, p, rand, tile, n(tile, 0.45, 2));
  const blades = n(tile, 1.6, 6);
  for (let i = 0; i < blades; i++) {
    const x = rand() * tile;
    const y = rand() * tile;
    const h = 0.55 + rand() * 1.3;
    ctx.strokeStyle = rand() > 0.35 ? p.accent : p.light;
    ctx.lineWidth = 0.17;
    ctx.globalAlpha = 0.38 + rand() * 0.28;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 1.4, y - h * 0.45, x + (rand() - 0.5) * 1.1, y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintJungle(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number): void {
  softWashes(ctx, p, rand, tile, n(tile, 0.5, 2));
  for (let i = 0; i < n(tile, 0.55, 3); i++) {
    ctx.fillStyle = p.line;
    ctx.globalAlpha = 0.09 + rand() * 0.07;
    ctx.beginPath();
    ctx.ellipse(rand() * tile, rand() * tile, 0.7 + rand() * 1.4, 0.55 + rand() * 1, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  softSpecks(ctx, p, rand, tile, n(tile, 1.4, 5), 0.2);
}

function paintParkBase(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number): void {
  softWashes(ctx, p, rand, tile, n(tile, 0.42, 2));
  for (let i = 0; i < n(tile, 1.2, 5); i++) {
    const x = rand() * tile;
    const y = rand() * tile;
    const h = 0.45 + rand() * 1;
    ctx.strokeStyle = p.speck;
    ctx.lineWidth = 0.15;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 1.1, y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintBackdrop(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, tile: number): void {
  softWashes(ctx, p, rand, tile, n(tile, 0.36, 2));
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 0.18;
  ctx.globalAlpha = 0.11;
  for (let i = 0; i < 2; i++) {
    const cy = rand() * tile;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let x = 0; x <= tile; x += 2) {
      ctx.lineTo(x, cy + Math.sin((x + i * 11) * 0.3) * 0.6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  softSpecks(ctx, p, rand, tile, n(tile, 0.85, 4), 0.14);
}

function paletteForSection(sectionIndex: number, isDark: boolean): GroundTexturePalette {
  if (sectionIndex === -2) return mapBackdropPalette(isDark);
  if (sectionIndex < 0) return parkBasePalette(isDark);
  return groundPaletteForSection(sectionIndex, isDark);
}

function paintSection(ctx: CanvasRenderingContext2D, sectionIndex: number, p: GroundTexturePalette, rand: () => number, tile: number): void {
  if (sectionIndex === -2) paintBackdrop(ctx, p, rand, tile);
  else if (sectionIndex < 0) paintParkBase(ctx, p, rand, tile);
  else if (sectionIndex === 0) paintHighlands(ctx, p, rand, tile);
  else if (sectionIndex === 2) paintJungle(ctx, p, rand, tile);
  else paintValley(ctx, p, rand, tile);
}

export function buildGroundPatternTile(
  sectionIndex: number,
  isDark: boolean,
  tilePx: number = PARK_MAP_VIS.groundTilePx,
): HTMLCanvasElement {
  const tile = clampGroundTilePx(tilePx);
  const canvas = document.createElement('canvas');
  canvas.width = tile;
  canvas.height = tile;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const palette = paletteForSection(sectionIndex, isDark);
  const rand = seededRand(sectionIndex * 991 + (isDark ? 17 : 0) + tile * 5);

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, tile, tile);
  paintSection(ctx, sectionIndex, palette, rand, tile);
  softGrain(ctx, tile, seededRand(sectionIndex * 317 + tile), isDark);

  return canvas;
}

export class GroundPatternCache {
  private readonly patterns = new Map<string, CanvasPattern | null>();
  private tilePx: number = PARK_MAP_VIS.groundTilePx;

  getTilePx(): number {
    return this.tilePx;
  }

  setTilePx(px: number): void {
    const next = clampGroundTilePx(px);
    if (next === this.tilePx) return;
    this.tilePx = next;
    this.clear();
  }

  getPattern(ctx: CanvasRenderingContext2D, sectionIndex: number, isDark: boolean): CanvasPattern | null {
    const key = `${sectionIndex}_${isDark ? 'd' : 'l'}_${this.tilePx}`;
    const cached = this.patterns.get(key);
    if (cached !== undefined) return cached;

    const pattern = ctx.createPattern(buildGroundPatternTile(sectionIndex, isDark, this.tilePx), 'repeat');
    this.patterns.set(key, pattern);
    return pattern;
  }

  clear(): void {
    this.patterns.clear();
  }
}

function fillMapRectWithPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pattern: CanvasPattern | null,
  mapScale: number,
): void {
  if (!pattern) return;
  const dens = parkGroundPatternDensity(mapScale);
  ctx.save();
  ctx.scale(1 / dens, 1 / dens);
  ctx.fillStyle = pattern;
  ctx.fillRect(x * dens, y * dens, w * dens, h * dens);
  ctx.restore();
}

export function fillPolygonWithGroundTexture(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  sectionIndex: number,
  isDark: boolean,
  tintColor: string,
  tintOpacity: number,
  cache: GroundPatternCache,
  mapScale: number = PARK_MAP_VIS.groundRefZoom,
): void {
  if (points.length < 3) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 3;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.save();
  ctx.clip();

  const pattern = cache.getPattern(ctx, sectionIndex, isDark);
  fillMapRectWithPattern(ctx, minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2, pattern, mapScale);

  if (tintOpacity > 0) {
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = tintOpacity;
    ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export class MapBackdropCache {
  private readonly inner = new GroundPatternCache();

  setTilePx(px: number): void {
    this.inner.setTilePx(px);
  }

  getPattern(ctx: CanvasRenderingContext2D, isDark: boolean): CanvasPattern | null {
    return this.inner.getPattern(ctx, -2, isDark);
  }

  clear(): void {
    this.inner.clear();
  }
}

export function fillMapRectWithBackdrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isDark: boolean,
  cache: MapBackdropCache,
  mapScale: number,
): void {
  const pattern = cache.getPattern(ctx, isDark);
  fillMapRectWithPattern(ctx, x, y, w, h, pattern, mapScale);
}
