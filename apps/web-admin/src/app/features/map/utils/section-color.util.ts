/** Convierte #RRGGBB a rgba para relleno del polígono en el mapa. */
export function fillColorsFromHex(
  hex: string,
  opacity = 0.12,
  lightOpacity = 0.08,
): { webFill: string; webFillLight: string } {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return {
      webFill: `rgba(120, 120, 120, ${opacity})`,
      webFillLight: `rgba(120, 120, 120, ${lightOpacity})`,
    };
  }
  return {
    webFill: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`,
    webFillLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${lightOpacity})`,
  };
}

/** Extrae alpha 0–1 de un rgba(...) o rgb(...). */
export function parseOpacityFromRgba(rgba: string | undefined): number | null {
  if (!rgba) return null;
  const m = rgba.trim().match(/,\s*([\d.]+)\s*\)\s*$/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

export function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export interface SectionFillOpacitySource {
  chartColor: string;
  fillOpacity?: number;
  fillOpacityLight?: number;
  colors?: { webFill: string; webFillLight: string };
}

/** Opacidades efectivas del relleno del polígono (0 = solo contorno). */
export function resolveSectionFillOpacities(source: SectionFillOpacitySource): {
  dark: number;
  light: number;
} {
  return {
    dark: source.fillOpacity
      ?? parseOpacityFromRgba(source.colors?.webFill)
      ?? 0.12,
    light: source.fillOpacityLight
      ?? parseOpacityFromRgba(source.colors?.webFillLight)
      ?? 0.08,
  };
}

/** Sincroniza colors.webFill* con chartColor y opacidades guardadas. */
export function syncSectionFillColors<T extends SectionFillOpacitySource & {
  colors: { webFill: string; webFillLight: string };
}>(section: T): T {
  const { dark, light } = resolveSectionFillOpacities(section);
  section.fillOpacity = dark;
  section.fillOpacityLight = light;
  section.colors = fillColorsFromHex(section.chartColor, dark, light);
  return section;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}
