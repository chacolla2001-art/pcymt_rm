/** Viento ambiental compartido por lluvia, niebla, hojas, árboles, etc. */
export interface AmbientWind {
  /** 0=Este → 90=Sur → 180=Oeste → 270=Norte (hacia donde sopla). */
  directionDeg: number;
  /** 0–1 intensidad del viento. */
  strength: number;
}

export const DEFAULT_AMBIENT_WIND: AmbientWind = {
  directionDeg: 245,
  strength: 0.45,
};

export function normalizeWindDegrees(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** Vector normalizado en plano del mapa (x→este, y→sur). */
export function ambientWindVector(wind: AmbientWind): { vx: number; vy: number } {
  const rad = (normalizeWindDegrees(wind.directionDeg) * Math.PI) / 180;
  const mag = 0.12 + Math.max(0, Math.min(1, wind.strength)) * 0.88;
  return { vx: Math.cos(rad) * mag, vy: Math.sin(rad) * mag };
}

/** Etiquetas de los 8 puntos cardinales. */
export const WIND_DIRECTION_PRESETS: ReadonlyArray<{ label: string; deg: number }> = [
  { label: 'E', deg: 0 },
  { label: 'SE', deg: 45 },
  { label: 'S', deg: 90 },
  { label: 'SO', deg: 135 },
  { label: 'O', deg: 180 },
  { label: 'NO', deg: 225 },
  { label: 'N', deg: 270 },
  { label: 'NE', deg: 315 },
];
