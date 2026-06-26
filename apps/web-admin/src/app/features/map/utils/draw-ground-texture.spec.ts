import {
  buildGroundPatternTile,
  groundPaletteForSection,
  mapBackdropPalette,
  parkBasePalette,
} from './draw-ground-texture';
import { PARK_MAP_VIS, parkGroundPatternDensity } from './map-park-visual-scale';

describe('draw-ground-texture', () => {
  it('uses one tile size for zones, park base and backdrop', () => {
    const tile = PARK_MAP_VIS.groundTilePx;
    expect(buildGroundPatternTile(0, true).width).toBe(tile);
    expect(buildGroundPatternTile(1, true).height).toBe(tile);
    expect(buildGroundPatternTile(2, false).width).toBe(tile);
    expect(buildGroundPatternTile(8, true).width).toBe(8);
    expect(buildGroundPatternTile(-1, false).height).toBe(tile);
    expect(buildGroundPatternTile(-2, false).width).toBe(tile);
    expect(groundPaletteForSection(0, true).base).not.toBe(groundPaletteForSection(2, true).base);
    expect(parkBasePalette(false).base).not.toBe(groundPaletteForSection(1, false).base);
    expect(mapBackdropPalette(false).base).not.toBe(parkBasePalette(false).base);
  });

  it('increases ground pattern density proportionally when zooming in', () => {
    expect(parkGroundPatternDensity(1.15)).toBeCloseTo(1, 1);
    expect(parkGroundPatternDensity(2.3)).toBeGreaterThan(parkGroundPatternDensity(1));
    expect(parkGroundPatternDensity(40)).toBeGreaterThan(30);
  });
});
