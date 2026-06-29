import type { AmbientWind } from './map-ambient-wind';
import { parkAmbientScreenScale } from './map-park-visual-scale';

/** Escala visual de efectos — calibrada para vista de parque completo. */
export function ambientScreenScale(screenScale: number, sizeMul: number): number {
  return parkAmbientScreenScale(screenScale, sizeMul);
}

export interface MapPlaneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface AmbientTickOptions {
  bounds: MapPlaneBounds;
  containsPoint?: (bx: number, by: number) => boolean;
  wind?: AmbientWind;
}

export type { AmbientWind };
