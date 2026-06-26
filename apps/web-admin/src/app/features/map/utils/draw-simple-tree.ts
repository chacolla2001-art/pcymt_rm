import { PARK_MAP_VIS } from './map-park-visual-scale';

export type SimpleTreeVariant = 0 | 1 | 2;

export interface TreeCanopyPalette {
  light: string;
  mid: string;
  dark: string;
  highlight: string;
  stroke: string;
  trunk: string;
  trunkDark: string;
}

/** Ajuste por zona del árbol. Todo es relativo a la altura `h`, así que escala a cualquier tamaño. */
export interface TreeZoneStyle {
  /** Multiplicador de altura respecto a la altura base recibida. */
  scale: number;
  /** Grosor de contorno como fracción de `h`. */
  outline: number;
  /** Ancho de la sombra proyectada como fracción de `h`. */
  shadowW: number;
}

/**
 * ░░ PUNTO ÚNICO DE AJUSTE DE LOS ÁRBOLES ░░
 * Claves: 0 Tierras Altas, 1 Tierras Medias, 2 Tierras Bajas (negativas → fallback a 1).
 */
export const TREE_STYLE: Record<number, TreeZoneStyle> = {
  0: { scale: 1.0, outline: 0.045, shadowW: 0.66 },
  1: { scale: 1.0, outline: 0.045, shadowW: 0.8 },
  2: { scale: 1.02, outline: 0.05, shadowW: 0.98 },
};

/** Acentos florales por especie (no dependen de la paleta de zona). */
const BLOOM_JACARANDA = { fill: '#9B6FD4', stroke: '#553B86' };
const BLOOM_TOBOROCHI = { fill: '#F58FBE', stroke: '#B85A86' };
const PUYA_SPIKE = { fill: '#D7CFA4', mid: '#B7AE80', stroke: '#5C5430' };

/** Paletas cartoon por ecosistema (colores planos saturados + contorno oscuro). */
export function treePaletteForSection(section: number, isDark: boolean): TreeCanopyPalette {
  if (section === 0) {
    // Tierras Altas: verde frío de puna (queñua/kiswara), tronco rojizo
    return isDark
      ? { light: '#3E8A52', mid: '#256A3A', dark: '#164A28', highlight: '#7FD08A', stroke: '#08200F', trunk: '#7A3A24', trunkDark: '#4E2414' }
      : { light: '#5BB562', mid: '#2F7D44', dark: '#1C5530', highlight: '#9FE0A0', stroke: '#0C2A16', trunk: '#9A4A2E', trunkDark: '#63301C' };
  }
  if (section === 2) {
    // Tierras Bajas: selva, verde intenso ancho
    return isDark
      ? { light: '#3FB055', mid: '#1F7A38', dark: '#125424', highlight: '#7FE889', stroke: '#06220E', trunk: '#5A3A24', trunkDark: '#382414' }
      : { light: '#5FD46A', mid: '#2E9E48', dark: '#1A6E30', highlight: '#A6F0A0', stroke: '#0A3018', trunk: '#7A4E32', trunkDark: '#4E3020' };
  }
  // Tierras Medias: copa redonda verde lima brillante
  return isDark
    ? { light: '#7FCC48', mid: '#4F9628', dark: '#356E1A', highlight: '#C2F074', stroke: '#0E2A0A', trunk: '#6A4628', trunkDark: '#432C18' }
    : { light: '#A6E85A', mid: '#6FC23A', dark: '#4A8E24', highlight: '#D8F79A', stroke: '#163A10', trunk: '#8A5E3C', trunkDark: '#5A3A22' };
}

function seededTreeRand(seed: number): () => number {
  let s = Math.abs(Math.floor(seed * 9973)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Círculo de luz directa (blanco semitransparente, arriba-izquierda). */
function specular(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

interface Lobe {
  x: number;
  y: number;
  r: number;
}

/**
 * Copa cartoon SIN HUECOS: dibuja TODO el underlay negro primero (la unión de
 * lóbulos forma una sola silueta), luego el relleno base, luego la luz por
 * lóbulo. Mientras los lóbulos se solapen, no quedan espacios transparentes ni
 * contornos internos visibles.
 */
function paintLobes(ctx: CanvasRenderingContext2D, lobes: Lobe[], colors: TreeCanopyPalette, lw: number): void {
  ctx.fillStyle = colors.stroke;
  for (const l of lobes) {
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r + lw, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colors.dark;
  for (const l of lobes) {
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const l of lobes) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.arc(l.x - l.r * 0.16, l.y - l.r * 0.18, l.r * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.arc(l.x - l.r * 0.32, l.y - l.r * 0.36, l.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // brillo en el lóbulo más alto-izquierdo
  let top = lobes[0];
  for (const l of lobes) if (l.y - l.r < top.y - top.r) top = l;
  specular(ctx, top.x - top.r * 0.34, top.y - top.r * 0.4, top.r * 0.22);
}

/** Flores/puntos de color repartidos sobre la copa (jacarandá, toborochi). */
function bloomDots(ctx: CanvasRenderingContext2D, lobes: Lobe[], color: { fill: string; stroke: string }, rand: () => number, r: number, count: number): void {
  for (let k = 0; k < count; k++) {
    const l = lobes[Math.floor(rand() * lobes.length)];
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * l.r * 0.82;
    const x = l.x + Math.cos(a) * rr;
    const y = l.y + Math.sin(a) * rr;
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = r * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Trazo con contorno: negro grueso debajo + color encima (ramas, fronds, lianas). */
function outlinedStroke(ctx: CanvasRenderingContext2D, drawPath: () => void, outline: string, fill: string, wOut: number, wFill: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = wOut;
  drawPath();
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = wFill;
  drawPath();
  ctx.stroke();
}

/** Tronco trapezoidal con contorno + sombra cel a la derecha. Devuelve la y de la base de copa. */
function trunkTrapezoid(ctx: CanvasRenderingContext2D, trunkH: number, trunkW: number, colors: TreeCanopyPalette, lw: number): number {
  const baseW = trunkW * 1.1;
  const topW = trunkW * 0.72;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-baseW / 2, 0);
    ctx.lineTo(-topW / 2, -trunkH);
    ctx.lineTo(topW / 2, -trunkH);
    ctx.lineTo(baseW / 2, 0);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = colors.trunk;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = colors.trunkDark;
  ctx.fillRect(0, -trunkH, baseW, trunkH);
  ctx.restore();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = lw;
  path();
  ctx.stroke();
  return -trunkH;
}

/** Tronco abombado (toborochi: barriga panzona). Devuelve y de base de copa. */
function bulbTrunk(ctx: CanvasRenderingContext2D, trunkH: number, trunkW: number, colors: TreeCanopyPalette, lw: number): number {
  const belly = trunkW * 2.4;
  const baseW = trunkW * 1.0;
  const topW = trunkW * 0.66;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-baseW / 2, 0);
    ctx.quadraticCurveTo(-belly / 2, -trunkH * 0.42, -topW / 2, -trunkH);
    ctx.lineTo(topW / 2, -trunkH);
    ctx.quadraticCurveTo(belly / 2, -trunkH * 0.42, baseW / 2, 0);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = colors.trunk;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = colors.trunkDark;
  ctx.fillRect(0, -trunkH, belly, trunkH);
  ctx.restore();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = lw;
  path();
  ctx.stroke();
  return -trunkH;
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, w: number, isDark: boolean): void {
  ctx.globalAlpha = isDark ? 0.34 : 0.2;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, 1, w * 0.42, w * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ───────────────────────── Tierras Altas ─────────────────────────

/** Queñua / Kewiña (Polylepis): tronco rojizo retorcido, copa pequeña irregular. */
function quenua(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const w = h * 0.72;
  const trunkH = h * 0.42;
  const lean = (rand() - 0.5) * w * 0.16;
  const topX = lean;
  const topY = -trunkH;
  outlinedStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w * 0.1, -trunkH * 0.5, topX, topY);
    },
    colors.stroke,
    colors.trunk,
    w * 0.16 + lw,
    w * 0.16 - lw * 0.4,
  );
  outlinedStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(topX * 0.4, -trunkH * 0.55);
      ctx.quadraticCurveTo(-w * 0.14, -trunkH * 0.78, -w * 0.16, -trunkH * 0.98);
    },
    colors.stroke,
    colors.trunk,
    w * 0.1 + lw,
    w * 0.1 - lw * 0.4,
  );
  const cy = topY;
  paintLobes(
    ctx,
    [
      { x: topX, y: cy - h * 0.16, r: w * 0.27 },
      { x: topX - w * 0.22, y: cy - h * 0.06, r: w * 0.2 },
      { x: topX + w * 0.22, y: cy - h * 0.06, r: w * 0.2 },
      { x: topX - w * 0.04, y: cy - h * 0.3, r: w * 0.18 },
      { x: topX + w * 0.14, y: cy - h * 0.24, r: w * 0.16 },
    ],
    colors,
    lw,
  );
}

/** Kiswara (Buddleja coriacea): tronco recto esbelto, copa redonda compacta. */
function kiswara(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, _rand: () => number): void {
  const w = h * 0.58;
  const cb = trunkTrapezoid(ctx, h * 0.48, w * 0.13, colors, lw);
  paintLobes(
    ctx,
    [
      { x: 0, y: cb - h * 0.18, r: w * 0.34 },
      { x: -w * 0.22, y: cb - h * 0.06, r: w * 0.22 },
      { x: w * 0.22, y: cb - h * 0.06, r: w * 0.22 },
      { x: -w * 0.02, y: cb - h * 0.34, r: w * 0.24 },
    ],
    colors,
    lw,
  );
}

/** Puya Raimondii: roseta de hojas espinosas + espiga floral gigante (icónica). */
function puya(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const w = h * 0.52;
  const leaves = 11;
  // roseta basal: hojas espinosas radiales (relleno + contorno, sin huecos por solape)
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI * 0.97 + (i / (leaves - 1)) * Math.PI * 0.94;
    const len = w * (0.46 + rand() * 0.22);
    const tx = Math.cos(a) * len;
    const ty = Math.sin(a) * len * 0.7 - h * 0.02;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const halfW = w * 0.07;
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(nx * halfW, ny * halfW - h * 0.02);
      ctx.lineTo(tx, ty);
      ctx.lineTo(-nx * halfW, -ny * halfW - h * 0.02);
      ctx.closePath();
    };
    ctx.fillStyle = i % 2 === 0 ? colors.mid : colors.dark;
    draw();
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = lw * 0.7;
    draw();
    ctx.stroke();
  }
  // espiga floral central
  const colH = h * 0.96;
  const colW = w * 0.18;
  const colPath = () => {
    ctx.beginPath();
    ctx.moveTo(-colW / 2, -h * 0.04);
    ctx.lineTo(-colW * 0.28, -colH);
    ctx.quadraticCurveTo(0, -colH - colW * 0.4, colW * 0.28, -colH);
    ctx.lineTo(colW / 2, -h * 0.04);
    ctx.closePath();
  };
  colPath();
  ctx.fillStyle = PUYA_SPIKE.fill;
  ctx.fill();
  ctx.save();
  colPath();
  ctx.clip();
  ctx.fillStyle = PUYA_SPIKE.mid;
  ctx.fillRect(0, -colH, colW, colH);
  ctx.restore();
  ctx.strokeStyle = PUYA_SPIKE.stroke;
  ctx.lineWidth = lw;
  colPath();
  ctx.stroke();
  // textura de flores en la espiga
  for (let i = 0; i < 9; i++) {
    const yy = -h * 0.1 - (i / 9) * colH * 0.88;
    const xx = (rand() - 0.5) * colW * 0.7;
    ctx.fillStyle = PUYA_SPIKE.mid;
    ctx.strokeStyle = PUYA_SPIKE.stroke;
    ctx.lineWidth = lw * 0.4;
    ctx.beginPath();
    ctx.arc(xx, yy, colW * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ───────────────────────── Tierras Medias ─────────────────────────

/** Molle (Schinus molle): copa redonda con flecos colgantes (follaje llorón). */
function molle(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const w = h * 0.82;
  const cb = trunkTrapezoid(ctx, h * 0.32, w * 0.12, colors, lw);
  const lobes: Lobe[] = [
    { x: -w * 0.3, y: cb - h * 0.32, r: w * 0.3 },
    { x: w * 0.3, y: cb - h * 0.32, r: w * 0.3 },
    { x: 0, y: cb - h * 0.5, r: w * 0.4 },
    { x: 0, y: cb - h * 0.26, r: w * 0.3 },
  ];
  paintLobes(ctx, lobes, colors, lw);
  // flecos llorones colgando del borde inferior
  for (let i = 0; i < 7; i++) {
    const fx = -w * 0.42 + (i / 6) * w * 0.84;
    const fy = cb - h * 0.18 + Math.abs(fx) * 0.12;
    const flen = h * (0.1 + rand() * 0.12);
    outlinedStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + w * 0.03, fy + flen * 0.6, fx - w * 0.02, fy + flen);
      },
      colors.stroke,
      colors.mid,
      lw * 2.4,
      lw * 1.1,
    );
  }
}

/** Jacarandá: copa redonda con floración violeta. */
function jacaranda(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const w = h * 0.8;
  const cb = trunkTrapezoid(ctx, h * 0.3, w * 0.12, colors, lw);
  const lobes: Lobe[] = [
    { x: -w * 0.26, y: cb - h * 0.34, r: w * 0.3 },
    { x: w * 0.26, y: cb - h * 0.34, r: w * 0.3 },
    { x: 0, y: cb - h * 0.52, r: w * 0.4 },
  ];
  paintLobes(ctx, lobes, colors, lw);
  bloomDots(ctx, lobes, BLOOM_JACARANDA, rand, Math.max(0.8, w * 0.05), 16);
}

/** Tipa (Tipuana tipu): copa ancha frondosa tipo paraguas. */
function tipa(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, _rand: () => number): void {
  const w = h * 0.96;
  const cb = trunkTrapezoid(ctx, h * 0.3, w * 0.12, colors, lw);
  paintLobes(
    ctx,
    [
      { x: -w * 0.36, y: cb - h * 0.3, r: w * 0.3 },
      { x: w * 0.36, y: cb - h * 0.3, r: w * 0.3 },
      { x: -w * 0.12, y: cb - h * 0.42, r: w * 0.34 },
      { x: w * 0.16, y: cb - h * 0.44, r: w * 0.32 },
      { x: 0, y: cb - h * 0.28, r: w * 0.3 },
    ],
    colors,
    lw,
  );
}

// ───────────────────────── Tierras Bajas ─────────────────────────

/** Toborochi (Ceiba speciosa): tronco abombado + copa paraguas + flores rosadas. */
function toborochi(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const w = h * 0.9;
  const cb = bulbTrunk(ctx, h * 0.44, w * 0.16, colors, lw);
  const lobes: Lobe[] = [
    { x: -w * 0.34, y: cb - h * 0.1, r: w * 0.3 },
    { x: w * 0.34, y: cb - h * 0.1, r: w * 0.3 },
    { x: 0, y: cb - h * 0.26, r: w * 0.42 },
    { x: -w * 0.06, y: cb - h * 0.06, r: w * 0.3 },
  ];
  paintLobes(ctx, lobes, colors, lw);
  bloomDots(ctx, lobes, BLOOM_TOBOROCHI, rand, Math.max(0.9, w * 0.055), 14);
}

/** Palmera Motacú: tronco fino curvo anillado + corona de fronds radiales. */
function palmera(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number): void {
  const trunkH = h * 0.66;
  const lean = (rand() - 0.4) * h * 0.16;
  const tx = lean;
  const ty = -trunkH;
  const trunkPath = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * 0.3, -trunkH * 0.5, tx, ty);
  };
  outlinedStroke(ctx, trunkPath, colors.stroke, colors.trunk, h * 0.1 + lw, h * 0.1 - lw * 0.6);
  // anillos del tronco
  for (let i = 1; i <= 5; i++) {
    const f = i / 6;
    const rx = lean * 0.3 * (1 - (1 - f) * (1 - f)) + tx * f * f;
    const ry = -trunkH * f;
    ctx.strokeStyle = colors.trunkDark;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(rx - h * 0.045, ry);
    ctx.lineTo(rx + h * 0.045, ry);
    ctx.stroke();
  }
  // corona de fronds
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI * 0.94 + (i / (fronds - 1)) * Math.PI * 0.88;
    const len = h * (0.4 + rand() * 0.12);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.78 + len * 0.18;
    const cx = tx + Math.cos(a) * len * 0.5;
    const cy = ty + Math.sin(a) * len * 0.4;
    outlinedStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
      },
      colors.stroke,
      i % 2 === 0 ? colors.mid : colors.dark,
      lw * 3.4,
      lw * 1.8,
    );
  }
  // cogollo central + racimo
  ctx.fillStyle = colors.dark;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(tx, ty, h * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Bibosi / Ceibo de selva: tronco ancho con contrafuertes + copa ancha + lianas. */
function bibosi(ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, _rand: () => number): void {
  const w = h * 0.98;
  // lianas detrás de la copa
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const vx = i * w * 0.3;
    const vy = -h * 0.32;
    const vlen = h * (0.2 + ((i + 1) % 2) * 0.12);
    outlinedStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.quadraticCurveTo(vx + w * 0.05, vy + vlen * 0.6, vx - w * 0.03, vy + vlen);
      },
      colors.stroke,
      colors.mid,
      lw * 3.2,
      lw * 1.6,
    );
  }
  const cb = trunkTrapezoid(ctx, h * 0.3, w * 0.17, colors, lw);
  // contrafuertes en la base
  for (const s of [-1, 1]) {
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.04, cb * 0.0);
      ctx.lineTo(s * w * 0.18, 0);
      ctx.lineTo(s * w * 0.05, 0);
      ctx.closePath();
    };
    ctx.fillStyle = colors.trunk;
    draw();
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = lw;
    draw();
    ctx.stroke();
  }
  paintLobes(
    ctx,
    [
      { x: -w * 0.36, y: cb - h * 0.28, r: w * 0.32 },
      { x: w * 0.38, y: cb - h * 0.28, r: w * 0.32 },
      { x: 0, y: cb - h * 0.2, r: w * 0.3 },
      { x: -w * 0.1, y: cb - h * 0.48, r: w * 0.4 },
      { x: w * 0.18, y: cb - h * 0.46, r: w * 0.34 },
    ],
    colors,
    lw,
  );
}

type SpeciesFn = (ctx: CanvasRenderingContext2D, h: number, colors: TreeCanopyPalette, lw: number, rand: () => number) => void;

/** Especies por zona (3 variantes c/u). variant ∈ {0,1,2} selecciona la especie. */
const SPECIES: Record<number, [SpeciesFn, SpeciesFn, SpeciesFn]> = {
  0: [quenua, kiswara, puya],
  1: [molle, jacaranda, tipa],
  2: [toborochi, palmera, bibosi],
};

export function drawSimpleTree(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  height: number,
  _phase: number,
  seed: number,
  variant: SimpleTreeVariant,
  isDark: boolean,
  section = 1,
): void {
  const colors = treePaletteForSection(section, isDark);
  const rand = seededTreeRand(seed * 131.7 + section * 17 + variant * 5 + 3);
  const cfg = TREE_STYLE[section] ?? TREE_STYLE[1];
  const h = Math.max(PARK_MAP_VIS.treeMinWorld, height * cfg.scale);
  const lw = Math.max(0.6, h * cfg.outline);
  const species = SPECIES[section] ?? SPECIES[1];
  const fn = species[(((variant % 3) + 3) % 3) as SimpleTreeVariant];

  ctx.save();
  ctx.translate(footX, footY);
  drawGroundShadow(ctx, h * cfg.shadowW, isDark);
  fn(ctx, h, colors, lw, rand);
  ctx.restore();
}

export function stickerTreeSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h & 0xffff) / 0xffff) * Math.PI * 2;
}

export function isTreeStickerKey(key: string): boolean {
  return /^tree-\d+$/.test(key);
}
