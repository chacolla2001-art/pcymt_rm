import {
  baseRingHoleContour,
  contractPolygonInward,
  mapPlateCanvasPoints,
  normalizeMapLayerFrames,
} from './map-layer-geometry';

describe('map-layer-geometry', () => {
  it('mapPlateCanvasPoints_default_isFullCanvas', () => {
    const pts = mapPlateCanvasPoints(100, 80);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('mapPlateCanvasPoints_scale_expandsFromCenter', () => {
    const pts = mapPlateCanvasPoints(100, 100, { x: 0, y: 0, scale: 1.2, rotationDeg: 0 });
    expect(pts[0].x).toBeCloseTo(-10, 5);
    expect(pts[2].x).toBeCloseTo(110, 5);
  });

  it('contractPolygonInward_shrinksHoleForWiderRing', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const inner = contractPolygonInward(square, 2);
    expect(inner[0].x).toBeGreaterThan(0);
    expect(inner[2].x).toBeLessThan(10);
    expect(baseRingHoleContour(square, 2)).toEqual(inner);
  });

  it('normalizeMapLayerFrames_clampsScale', () => {
    const out = normalizeMapLayerFrames({
      mapPlate: { x: 0, y: 0, scale: 9, rotationDeg: 0 },
    });
    expect(out.mapPlate.scale).toBe(3);
  });
});
