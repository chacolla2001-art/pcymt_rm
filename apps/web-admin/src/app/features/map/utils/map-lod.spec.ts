import {
  ambientEffectVisibleAtLod,
  DEFAULT_MAP_LOD_CATEGORIES,
  effectiveGroundLodTier,
  getMapLodTier,
  markersVisibleAtLod,
  resolveLodCategories,
  spatialRefsVisibleAtLod,
  treesLayerVisibleAtLod,
} from './map-lod';
import { DEFAULT_GROUND_MAP_SETTINGS } from './ground-preset';

describe('map-lod', () => {
  const base = { ...DEFAULT_GROUND_MAP_SETTINGS, lodEnabled: true };

  it('resolves categories with defaults', () => {
    expect(resolveLodCategories({ ...base, lodCategories: { trees: false } }).trees).toBeFalse();
    expect(resolveLodCategories({ ...base, lodCategories: { trees: false } }).ambient).toBeTrue();
  });

  it('returns all tier when LOD disabled', () => {
    expect(getMapLodTier(0.2, { ...base, lodEnabled: false })).toBe('all');
  });

  it('skips ground LOD when ground category off', () => {
    const s = { ...base, lodCategories: { ...DEFAULT_MAP_LOD_CATEGORIES, ground: false } };
    expect(effectiveGroundLodTier(0.2, s)).toBe('all');
  });

  it('hides fine ambient effects at medium tier', () => {
    const cats = DEFAULT_MAP_LOD_CATEGORIES;
    expect(ambientEffectVisibleAtLod('motes', 'medium', cats)).toBeFalse();
    expect(ambientEffectVisibleAtLod('rain', 'medium', cats)).toBeTrue();
  });

  it('hides zone trees before backdrop at coarse tier', () => {
    const cats = DEFAULT_MAP_LOD_CATEGORIES;
    expect(treesLayerVisibleAtLod('zone', 'coarse', cats)).toBeFalse();
    expect(treesLayerVisibleAtLod('backdrop', 'coarse', cats)).toBeTrue();
  });

  it('hides markers and spatial refs at minimal zoom', () => {
    const cats = DEFAULT_MAP_LOD_CATEGORIES;
    expect(markersVisibleAtLod('minimal', cats)).toBeFalse();
    expect(spatialRefsVisibleAtLod('minimal', cats)).toBeFalse();
  });
});
