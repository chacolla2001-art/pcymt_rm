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

/** Paletas y silueta por ecosistema del parque. */
export function treePaletteForSection(section: number, isDark: boolean): TreeCanopyPalette {
  if (section === 0) {
    return isDark
      ? { light: '#6B7B52', mid: '#4A5A38', dark: '#354228', highlight: '#7D8F62', stroke: '#2A3520', trunk: '#5D4E3A', trunkDark: '#3E3228' }
      : { light: '#7A8F5C', mid: '#5C6F44', dark: '#465536', highlight: '#96A86E', stroke: '#3D4F2E', trunk: '#6D4C41', trunkDark: '#5D4037' };
  }
  if (section === 2) {
    return isDark
      ? { light: '#4FA858', mid: '#2E8B4A', dark: '#1F6B38', highlight: '#6FD47A', stroke: '#14502A', trunk: '#5D4037', trunkDark: '#4E342E' }
      : { light: '#66BB6A', mid: '#43A047', dark: '#2E7D32', highlight: '#81C784', stroke: '#1B5E20', trunk: '#795548', trunkDark: '#6D4C41' };
  }
  return isDark
    ? { light: '#558B2F', mid: '#33691E', dark: '#1B5E20', highlight: '#7CB342', stroke: '#0D3B14', trunk: '#5D4037', trunkDark: '#4E342E' }
    : { light: '#66BB6A', mid: '#43A047', dark: '#2E7D32', highlight: '#81C784', stroke: '#1B5E20', trunk: '#6D4C41', trunkDark: '#5D4037' };
}

function drawTaperedTrunk(
  ctx: CanvasRenderingContext2D,
  trunkH: number,
  trunkW: number,
  colors: TreeCanopyPalette,
  lineW: number,
): void {
  const baseW = trunkW * 1.05;
  const topW = trunkW * 0.42;
  ctx.beginPath();
  ctx.moveTo(-baseW / 2, 0);
  ctx.lineTo(-topW / 2, -trunkH);
  ctx.lineTo(topW / 2, -trunkH);
  ctx.lineTo(baseW / 2, 0);
  ctx.closePath();
  ctx.fillStyle = colors.trunk;
  ctx.fill();
  ctx.strokeStyle = colors.trunkDark;
  ctx.lineWidth = lineW * 0.65;
  ctx.globalAlpha *= 0.55;
  ctx.stroke();
  ctx.globalAlpha /= 0.55;

  ctx.fillStyle = colors.trunkDark;
  ctx.beginPath();
  ctx.moveTo(trunkW * 0.02, 0);
  ctx.lineTo(trunkW * 0.18, -trunkH * 0.92);
  ctx.lineTo(trunkW * 0.34, -trunkH * 0.88);
  ctx.lineTo(trunkW * 0.28, 0);
  ctx.closePath();
  ctx.fill();
}

function drawCanopyTriangle(
  ctx: CanvasRenderingContext2D,
  apexX: number,
  apexY: number,
  halfW: number,
  height: number,
  colors: TreeCanopyPalette,
  lineW: number,
  skew = 0,
): void {
  const baseY = apexY + height;
  const paint = (fill: string, pts: [number, number][], outline = false) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = lineW;
      ctx.globalAlpha *= 0.45;
      ctx.stroke();
      ctx.globalAlpha /= 0.45;
    }
  };
  const left = apexX - halfW + skew;
  const right = apexX + halfW + skew;
  const mid = apexX + skew * 0.5;
  paint(colors.mid, [[apexX + skew * 0.3, apexY], [left, baseY], [right, baseY]], true);
  paint(colors.dark, [[apexX + skew * 0.3, apexY], [right, baseY], [mid, baseY]]);
  ctx.save();
  ctx.globalAlpha *= 0.58;
  paint(colors.light, [[apexX + skew * 0.2, apexY], [left, baseY], [left + halfW * 0.38, baseY]]);
  ctx.restore();
}

function drawRoundCanopy(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  colors: TreeCanopyPalette,
  lineW: number,
): void {
  const blob = (x: number, y: number, rad: number, fill: string, stroke = true) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * 0.88, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = lineW;
      ctx.globalAlpha *= 0.4;
      ctx.stroke();
      ctx.globalAlpha /= 0.4;
    }
  };
  blob(cx + r * 0.06, cy + r * 0.1, r * 0.92, colors.mid);
  blob(cx - r * 0.34, cy - r * 0.12, r * 0.68, colors.light, false);
  blob(cx + r * 0.36, cy - r * 0.04, r * 0.62, colors.dark, false);
  blob(cx - r * 0.08, cy - r * 0.32, r * 0.48, colors.highlight, false);
}

function drawNeedleCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: TreeCanopyPalette,
  lineW: number,
  lean: number,
): void {
  drawCanopyTriangle(ctx, x, y, w, h, colors, lineW, lean);
}

/** Tierras Altas: pinos esbeltos en capas (bosque nublado). */
function drawAltasTree(
  ctx: CanvasRenderingContext2D,
  crownBase: number,
  h: number,
  w: number,
  colors: TreeCanopyPalette,
  lineW: number,
): void {
  drawNeedleCluster(ctx, -w * 0.06, crownBase - h * 0.62, w * 0.4, h * 0.44, colors, lineW, -w * 0.04);
  drawNeedleCluster(ctx, w * 0.04, crownBase - h * 0.4, w * 0.32, h * 0.34, colors, lineW * 0.9, w * 0.03);
  drawNeedleCluster(ctx, 0, crownBase - h * 0.2, w * 0.24, h * 0.26, colors, lineW * 0.75, 0);
  ctx.strokeStyle = colors.trunkDark;
  ctx.lineWidth = lineW * 0.5;
  ctx.globalAlpha *= 0.35;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.14, crownBase - h * 0.14);
    ctx.lineTo(side * w * 0.34, crownBase - h * 0.28);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.35;
}

/** Tierras Medias: valle — pino o copa redonda según variant. */
function drawMediasTree(
  ctx: CanvasRenderingContext2D,
  crownBase: number,
  h: number,
  w: number,
  variant: SimpleTreeVariant,
  colors: TreeCanopyPalette,
  lineW: number,
): void {
  if (variant === 1) {
    drawRoundCanopy(ctx, 0, crownBase - h * 0.3, w * 0.48, colors, lineW);
    ctx.fillStyle = colors.highlight;
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.ellipse(-w * 0.12, crownBase - h * 0.42, w * 0.14, h * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha /= 0.35;
    return;
  }
  drawCanopyTriangle(ctx, -w * 0.05, crownBase - h * 0.56, w * 0.52, h * 0.36, colors, lineW, -w * 0.05);
  drawCanopyTriangle(ctx, w * 0.04, crownBase - h * 0.36, w * 0.44, h * 0.3, colors, lineW, w * 0.04);
  drawCanopyTriangle(ctx, 0, crownBase - h * 0.18, w * 0.36, h * 0.28, colors, lineW * 0.85, 0);
}

/** Tierras Bajas: copa ancha selvática con sub-copas. */
function drawBajasTree(
  ctx: CanvasRenderingContext2D,
  crownBase: number,
  h: number,
  w: number,
  variant: SimpleTreeVariant,
  colors: TreeCanopyPalette,
  lineW: number,
): void {
  drawRoundCanopy(ctx, 0, crownBase - h * 0.38, w * 0.58, colors, lineW);
  drawCanopyTriangle(ctx, -w * 0.12, crownBase - h * 0.22, w * 0.48, h * 0.3, colors, lineW * 0.9, -w * 0.06);
  if (variant !== 0) {
    drawRoundCanopy(ctx, w * 0.22, crownBase - h * 0.28, w * 0.3, colors, lineW * 0.85);
  }
  ctx.save();
  ctx.globalAlpha *= 0.42;
  ctx.fillStyle = colors.highlight;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(i * w * 0.24, crownBase - h * 0.5, w * 0.14, h * 0.07, i * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = colors.dark;
  ctx.globalAlpha *= 0.28;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(i * w * 0.18, crownBase - h * 0.08, w * 0.1, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha /= 0.28;
}

export function drawSimpleTree(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  height: number,
  _phase: number,
  _seed: number,
  variant: SimpleTreeVariant,
  isDark: boolean,
  section = 1,
): void {
  const colors = treePaletteForSection(section, isDark);
  const sectionScale = section === 0 ? 1.12 : section === 2 ? 0.92 : 1;
  const h = Math.max(PARK_MAP_VIS.treeMinWorld, height * sectionScale);
  const w = h * (section === 2 ? 0.72 : section === 0 ? 0.5 : variant === 1 ? 0.66 : 0.58);
  const lineW = Math.max(0.6, h * 0.018);
  const trunkH = h * (section === 0 ? 0.32 : 0.27);
  const trunkW = w * (section === 2 ? 0.16 : 0.14);

  ctx.save();
  ctx.translate(footX, footY);

  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.38)' : 'rgba(10,20,10,0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 2, w * 0.32, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();

  drawTaperedTrunk(ctx, trunkH, trunkW, colors, lineW);

  const crownBase = -trunkH;
  if (section === 0) drawAltasTree(ctx, crownBase, h, w, colors, lineW);
  else if (section === 2) drawBajasTree(ctx, crownBase, h, w, variant, colors, lineW);
  else drawMediasTree(ctx, crownBase, h, w, variant, colors, lineW);

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
