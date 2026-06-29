"use strict";
(() => {
  // src/app/features/map/utils/map-park-visual-scale.ts
  var PARK_MAP_VIS = {
    ambientScreen: 0.36,
    ambientZoomExp: 0.4,
    planRadius: 0.52,
    particleCount: 0.62,
    treeBaseWorld: 8,
    treeMinWorld: 3.2,
    /** Baldosa por defecto (px espacio mapa). Más bajo = grano más fino. */
    groundTilePx: 5,
    groundTileMin: 2,
    groundTileMax: 48,
    zoomMin: 0.08,
    zoomMax: 120,
    zoomWheelOut: 0.8,
    zoomWheelIn: 1.25,
    zoomButtonFactor: 1.5,
    parkBaseTintDark: 0.12,
    parkBaseTintLight: 0.14,
    groundRefZoom: 1.15,
    /** Tinte de zona — si es alto, tapa la textura procedural. */
    groundTintMax: 0.16,
    groundTintMul: 0.22,
    sectionStroke: 1.6,
    sectionStrokeHover: 2.4,
    sectionStrokeActive: 2.1
  };
  function parkAmbientScreenScale(screenScale, sizeMul) {
    const zoom = Math.pow(Math.max(0.22, screenScale), PARK_MAP_VIS.ambientZoomExp);
    return zoom * sizeMul * PARK_MAP_VIS.ambientScreen;
  }
  function parkPlanSize(base) {
    return base * PARK_MAP_VIS.planRadius;
  }
  function parkParticleTarget(low, high, intensity) {
    const t = Math.max(0.12, intensity);
    return Math.max(1, Math.floor((low + (high - low) * t) * PARK_MAP_VIS.particleCount));
  }
  function parkGroundPatternDensity(mapScale) {
    const ref = PARK_MAP_VIS.groundRefZoom;
    return Math.max(0.85, mapScale / ref);
  }
  function clampGroundTilePx(px) {
    return Math.round(Math.min(PARK_MAP_VIS.groundTileMax, Math.max(PARK_MAP_VIS.groundTileMin, px)));
  }

  // src/app/features/map/utils/draw-ground-texture.ts
  function n(span, density, min = 1) {
    return Math.max(min, Math.round(span * span / 64 * density));
  }
  function groundPaletteForSection(sectionIndex, isDark) {
    if (sectionIndex === 0) {
      return isDark ? { base: "#5A4A30", accent: "#46381F", speck: "#6A5C44", line: "#241A0E", light: "#7A6640" } : { base: "#D8B878", accent: "#C09A55", speck: "#9A8B73", line: "#6B4F2A", light: "#EAD6A0" };
    }
    if (sectionIndex === 2) {
      return isDark ? { base: "#1A5028", accent: "#103A1C", speck: "#5A4A2A", line: "#06200E", light: "#2E8B40" } : { base: "#2E8B40", accent: "#1F6B30", speck: "#8A6A3C", line: "#0E3A1A", light: "#5CC85E" };
    }
    return isDark ? { base: "#3E6A22", accent: "#2E5418", speck: "#7A8E3A", line: "#16300C", light: "#5A8E30" } : { base: "#7DBE3F", accent: "#69A82F", speck: "#D8C84A", line: "#2E5418", light: "#A6E060" };
  }
  function parkBasePalette(isDark) {
    return isDark ? { base: "#3A4632", accent: "#2C3626", speck: "#46523A", line: "#1A2014", light: "#52624A" } : { base: "#8FA86A", accent: "#79925A", speck: "#6E8050", line: "#41502E", light: "#A8C084" };
  }
  function mapBackdropPalette(isDark) {
    return isDark ? { base: "#252B33", accent: "#323A45", speck: "#3A424E", line: "#161A20", light: "#3E4754" } : { base: "#AEB8A6", accent: "#98A28E", speck: "#888F7E", line: "#6E7866", light: "#C6CEBE" };
  }
  function seededRand(seed) {
    let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
    return () => {
      s = s * 16807 % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  function wrapped(span, x, y, margin, fn) {
    const xs = [x];
    const ys = [y];
    if (x < margin) xs.push(x + span);
    if (x > span - margin) xs.push(x - span);
    if (y < margin) ys.push(y + span);
    if (y > span - margin) ys.push(y - span);
    for (const wx of xs) for (const wy of ys) fn(wx, wy);
  }
  function flatPatch(ctx, p, rand, span, unit, count) {
    for (let i = 0; i < count; i++) {
      const x = rand() * span;
      const y = rand() * span;
      const r = unit * (0.7 + rand() * 1.1);
      const col = rand() > 0.5 ? p.accent : p.light;
      wrapped(span, x, y, r, (wx, wy) => {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(wx, wy, r, r * 0.78, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }
  function cartoonStone(ctx, p, span, x, y, size, lw) {
    wrapped(span, x, y, size + lw, (wx, wy) => {
      ctx.beginPath();
      ctx.ellipse(wx, wy, size, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.speck;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = p.line;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(wx - size * 0.3, wy - size * 0.26, size * 0.34, size * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function cartoonGrass(ctx, p, rand, span, x, y, size, lw) {
    wrapped(span, x, y, size + lw, (wx, wy) => {
      ctx.lineCap = "round";
      for (let b = 0; b < 3; b++) {
        const lean = (b - 1) * 0.5 + (rand() - 0.5) * 0.3;
        const h = size * (0.9 + rand() * 0.5);
        const tipX = wx + lean * size;
        const tipY = wy - h;
        const ctrlX = wx + lean * size * 0.4;
        const ctrlY = wy - h * 0.55;
        ctx.strokeStyle = p.line;
        ctx.lineWidth = lw * 2.1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = b === 1 ? p.light : p.accent;
        ctx.lineWidth = lw * 1.1;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }
  function cartoonLeaf(ctx, p, rand, span, x, y, size, lw) {
    wrapped(span, x, y, size + lw, (wx, wy) => {
      const rot = rand() * Math.PI * 2;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size, -size * 0.4, size * 0.7, size * 0.8, 0, size);
      ctx.bezierCurveTo(-size * 0.7, size * 0.8, -size, -size * 0.4, 0, -size);
      ctx.closePath();
      ctx.fillStyle = rand() > 0.5 ? p.light : p.accent;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.strokeStyle = p.line;
      ctx.lineWidth = lw;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.8);
      ctx.lineTo(0, size * 0.8);
      ctx.lineWidth = lw * 0.6;
      ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
  function cartoonFlower(ctx, p, span, x, y, size, lw) {
    wrapped(span, x, y, size + lw, (wx, wy) => {
      ctx.beginPath();
      ctx.arc(wx, wy, size, 0, Math.PI * 2);
      ctx.fillStyle = p.speck;
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = p.line;
      ctx.lineWidth = lw * 0.8;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(wx, wy, size * 0.32, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function shadowSpot(ctx, p, span, x, y, size) {
    wrapped(span, x, y, size, (wx, wy) => {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = p.line;
      ctx.beginPath();
      ctx.ellipse(wx, wy, size, size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function paintHighlands(ctx, p, rand, span, unit) {
    const lw = Math.max(0.4, unit * 0.06);
    flatPatch(ctx, p, rand, span, unit, n(span, 0.3, 2));
    const stones = n(span, 0.4, 1);
    for (let i = 0; i < stones; i++) cartoonStone(ctx, p, span, rand() * span, rand() * span, unit * (0.16 + rand() * 0.18), lw);
    const tufts = n(span, 0.5, 2);
    for (let i = 0; i < tufts; i++) cartoonGrass(ctx, p, rand, span, rand() * span, rand() * span, unit * (0.2 + rand() * 0.16), lw);
  }
  function paintValley(ctx, p, rand, span, unit) {
    const lw = Math.max(0.4, unit * 0.06);
    flatPatch(ctx, p, rand, span, unit, n(span, 0.34, 2));
    const tufts = n(span, 0.85, 3);
    for (let i = 0; i < tufts; i++) cartoonGrass(ctx, p, rand, span, rand() * span, rand() * span, unit * (0.22 + rand() * 0.16), lw);
    const flowers = n(span, 0.28, 1);
    for (let i = 0; i < flowers; i++) cartoonFlower(ctx, p, span, rand() * span, rand() * span, unit * (0.08 + rand() * 0.06), lw);
  }
  function paintJungle(ctx, p, rand, span, unit) {
    const lw = Math.max(0.4, unit * 0.06);
    flatPatch(ctx, p, rand, span, unit, n(span, 0.4, 2));
    const shadows = n(span, 0.34, 1);
    for (let i = 0; i < shadows; i++) shadowSpot(ctx, p, span, rand() * span, rand() * span, unit * (0.35 + rand() * 0.35));
    const leaves = n(span, 0.5, 2);
    for (let i = 0; i < leaves; i++) cartoonLeaf(ctx, p, rand, span, rand() * span, rand() * span, unit * (0.16 + rand() * 0.16), lw);
    const stones = n(span, 0.2, 1);
    for (let i = 0; i < stones; i++) cartoonStone(ctx, p, span, rand() * span, rand() * span, unit * (0.12 + rand() * 0.12), lw);
  }
  function paintParkBase(ctx, p, rand, span, unit) {
    const lw = Math.max(0.4, unit * 0.06);
    flatPatch(ctx, p, rand, span, unit, n(span, 0.3, 2));
    const tufts = n(span, 0.5, 2);
    for (let i = 0; i < tufts; i++) cartoonGrass(ctx, p, rand, span, rand() * span, rand() * span, unit * (0.16 + rand() * 0.12), lw);
  }
  function paintBackdrop(ctx, p, rand, span, unit) {
    flatPatch(ctx, p, rand, span, unit, n(span, 0.22, 1));
  }
  function paletteForSection(sectionIndex, isDark) {
    if (sectionIndex === -2) return mapBackdropPalette(isDark);
    if (sectionIndex < 0) return parkBasePalette(isDark);
    return groundPaletteForSection(sectionIndex, isDark);
  }
  function paintSection(ctx, sectionIndex, p, rand, span, unit) {
    if (sectionIndex === -2) paintBackdrop(ctx, p, rand, span, unit);
    else if (sectionIndex < 0) paintParkBase(ctx, p, rand, span, unit);
    else if (sectionIndex === 0) paintHighlands(ctx, p, rand, span, unit);
    else if (sectionIndex === 2) paintJungle(ctx, p, rand, span, unit);
    else paintValley(ctx, p, rand, span, unit);
  }
  function repeatFactor(unit) {
    return Math.max(2, Math.min(6, Math.round(150 / unit)));
  }
  function buildGroundPatternTile(sectionIndex, isDark, tilePx = PARK_MAP_VIS.groundTilePx) {
    const unit = clampGroundTilePx(tilePx);
    const span = unit * repeatFactor(unit);
    const canvas = document.createElement("canvas");
    canvas.width = span;
    canvas.height = span;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const palette = paletteForSection(sectionIndex, isDark);
    const seed = sectionIndex * 991 + (isDark ? 17 : 0) + unit * 5;
    const rand = seededRand(seed);
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, span, span);
    paintSection(ctx, sectionIndex, palette, rand, span, unit);
    return canvas;
  }
  var GroundPatternCache = class {
    patterns = /* @__PURE__ */ new Map();
    tilePx = PARK_MAP_VIS.groundTilePx;
    getTilePx() {
      return this.tilePx;
    }
    setTilePx(px) {
      const next = clampGroundTilePx(px);
      if (next === this.tilePx) return;
      this.tilePx = next;
      this.clear();
    }
    getPattern(ctx, sectionIndex, isDark) {
      const key = `${sectionIndex}_${isDark ? "d" : "l"}_${this.tilePx}`;
      const cached = this.patterns.get(key);
      if (cached !== void 0) return cached;
      const pattern = ctx.createPattern(buildGroundPatternTile(sectionIndex, isDark, this.tilePx), "repeat");
      this.patterns.set(key, pattern);
      return pattern;
    }
    clear() {
      this.patterns.clear();
    }
  };
  function fillMapRectWithPattern(ctx, x, y, w, h, pattern, mapScale) {
    if (!pattern) return;
    const dens = parkGroundPatternDensity(mapScale);
    ctx.save();
    ctx.scale(1 / dens, 1 / dens);
    ctx.fillStyle = pattern;
    ctx.fillRect(x * dens, y * dens, w * dens, h * dens);
    ctx.restore();
  }
  function paintMacroVariation(ctx, p, minX, minY, maxX, maxY, sectionIndex) {
    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    if (area <= 0) return;
    const seed = Math.floor(minX) * 73856093 ^ Math.floor(minY) * 19349663 ^ (sectionIndex + 5) * 83492791;
    const rand = seededRand(seed >>> 0);
    const blobs = Math.max(4, Math.min(26, Math.round(area / 9e3)));
    const baseR = Math.max(24, Math.min(w, h) * 0.32);
    for (let i = 0; i < blobs; i++) {
      const cx = minX + rand() * w;
      const cy = minY + rand() * h;
      const r = baseR * (0.6 + rand() * 1.1);
      const col = rand() > 0.5 ? p.light : p.accent;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.07 + rand() * 0.07;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * (0.7 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      const cx = minX + rand() * w;
      const cy = minY + rand() * h;
      const r = baseR * (1.2 + rand() * 0.8);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, p.line);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.05 + rand() * 0.05;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function fillPolygonWithGroundTexture(ctx, points, sectionIndex, isDark, tintColor, tintOpacity, cache, mapScale = PARK_MAP_VIS.groundRefZoom) {
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
    paintMacroVariation(ctx, paletteForSection(sectionIndex, isDark), minX, minY, maxX, maxY, sectionIndex);
    if (tintOpacity > 0) {
      ctx.fillStyle = tintColor;
      ctx.globalAlpha = tintOpacity;
      ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // src/app/features/map/utils/draw-simple-tree.ts
  function treePaletteForSection(section, isDark) {
    if (section === 0) {
      return isDark ? { light: "#3E8A52", mid: "#256A3A", dark: "#164A28", highlight: "#7FD08A", stroke: "#08200F", trunk: "#5A3C26", trunkDark: "#3A2616" } : { light: "#5BB562", mid: "#2F7D44", dark: "#1C5530", highlight: "#9FE0A0", stroke: "#0C2A16", trunk: "#7A5236", trunkDark: "#4E3220" };
    }
    if (section === 2) {
      return isDark ? { light: "#3FB055", mid: "#1F7A38", dark: "#125424", highlight: "#7FE889", stroke: "#06220E", trunk: "#5A3A24", trunkDark: "#382414" } : { light: "#5FD46A", mid: "#2E9E48", dark: "#1A6E30", highlight: "#A6F0A0", stroke: "#0A3018", trunk: "#7A4E32", trunkDark: "#4E3020" };
    }
    return isDark ? { light: "#7FCC48", mid: "#4F9628", dark: "#356E1A", highlight: "#C2F074", stroke: "#0E2A0A", trunk: "#6A4628", trunkDark: "#432C18" } : { light: "#A6E85A", mid: "#6FC23A", dark: "#4A8E24", highlight: "#D8F79A", stroke: "#163A10", trunk: "#8A5E3C", trunkDark: "#5A3A22" };
  }
  function seededTreeRand(seed) {
    let s = Math.abs(Math.floor(seed * 9973)) % 2147483646 || 1;
    return () => {
      s = s * 16807 % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  function specular(ctx, x, y, r) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function cartoonRound(ctx, cx, cy, r, colors, lw) {
    ctx.fillStyle = colors.stroke;
    ctx.beginPath();
    ctx.arc(cx, cy, r + lw, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy - r * 0.2, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.arc(cx - r * 0.34, cy - r * 0.38, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    specular(ctx, cx - r * 0.36, cy - r * 0.4, r * 0.22);
  }
  function cartoonConiferTier(ctx, cx, apexY, halfW, height, colors, lw) {
    const baseY = apexY + height;
    ctx.fillStyle = colors.stroke;
    ctx.beginPath();
    ctx.moveTo(cx, apexY - lw * 1.6);
    ctx.lineTo(cx - halfW - lw, baseY + lw);
    ctx.lineTo(cx + halfW + lw, baseY + lw);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.moveTo(cx, apexY);
    ctx.lineTo(cx - halfW, baseY);
    ctx.lineTo(cx + halfW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, apexY);
    ctx.lineTo(cx - halfW, baseY);
    ctx.lineTo(cx + halfW, baseY);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * 0.1, apexY);
    ctx.lineTo(cx - halfW * 1.1, baseY);
    ctx.lineTo(cx + halfW * 0.25, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * 0.18, apexY + height * 0.1);
    ctx.lineTo(cx - halfW * 0.95, baseY);
    ctx.lineTo(cx - halfW * 0.3, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawTrunk(ctx, trunkH, trunkW, colors, lw) {
    const baseW = trunkW * 1.1;
    const topW = trunkW * 0.7;
    const path = (bw, tw) => {
      ctx.beginPath();
      ctx.moveTo(-bw / 2, 0);
      ctx.lineTo(-tw / 2, -trunkH);
      ctx.lineTo(tw / 2, -trunkH);
      ctx.lineTo(bw / 2, 0);
      ctx.closePath();
    };
    ctx.fillStyle = colors.stroke;
    path(baseW + lw * 2, topW + lw * 2);
    ctx.fill();
    ctx.fillStyle = colors.trunk;
    path(baseW, topW);
    ctx.fill();
    ctx.save();
    path(baseW, topW);
    ctx.clip();
    ctx.fillStyle = colors.trunkDark;
    ctx.fillRect(0, -trunkH, baseW, trunkH);
    ctx.restore();
  }
  function drawGroundShadow(ctx, w, isDark) {
    ctx.globalAlpha = isDark ? 0.34 : 0.2;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(0, 1, w * 0.42, w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawConifer(ctx, crownBase, h, w, colors, lw) {
    const tiers = 3;
    for (let i = tiers - 1; i >= 0; i--) {
      const f = i / (tiers - 1);
      const apexY = crownBase - h * (0.92 - f * 0.5);
      const halfW = w * (0.26 + f * 0.26);
      const height = h * (0.3 + f * 0.06);
      cartoonConiferTier(ctx, 0, apexY, halfW, height, colors, lw);
    }
    specular(ctx, -w * 0.06, crownBase - h * 0.82, w * 0.1);
  }
  function drawBroadleaf(ctx, crownBase, h, w, variant, colors, lw) {
    if (variant === 1) {
      cartoonRound(ctx, -w * 0.22, crownBase - h * 0.34, w * 0.34, colors, lw);
      cartoonRound(ctx, w * 0.24, crownBase - h * 0.32, w * 0.32, colors, lw);
    }
    cartoonRound(ctx, 0, crownBase - h * 0.52, w * 0.46, colors, lw);
  }
  function drawJungleCrown(ctx, crownBase, h, w, variant, colors, lw) {
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const vx = i * w * 0.3;
      const vy = crownBase - h * 0.18;
      const vlen = h * (0.18 + (i + 1) % 2 * 0.12);
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = lw * 3.2;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo(vx + w * 0.05, vy + vlen * 0.6, vx - w * 0.03, vy + vlen);
      ctx.stroke();
      ctx.strokeStyle = colors.mid;
      ctx.lineWidth = lw * 1.6;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo(vx + w * 0.05, vy + vlen * 0.6, vx - w * 0.03, vy + vlen);
      ctx.stroke();
    }
    cartoonRound(ctx, -w * 0.34, crownBase - h * 0.3, w * 0.32, colors, lw);
    cartoonRound(ctx, w * 0.36, crownBase - h * 0.3, w * 0.32, colors, lw);
    if (variant !== 0) cartoonRound(ctx, 0, crownBase - h * 0.22, w * 0.3, colors, lw);
    cartoonRound(ctx, 0, crownBase - h * 0.5, w * 0.5, colors, lw);
  }
  function drawSimpleTree(ctx, footX, footY, height, _phase, seed, variant, isDark, section = 1) {
    const colors = treePaletteForSection(section, isDark);
    void seededTreeRand(seed);
    const sectionScale = section === 0 ? 1.12 : section === 2 ? 0.98 : 1;
    const h = Math.max(PARK_MAP_VIS.treeMinWorld, height * sectionScale);
    const w = h * (section === 2 ? 0.96 : section === 0 ? 0.66 : variant === 1 ? 0.86 : 0.74);
    const lw = Math.max(0.6, h * 0.04);
    const trunkH = h * (section === 0 ? 0.3 : 0.26);
    const trunkW = w * (section === 2 ? 0.13 : section === 0 ? 0.1 : 0.12);
    ctx.save();
    ctx.translate(footX, footY);
    drawGroundShadow(ctx, w, isDark);
    drawTrunk(ctx, trunkH, trunkW, colors, lw);
    const crownBase = -trunkH;
    if (section === 0) drawConifer(ctx, crownBase, h, w, colors, lw);
    else if (section === 2) drawJungleCrown(ctx, crownBase, h, w, variant, colors, lw);
    else drawBroadleaf(ctx, crownBase, h, w, variant, colors, lw);
    ctx.restore();
  }

  // src/app/features/map/utils/map-ambient-zone.ts
  function ambientScreenScale(screenScale, sizeMul) {
    return parkAmbientScreenScale(screenScale, sizeMul);
  }

  // src/app/features/map/utils/map-ambient-wind.ts
  var DEFAULT_AMBIENT_WIND = {
    directionDeg: 245,
    strength: 0.45
  };
  function normalizeWindDegrees(deg) {
    const n2 = deg % 360;
    return n2 < 0 ? n2 + 360 : n2;
  }
  function ambientWindVector(wind) {
    const rad = normalizeWindDegrees(wind.directionDeg) * Math.PI / 180;
    const mag = 0.12 + Math.max(0, Math.min(1, wind.strength)) * 0.88;
    return { vx: Math.cos(rad) * mag, vy: Math.sin(rad) * mag };
  }

  // src/app/features/map/utils/map-rain-effect.ts
  var BASE_FALL_DX = 0.38;
  var BASE_FALL_DY = 1;
  var LAYER_ALPHA = [0.42, 0.68, 0.92];
  var LAYER_SPEED = [0.72, 1, 1.28];
  var MapRainEffect = class {
    fallers = [];
    ripples = [];
    intensity = 0.45;
    sizeMul = 1;
    containsPoint = null;
    windPhase = 0;
    fallDx = BASE_FALL_DX;
    fallDy = BASE_FALL_DY;
    setIntensity(value) {
      this.intensity = Math.min(1, Math.max(0, value));
    }
    setSizeMul(value) {
      this.sizeMul = Math.min(2.5, Math.max(0.08, value));
    }
    setContainsPoint(fn) {
      this.containsPoint = fn;
    }
    clear() {
      this.fallers = [];
      this.ripples = [];
      this.windPhase = 0;
    }
    inZone(bx, by) {
      return !this.containsPoint || this.containsPoint(bx, by);
    }
    randomInBounds(bounds, fromTop) {
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      for (let t = 0; t < 28; t++) {
        const bx = bounds.minX + Math.random() * spanX;
        const by = fromTop ? bounds.minY - 10 - Math.random() * spanY * 0.25 : bounds.minY + Math.random() * spanY * 0.95;
        if (this.inZone(bx, by) || !fromTop && this.inZone(bx, bounds.minY + spanY * 0.5)) {
          return { bx, by };
        }
      }
      return { bx: bounds.minX + spanX * 0.5, by: bounds.minY + spanY * 0.35 };
    }
    spawnFaller(bounds, spanX, spanY, fromTop = false) {
      const layer = Math.floor(Math.random() * 3);
      const layerMul = LAYER_SPEED[layer];
      const pos = this.randomInBounds(bounds, fromTop);
      return {
        bx: pos.bx,
        by: pos.by,
        speed: (6 + Math.random() * 12) * layerMul,
        r: (0.5 + Math.random() * 0.9) * (0.75 + layer * 0.22),
        layer,
        streak: 1 + Math.random() * 2.2,
        groundY: bounds.minY + (0.1 + Math.random() * 0.9) * spanY,
        drift: (Math.random() - 0.5) * 0.35
      };
    }
    pickGroundY(bounds, spanY) {
      for (let t = 0; t < 16; t++) {
        const gy = bounds.minY + (0.1 + Math.random() * 0.9) * spanY;
        const gx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        if (this.inZone(gx, gy)) return gy;
      }
      return bounds.minY + spanY * (0.2 + Math.random() * 0.7);
    }
    tick(options, dt = 1) {
      const { bounds, containsPoint } = options;
      if (containsPoint) this.containsPoint = containsPoint;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return;
      const intensity = Math.max(0.2, this.intensity);
      const target = parkParticleTarget(22, 95, intensity);
      while (this.fallers.length < target) {
        this.fallers.push(this.spawnFaller(bounds, spanX, spanY, true));
      }
      while (this.fallers.length > target) this.fallers.pop();
      this.windPhase += 7e-3 * dt;
      const wv = ambientWindVector(options.wind ?? DEFAULT_AMBIENT_WIND);
      const gust = Math.sin(this.windPhase) * 0.14 + Math.sin(this.windPhase * 2.3) * 0.05;
      this.fallDx = BASE_FALL_DX + wv.vx * 0.55;
      this.fallDy = BASE_FALL_DY + wv.vy * 0.35;
      const wind = gust + wv.vx * 0.35;
      const speedMul = 0.55 + intensity * 1.1;
      const fallLen = Math.hypot(this.fallDx, this.fallDy);
      for (const f of this.fallers) {
        const step = f.speed * speedMul * dt;
        f.bx += this.fallDx / fallLen * step + (wind + f.drift) * step * 0.22;
        f.by += this.fallDy / fallLen * step;
        if (!this.inZone(f.bx, f.by)) {
          const next = this.spawnFaller(bounds, spanX, spanY, true);
          Object.assign(f, next);
          continue;
        }
        if (f.by >= f.groundY) {
          if (this.inZone(f.bx, f.groundY)) {
            this.addRipple(f.bx, f.groundY, intensity);
          }
          const next = this.spawnFaller(bounds, spanX, spanY, true);
          f.bx = next.bx;
          f.by = next.by;
          f.groundY = this.pickGroundY(bounds, spanY);
          f.speed = next.speed;
          f.r = next.r;
          f.layer = next.layer;
          f.streak = next.streak;
          f.drift = next.drift;
        }
        if (f.bx > bounds.maxX + 16) f.bx = bounds.minX - 10;
        if (f.bx < bounds.minX - 16) f.bx = bounds.maxX + 10;
      }
      for (const r of this.ripples) r.age += dt;
      this.ripples = this.ripples.filter((r) => r.age < r.duration && this.inZone(r.bx, r.by));
      if (this.ripples.length > 55) this.ripples.splice(0, this.ripples.length - 55);
    }
    addRipple(bx, by, intensity) {
      if (Math.random() > 0.12 + intensity * 0.72) return;
      this.ripples.push({
        bx,
        by,
        age: 0,
        duration: 22 + Math.random() * 28,
        maxR: 5 + Math.random() * 14
      });
      if (Math.random() < 0.18 + intensity * 0.12) {
        this.ripples.push({
          bx: bx + (Math.random() - 0.5) * 6,
          by: by + (Math.random() - 0.5) * 3,
          age: 0.5 + Math.random() * 2,
          duration: 18 + Math.random() * 20,
          maxR: 3 + Math.random() * 9
        });
      }
    }
    draw(ctx, clipPath, toScreen, screenScale = 1) {
      const intensity = Math.max(0.35, this.intensity);
      const sr = ambientScreenScale(screenScale, this.sizeMul);
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      const fallLen = Math.hypot(this.fallDx, this.fallDy);
      const fallAngle = Math.atan2(this.fallDy, this.fallDx);
      for (const r of this.ripples) {
        if (!this.inZone(r.bx, r.by)) continue;
        const t = r.age / r.duration;
        const fade = (1 - t) * intensity;
        const { x, y } = toScreen(r.bx, r.by);
        const radius = r.maxR * sr * (0.1 + t * 1.15);
        ctx.strokeStyle = `rgba(20, 60, 110, ${fade * 0.7})`;
        ctx.lineWidth = Math.max(0.6, 2.8 * sr * (1 - t * 0.5));
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(150, 220, 255, ${fade})`;
        ctx.lineWidth = Math.max(0.4, 1.4 * sr * (1 - t * 0.5));
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const dropAngle = fallAngle + Math.PI / 2;
      for (const f of this.fallers) {
        if (!this.inZone(f.bx, f.by)) continue;
        const head = toScreen(f.bx, f.by);
        const alpha = LAYER_ALPHA[f.layer] * intensity;
        const rw = Math.max(0.5, f.r * sr * 0.85);
        const len = rw * (2.4 + f.streak * 0.5);
        const lw = Math.max(0.4, rw * 0.4);
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(dropAngle);
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.bezierCurveTo(rw, -len * 0.45, rw, rw * 0.6, 0, rw);
        ctx.bezierCurveTo(-rw, rw * 0.6, -rw, -len * 0.45, 0, -len);
        ctx.closePath();
        ctx.fillStyle = `rgba(70, 160, 235, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(15, 45, 90, ${alpha})`;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.fillStyle = `rgba(235, 250, 255, ${alpha * 0.85})`;
        ctx.beginPath();
        ctx.ellipse(-rw * 0.28, -len * 0.1, rw * 0.22, rw * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  };

  // src/app/features/map/utils/map-motes-effect.ts
  var MapMotesEffect = class {
    motes = [];
    intensity = 0.4;
    sizeMul = 1;
    containsPoint = null;
    setIntensity(value) {
      this.intensity = Math.min(1, Math.max(0, value));
    }
    setSizeMul(value) {
      this.sizeMul = Math.min(2.5, Math.max(0.08, value));
    }
    setContainsPoint(fn) {
      this.containsPoint = fn;
    }
    clear() {
      this.motes = [];
    }
    inZone(bx, by) {
      return !this.containsPoint || this.containsPoint(bx, by);
    }
    spawn(bounds, wind = DEFAULT_AMBIENT_WIND) {
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      let bx = bounds.minX + Math.random() * spanX;
      let by = bounds.minY + Math.random() * spanY;
      for (let t = 0; t < 20; t++) {
        bx = bounds.minX + Math.random() * spanX;
        by = bounds.minY + Math.random() * spanY;
        if (this.inZone(bx, by)) break;
      }
      const wv = ambientWindVector(wind);
      return {
        bx,
        by,
        vx: wv.vx * 0.22 + (Math.random() - 0.5) * 0.18,
        vy: wv.vy * 0.18 - 0.12 - Math.random() * 0.25,
        r: 0.28 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() > 0.55
      };
    }
    tick(options, dt = 1) {
      if (options.containsPoint) this.containsPoint = options.containsPoint;
      const wind = options.wind ?? DEFAULT_AMBIENT_WIND;
      const bounds = options.bounds;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return;
      const inten = Math.max(0.15, this.intensity);
      const target = parkParticleTarget(8, 28, inten);
      while (this.motes.length < target) this.motes.push(this.spawn(bounds, wind));
      while (this.motes.length > target) this.motes.pop();
      for (const m of this.motes) {
        m.phase += 0.04 * dt;
        m.bx += m.vx * dt + Math.sin(m.phase) * 0.06 * dt;
        m.by += m.vy * dt;
        if (!this.inZone(m.bx, m.by) || m.by < bounds.minY - 30 || m.by > bounds.maxY + 20) {
          const n2 = this.spawn(bounds, wind);
          Object.assign(m, n2);
          m.by = bounds.maxY + Math.random() * spanY * 0.15;
        }
      }
    }
    draw(ctx, clipPath, toScreen, screenScale = 1) {
      const inten = Math.max(0.2, this.intensity);
      const sr = ambientScreenScale(screenScale, this.sizeMul);
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      for (const m of this.motes) {
        if (!this.inZone(m.bx, m.by)) continue;
        const tw = 0.45 + Math.sin(m.phase) * 0.55;
        const alpha = inten * tw;
        const { x, y } = toScreen(m.bx, m.by);
        const r = Math.max(0.25, m.r * sr * 0.9);
        const haloR = r * (m.warm ? 4.5 : 3);
        const haloA = alpha * (m.warm ? 0.5 : 0.3);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
        if (m.warm) {
          halo.addColorStop(0, `rgba(255, 224, 150, ${haloA})`);
          halo.addColorStop(1, "rgba(255, 210, 120, 0)");
        } else {
          halo.addColorStop(0, `rgba(200, 240, 255, ${haloA})`);
          halo.addColorStop(1, "rgba(190, 230, 255, 0)");
        }
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, haloR, 0, Math.PI * 2);
        ctx.fill();
        const bodyR = r * 1.15;
        ctx.fillStyle = m.warm ? `rgba(255, 206, 70, ${alpha})` : `rgba(150, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, bodyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = m.warm ? `rgba(120, 70, 0, ${alpha})` : `rgba(20, 60, 110, ${alpha})`;
        ctx.lineWidth = Math.max(0.3, bodyR * 0.28);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x - bodyR * 0.15, y - bodyR * 0.15, bodyR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // src/app/features/map/utils/map-leaves-effect.ts
  var SECTION_WIND_BIAS = [
    { vx: -0.08, vy: 0.04 },
    { vx: 0.06, vy: 0.02 },
    { vx: 0.05, vy: 0.1 }
  ];
  var MapLeavesEffect = class {
    particles = [];
    intensity = 0.45;
    sizeMul = 1;
    containsPoint = null;
    sectionAt = null;
    wind = DEFAULT_AMBIENT_WIND;
    setIntensity(value) {
      this.intensity = Math.min(1, Math.max(0, value));
    }
    setSizeMul(value) {
      this.sizeMul = Math.min(2.5, Math.max(0.08, value));
    }
    setContainsPoint(fn) {
      this.containsPoint = fn;
    }
    setSectionAt(fn) {
      this.sectionAt = fn;
    }
    clear() {
      this.particles = [];
    }
    inZone(bx, by) {
      return !this.containsPoint || this.containsPoint(bx, by);
    }
    windAt(bx, by) {
      const wv = ambientWindVector(this.wind);
      const idx = this.sectionAt?.(bx, by) ?? -1;
      const bias = idx >= 0 && idx < SECTION_WIND_BIAS.length ? SECTION_WIND_BIAS[idx] : { vx: 0, vy: 0 };
      return { vx: wv.vx * 0.55 + bias.vx, vy: wv.vy * 0.45 + bias.vy + 0.2 };
    }
    spawn(bounds) {
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      let bx = bounds.minX + Math.random() * spanX;
      let by = bounds.minY - 10 - Math.random() * spanY * 0.2;
      for (let t = 0; t < 20; t++) {
        bx = bounds.minX + Math.random() * spanX;
        by = bounds.minY - 10 - Math.random() * spanY * 0.25;
        if (this.inZone(bx, by)) break;
      }
      const w = this.windAt(bx, by);
      return {
        bx,
        by,
        vx: w.vx + (Math.random() - 0.5) * 0.12,
        vy: w.vy + 0.25 + Math.random() * 0.35,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.08,
        r: 1 + Math.random() * 1.8,
        kind: Math.random() > 0.45 ? "leaf" : "petal",
        hue: Math.random() > 0.5 ? 95 : 28
      };
    }
    tick(options, dt = 1) {
      if (options.containsPoint) this.containsPoint = options.containsPoint;
      if (options.wind) this.wind = options.wind;
      const bounds = options.bounds;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return;
      const inten = Math.max(0.15, this.intensity);
      const target = parkParticleTarget(5, 18, inten);
      while (this.particles.length < target) this.particles.push(this.spawn(bounds));
      while (this.particles.length > target) this.particles.pop();
      for (const p of this.particles) {
        const w = this.windAt(p.bx, p.by);
        p.vx += (w.vx - p.vx) * 0.04 * dt;
        p.vy += (w.vy + 0.3 - p.vy) * 0.03 * dt;
        p.bx += p.vx * dt * 2.2;
        p.by += p.vy * dt * 2.2;
        p.rot += p.spin * dt;
        if (!this.inZone(p.bx, p.by) || p.by > bounds.maxY + 25) {
          Object.assign(p, this.spawn(bounds));
          p.by = bounds.minY - 5 - Math.random() * 30;
        }
      }
    }
    drawSprite(ctx, x, y, r, rot, kind, hue, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const flip = 0.4 + 0.6 * Math.abs(Math.cos(rot * 1.6));
      ctx.scale(flip, 1);
      const lw = Math.max(0.3, r * 0.18);
      if (kind === "petal") {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.6, r, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 78%, 70%, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, 50%, 32%, ${alpha})`;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.fillStyle = `hsla(0, 0%, 100%, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(-r * 0.18, -r * 0.3, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.bezierCurveTo(r * 1.2, -r * 0.1, r * 0.5, -r, 0, -r * 0.4);
        ctx.bezierCurveTo(-r * 0.5, -r, -r * 1.2, -r * 0.1, 0, r);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue}, 60%, 48%, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, 55%, 22%, ${alpha})`;
        ctx.lineWidth = lw;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.lineWidth = lw * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.85);
        ctx.lineTo(0, -r * 0.35);
        ctx.stroke();
        ctx.fillStyle = `hsla(${hue}, 70%, 70%, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.26, r * 0.34, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    draw(ctx, clipPath, toScreen, screenScale = 1) {
      const inten = Math.max(0.2, this.intensity);
      const sr = ambientScreenScale(screenScale, this.sizeMul);
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      for (const p of this.particles) {
        if (!this.inZone(p.bx, p.by)) continue;
        const { x, y } = toScreen(p.bx, p.by);
        const r = Math.max(0.4, p.r * sr);
        this.drawSprite(ctx, x, y, r, p.rot, p.kind, p.hue, inten * 0.85);
      }
      ctx.restore();
    }
  };

  // src/app/features/map/utils/map-fog-effect.ts
  var MapFogEffect = class {
    patches = [];
    intensity = 0.35;
    sizeMul = 1;
    containsPoint = null;
    setIntensity(value) {
      this.intensity = Math.min(1, Math.max(0, value));
    }
    setSizeMul(value) {
      this.sizeMul = Math.min(2.5, Math.max(0.08, value));
    }
    setContainsPoint(fn) {
      this.containsPoint = fn;
    }
    clear() {
      this.patches = [];
    }
    inZone(bx, by) {
      return !this.containsPoint || this.containsPoint(bx, by);
    }
    spawn(bounds, wind = DEFAULT_AMBIENT_WIND) {
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      let bx = bounds.minX + Math.random() * spanX;
      let by = bounds.minY + Math.random() * spanY;
      for (let t = 0; t < 20; t++) {
        bx = bounds.minX + Math.random() * spanX;
        by = bounds.minY + Math.random() * spanY;
        if (this.inZone(bx, by)) break;
      }
      const wv = ambientWindVector(wind);
      return {
        bx,
        by,
        vx: wv.vx * 0.35 + (Math.random() - 0.5) * 0.12,
        vy: wv.vy * 0.28 + (Math.random() - 0.5) * 0.1,
        r: parkPlanSize(18 + Math.random() * 32),
        phase: Math.random() * Math.PI * 2
      };
    }
    tick(options, dt = 1) {
      if (options.containsPoint) this.containsPoint = options.containsPoint;
      const wind = options.wind ?? DEFAULT_AMBIENT_WIND;
      const wv = ambientWindVector(wind);
      const bounds = options.bounds;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return;
      const inten = Math.max(0.15, this.intensity);
      const target = parkParticleTarget(3, 9, inten);
      while (this.patches.length < target) this.patches.push(this.spawn(bounds, wind));
      while (this.patches.length > target) this.patches.pop();
      for (const p of this.patches) {
        p.phase += 0.012 * dt;
        p.vx += (wv.vx * 0.35 - p.vx) * 0.03 * dt;
        p.vy += (wv.vy * 0.28 - p.vy) * 0.03 * dt;
        p.bx += p.vx * dt + Math.sin(p.phase) * 0.08 * dt;
        p.by += p.vy * dt + Math.cos(p.phase * 0.8) * 0.05 * dt;
        if (!this.inZone(p.bx, p.by) || p.bx < bounds.minX - 20 || p.bx > bounds.maxX + 20) {
          const n2 = this.spawn(bounds, wind);
          Object.assign(p, n2);
        }
      }
    }
    draw(ctx, clipPath, toScreen, screenScale = 1) {
      const inten = Math.max(0.2, this.intensity);
      const sr = ambientScreenScale(screenScale, this.sizeMul);
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      for (const p of this.patches) {
        if (!this.inZone(p.bx, p.by)) continue;
        const { x, y } = toScreen(p.bx, p.by);
        const pulse = 0.82 + Math.sin(p.phase) * 0.18;
        const radius = p.r * sr * pulse;
        const puffs = [
          [-0.5, 0.12, 0.52],
          [0.5, 0.12, 0.52],
          [-0.9, 0.22, 0.36],
          [0.9, 0.22, 0.36],
          [0, -0.22, 0.62]
        ];
        const cel = (px, py, pr, a, col) => {
          const cx = x + px * radius;
          const cy = y + py * radius * 0.7;
          const cr = pr * radius;
          const g = ctx.createRadialGradient(cx, cy, cr * 0.7, cx, cy, cr);
          g.addColorStop(0, `rgba(${col}, ${a})`);
          g.addColorStop(0.8, `rgba(${col}, ${a})`);
          g.addColorStop(1, `rgba(${col}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        };
        for (const [px, py, pr] of puffs) cel(px, py, pr, inten * 0.16, "236, 244, 255");
        cel(-0.2, -0.2, 0.42, inten * 0.12, "255, 255, 255");
      }
      ctx.restore();
    }
  };

  // src/app/features/map/utils/map-cloud-shadow-effect.ts
  var MapCloudShadowEffect = class {
    blobs = [];
    intensity = 0.4;
    sizeMul = 1;
    containsPoint = null;
    driftPhase = 0;
    setIntensity(value) {
      this.intensity = Math.min(1, Math.max(0, value));
    }
    setSizeMul(value) {
      this.sizeMul = Math.min(2.5, Math.max(0.08, value));
    }
    setContainsPoint(fn) {
      this.containsPoint = fn;
    }
    clear() {
      this.blobs = [];
      this.driftPhase = 0;
    }
    inZone(bx, by) {
      return !this.containsPoint || this.containsPoint(bx, by);
    }
    spawn(bounds, layer) {
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      let bx = bounds.minX + Math.random() * spanX;
      let by = bounds.minY + Math.random() * spanY;
      for (let t = 0; t < 16; t++) {
        bx = bounds.minX + Math.random() * spanX;
        by = bounds.minY + Math.random() * spanY;
        if (this.inZone(bx, by)) break;
      }
      const baseR = layer === 0 ? parkPlanSize(32 + Math.random() * 48) : parkPlanSize(16 + Math.random() * 26);
      return { bx, by, r: baseR, layer, phase: Math.random() * Math.PI * 2 };
    }
    tick(options, dt = 1) {
      if (options.containsPoint) this.containsPoint = options.containsPoint;
      const bounds = options.bounds;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return;
      const inten = Math.max(0.15, this.intensity);
      const targetFar = Math.floor(2 + inten * 4);
      const targetNear = Math.floor(2 + inten * 5);
      const target = targetFar + targetNear;
      while (this.blobs.length < target) {
        const layer = this.blobs.length % 2;
        this.blobs.push(this.spawn(bounds, layer));
      }
      while (this.blobs.length > target) this.blobs.pop();
      this.driftPhase += 4e-3 * dt;
      const wv = ambientWindVector(options.wind ?? DEFAULT_AMBIENT_WIND);
      const windX = wv.vx * 0.35 + Math.sin(this.driftPhase) * 0.08;
      const windY = wv.vy * 0.28 + Math.cos(this.driftPhase * 0.7) * 0.05;
      for (const b of this.blobs) {
        const parallax = b.layer === 0 ? 0.35 : 0.85;
        b.phase += 0.01 * dt;
        b.bx += (windX + Math.sin(b.phase) * 0.04) * parallax * dt;
        b.by += (windY + Math.cos(b.phase * 0.9) * 0.03) * parallax * dt;
        if (!this.inZone(b.bx, b.by) || b.bx < bounds.minX - 40 || b.bx > bounds.maxX + 40) {
          const n2 = this.spawn(bounds, b.layer);
          Object.assign(b, n2);
        }
      }
    }
    draw(ctx, clipPath, toScreen, screenScale = 1) {
      const inten = Math.max(0.2, this.intensity);
      const sr = ambientScreenScale(screenScale, this.sizeMul);
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      for (const b of this.blobs) {
        if (!this.inZone(b.bx, b.by)) continue;
        const { x, y } = toScreen(b.bx, b.by);
        const pulse = 0.9 + Math.sin(b.phase) * 0.1;
        const radius = b.r * sr * pulse;
        const alpha = inten * (b.layer === 0 ? 0.14 : 0.22);
        const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        g.addColorStop(0, `rgba(25, 35, 55, ${alpha * 0.9})`);
        g.addColorStop(0.55, `rgba(15, 25, 40, ${alpha * 0.55})`);
        g.addColorStop(1, "rgba(10, 18, 30, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.68, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // src/app/features/map/utils/map-lightning-effect.ts
  var MapLightningEffect = class {
    flashAge = 0;
    flashDuration = 0;
    cooldown = 90;
    enabled = false;
    rainIntensity = 0;
    /** Rayo principal + ramas, en coords [0..1] del viewport; null = sin rayo. */
    bolt = null;
    branches = [];
    boltSide = 0.5;
    setEnabled(value) {
      this.enabled = value;
      if (!value) {
        this.flashAge = 0;
        this.flashDuration = 0;
        this.bolt = null;
        this.branches = [];
      }
    }
    setRainIntensity(value) {
      this.rainIntensity = Math.min(1, Math.max(0, value));
    }
    clear() {
      this.flashAge = 0;
      this.flashDuration = 0;
      this.cooldown = 60;
      this.bolt = null;
      this.branches = [];
    }
    /** Genera un rayo quebrado de arriba hacia abajo con 1-2 ramas. */
    generateBolt() {
      this.boltSide = 0.2 + Math.random() * 0.6;
      const segments = 7 + Math.floor(Math.random() * 4);
      const main = [{ x: this.boltSide, y: 0 }];
      let x = this.boltSide;
      const endY = 0.5 + Math.random() * 0.32;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        x += (Math.random() - 0.5) * 0.11;
        x = Math.min(0.95, Math.max(0.05, x));
        main.push({ x, y: t * endY });
      }
      this.bolt = main;
      this.branches = [];
      const branchCount = 1 + Math.floor(Math.random() * 2);
      for (let b = 0; b < branchCount; b++) {
        const startIdx = 2 + Math.floor(Math.random() * (main.length - 3));
        const start = main[startIdx];
        const branch = [{ ...start }];
        let bx = start.x;
        let by = start.y;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const steps = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < steps; i++) {
          bx += dir * (0.03 + Math.random() * 0.06);
          by += 0.04 + Math.random() * 0.07;
          bx = Math.min(0.97, Math.max(0.03, bx));
          branch.push({ x: bx, y: by });
        }
        this.branches.push(branch);
      }
    }
    tick(rainActive, dt = 1) {
      if (this.flashDuration > 0) {
        this.flashAge += dt;
        if (this.flashAge >= this.flashDuration) {
          this.flashAge = 0;
          this.flashDuration = 0;
          this.bolt = null;
          this.branches = [];
          this.cooldown = 70 + Math.random() * 120;
        }
        return;
      }
      if (!this.enabled || !rainActive || this.rainIntensity < 0.7) return;
      this.cooldown -= dt;
      if (this.cooldown > 0) return;
      if (Math.random() > 0.018 + (this.rainIntensity - 0.7) * 0.06) return;
      this.flashDuration = 4 + Math.random() * 6;
      this.flashAge = 0;
      this.cooldown = 80 + Math.random() * 140;
      this.bolt = null;
      this.branches = [];
      if (Math.random() < 0.55) this.generateBolt();
    }
    isFlashing() {
      return this.flashDuration > 0 && this.flashAge < this.flashDuration;
    }
    /** Dispara un destello con rayo de inmediato (previsualización / pruebas). */
    forceFlash(withBolt = true) {
      this.flashDuration = 4 + Math.random() * 6;
      this.flashAge = 0;
      if (withBolt) this.generateBolt();
      else {
        this.bolt = null;
        this.branches = [];
      }
    }
    strokeBolt(ctx, pts, w, h, width, color) {
      if (pts.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
      ctx.stroke();
    }
    draw(ctx, clipPath, viewportW, viewportH) {
      if (!this.isFlashing()) return;
      const t = this.flashAge / this.flashDuration;
      const peak = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      const alpha = peak * 0.42;
      ctx.save();
      if (clipPath) ctx.clip(clipPath);
      ctx.fillStyle = `rgba(255, 250, 215, ${alpha * 0.5})`;
      ctx.fillRect(0, 0, viewportW, viewportH);
      ctx.fillStyle = `rgba(255, 235, 150, ${alpha * 0.3})`;
      ctx.fillRect(0, viewportH * 0.06, viewportW, viewportH * 0.35);
      if (this.bolt) {
        const boltFade = Math.max(0, 1 - t * 1.4);
        if (boltFade > 0.02) {
          const scale = Math.min(viewportW, viewportH) / 320 + 0.6;
          this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 7 * scale, `rgba(10, 10, 20, ${boltFade})`);
          for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 4.5 * scale, `rgba(10, 10, 20, ${boltFade})`);
          this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 4 * scale, `rgba(255, 214, 40, ${boltFade})`);
          for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 2.4 * scale, `rgba(255, 214, 40, ${boltFade})`);
          this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 1.6 * scale, `rgba(255, 255, 240, ${boltFade})`);
          for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 1 * scale, `rgba(255, 255, 240, ${boltFade * 0.9})`);
        }
      }
      ctx.restore();
    }
  };

  // scripts/preview/preview-entry.ts
  var SECTION_LABELS = ["Tierras Altas", "Tierras Medias", "Tierras Bajas"];
  function label(ctx, text, x, y, dark = false) {
    ctx.font = "13px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = dark ? "#ddd" : "#222";
    ctx.fillText(text, x, y);
  }
  function header(ctx, text, x, y) {
    ctx.font = "bold 16px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = "#0a4";
    ctx.fillText(text, x, y);
  }
  function fillWithTile(ctx, section, isDark, x, y, size, tilePx) {
    const tile = buildGroundPatternTile(section, isDark, tilePx);
    const pat = ctx.createPattern(tile, "repeat");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    const scale = 3;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, size / scale, size / scale);
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(x, y, size, size);
  }
  function snapshotEffect(ctx, effect, x, y, size, bg, ticks = 140, lightning = false) {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, size, size);
    const bounds = { minX: 0, maxX: size, minY: 0, maxY: size };
    for (let i = 0; i < ticks; i++) {
      if (lightning) effect.tick(true, 1);
      else effect.tick({ bounds }, 1);
    }
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.translate(x, y);
    const toScreen = (bx, by) => ({ x: bx, y: by });
    if (lightning) effect.draw(ctx, null, size, size);
    else effect.draw(ctx, null, toScreen, 1, true, size, size);
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(x, y, size, size);
  }
  function render(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f4f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cell = 150;
    const gap = 24;
    let y = 40;
    header(ctx, "Texturas del suelo \u2014 tema claro", 30, y);
    y += 16;
    const tiles = [
      [0, "Tierras Altas"],
      [1, "Tierras Medias"],
      [2, "Tierras Bajas"],
      [-1, "Base parque"],
      [-2, "Fondo mapa"]
    ];
    tiles.forEach(([sec, name], i) => {
      const x = 30 + i * (cell + gap);
      fillWithTile(ctx, sec, false, x, y, cell, 14);
      label(ctx, name, x, y + cell + 16);
    });
    y += cell + 40;
    header(ctx, "Texturas del suelo \u2014 tema oscuro", 30, y);
    y += 16;
    tiles.forEach(([sec, name], i) => {
      const x = 30 + i * (cell + gap);
      fillWithTile(ctx, sec, true, x, y, cell, 14);
      label(ctx, name, x, y + cell + 16);
    });
    y += cell + 44;
    header(ctx, "\xC1rboles por ecosistema (siluetas A / B / C)", 30, y);
    y += 24;
    const treeBaseY = y + cell - 10;
    for (let sec = 0; sec < 3; sec++) {
      for (let v = 0; v < 3; v++) {
        const idx = sec * 3 + v;
        const x = 60 + idx * (cell * 0.62);
        drawSimpleTree(ctx, x, treeBaseY, 92, 0, idx * 1.7 + 3, v, false, sec);
      }
      label(ctx, SECTION_LABELS[sec], 60 + sec * 3 * (cell * 0.62) - 4, treeBaseY + 22);
    }
    y += cell + 40;
    header(ctx, "Vista amplia \u2014 de lejos NO debe verse como grilla (baldosa peque\xF1a)", 30, y);
    y += 16;
    const farZones = [
      [0, "Altas"],
      [1, "Medias"],
      [2, "Bajas"]
    ];
    const fw = 360;
    const fh = 132;
    farZones.forEach(([sec, name], i) => {
      const x = 30 + i * (fw + gap);
      const cache = new GroundPatternCache();
      cache.setTilePx(5);
      const poly = [
        { x, y },
        { x: x + fw, y },
        { x: x + fw, y: y + fh },
        { x, y: y + fh }
      ];
      fillPolygonWithGroundTexture(ctx, poly, sec, false, "#000", 0, cache, 1.15);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(x, y, fw, fh);
      label(ctx, name, x, y + fh + 16);
    });
    y += fh + 44;
    header(ctx, "Efectos ambientales (instant\xE1nea)", 30, y);
    y += 16;
    const efx = cell;
    const rain = new MapRainEffect();
    rain.setIntensity(0.85);
    snapshotEffect(ctx, rain, 30, y, efx, "#2a3550");
    label(ctx, "Lluvia", 30, y + efx + 16, true);
    const motes = new MapMotesEffect();
    motes.setIntensity(0.95);
    snapshotEffect(ctx, motes, 30 + (efx + gap), y, efx, "#1a1430");
    label(ctx, "Luci\xE9rnagas", 30 + (efx + gap), y + efx + 16, true);
    const leaves = new MapLeavesEffect();
    leaves.setIntensity(0.85);
    snapshotEffect(ctx, leaves, 30 + 2 * (efx + gap), y, efx, "#6a8a40", 45);
    label(ctx, "Hojas", 30 + 2 * (efx + gap), y + efx + 16, true);
    const fog = new MapFogEffect();
    fog.setIntensity(0.8);
    snapshotEffect(ctx, fog, 30 + 3 * (efx + gap), y, efx, "#5a6a78");
    label(ctx, "Niebla", 30 + 3 * (efx + gap), y + efx + 16, true);
    const cloud = new MapCloudShadowEffect();
    cloud.setIntensity(0.7);
    snapshotEffect(ctx, cloud, 30 + 4 * (efx + gap), y, efx, "#8aa060");
    label(ctx, "Sombras nube", 30 + 4 * (efx + gap), y + efx + 16, true);
    const bolt = new MapLightningEffect();
    bolt.setEnabled(true);
    bolt.setRainIntensity(1);
    bolt.forceFlash(true);
    ctx.save();
    const lx = 30 + 5 * (efx + gap);
    ctx.fillStyle = "#1c2438";
    ctx.fillRect(lx, y, efx, efx);
    ctx.beginPath();
    ctx.rect(lx, y, efx, efx);
    ctx.clip();
    ctx.translate(lx, y);
    bolt.draw(ctx, null, efx, efx);
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(lx, y, efx, efx);
    label(ctx, "Rel\xE1mpago", lx, y + efx + 16, true);
  }
  window.renderPreview = render;
})();
