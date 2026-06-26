import {
  buildGroundPatternTile,
  exportGroundStyleSnapshot,
  groundPaletteForSection,
  importGroundStyleSnapshot,
  mapBackdropPalette,
  parkBasePalette,
  resetGroundStyleToDefaults,
} from './draw-ground-texture';
import { PARK_MAP_VIS, parkGroundPatternDensity } from './map-park-visual-scale';

function superTileSpan(unit: number): number {
  const repeat = Math.max(2, Math.min(6, Math.round(150 / unit)));
  return unit * repeat;
}

describe('draw-ground-texture', () => {
  afterEach(() => resetGroundStyleToDefaults());

  it('uses super-tile span (unit × repeat) for zones, park base and backdrop', () => {
    const tile = PARK_MAP_VIS.groundTilePx;
    const span = superTileSpan(tile);
    expect(buildGroundPatternTile(0, true).width).toBe(span);
    expect(buildGroundPatternTile(1, true).height).toBe(span);
    expect(buildGroundPatternTile(2, false).width).toBe(span);
    expect(buildGroundPatternTile(8, true).width).toBe(superTileSpan(8));
    expect(buildGroundPatternTile(-1, false).height).toBe(span);
    expect(buildGroundPatternTile(-2, false).width).toBe(span);
    expect(groundPaletteForSection(0, true).base).not.toBe(groundPaletteForSection(2, true).base);
    expect(parkBasePalette(false).base).not.toBe(groundPaletteForSection(1, false).base);
    expect(mapBackdropPalette(false).base).not.toBe(parkBasePalette(false).base);
  });

  it('persists UI ground style overrides in snapshot', () => {
    const snap = exportGroundStyleSnapshot();
    snap[0].elements[0].density = 0.01;
    importGroundStyleSnapshot(snap);
    expect(exportGroundStyleSnapshot()[0].elements[0].density).toBe(0.01);
    resetGroundStyleToDefaults();
    expect(exportGroundStyleSnapshot()[0].elements[0].density).not.toBe(0.01);
  });

  it('increases ground pattern density proportionally when zooming in', () => {
    expect(parkGroundPatternDensity(1.15)).toBeCloseTo(1, 1);
    expect(parkGroundPatternDensity(2.3)).toBeGreaterThan(parkGroundPatternDensity(1));
    expect(parkGroundPatternDensity(40)).toBeGreaterThan(30);
  });
});
