import { GROUND_STYLE, DEFAULT_ECOTONE_BRIDGE } from './draw-ground-texture';
import type { ZoneGroundStyle } from './draw-ground-texture';
import {
  DEFAULT_GROUND_MAP_SETTINGS,
  buildPresetGroundStyles,
  elementVisibleAtLod,
  groundDensityFactor,
  groundLodTier,
  groundQualityFactor,
  groundScaleFactor,
  scaleZoneStyle,
  settingsForPreset,
} from './ground-preset';

const SAMPLE_ZONE: ZoneGroundStyle = {
  elements: [{ type: 'stone', density: 0.2, min: 1, sizeMin: 0.1, sizeMax: 0.3 }],
  macroDensity: 1,
  macroAlpha: 1,
  edgeBlend: 20,
  edgeBlendAlpha: 0.8,
};

const SAMPLE_STYLES: Record<number, ZoneGroundStyle> = {
  0: SAMPLE_ZONE,
  1: { ...SAMPLE_ZONE, elements: [{ type: 'grass', density: 0.5, min: 1, sizeMin: 0.2, sizeMax: 0.4 }] },
};

describe('ground-preset', () => {
  it('factory defaults ship with empty floor layers', () => {
    for (const k of [0, 1, 2, -1, -2]) {
      expect(GROUND_STYLE[k].elements.length).toBe(0);
      expect(GROUND_STYLE[k].macroDensity).toBe(0);
      expect(GROUND_STYLE[k].edgeBlend).toBe(0);
    }
    expect(DEFAULT_ECOTONE_BRIDGE[0].elements.length).toBe(0);
  });

  it('scales zone density and sizes with factor', () => {
    const base = SAMPLE_ZONE;
    const scaled = scaleZoneStyle(base, 1.5);
    expect(scaled.elements[0].density).toBeGreaterThan(base.elements[0].density);
    expect(scaled.edgeBlend).toBeGreaterThan(base.edgeBlend ?? 0);
  });

  it('builds richer preset with higher scale factor', () => {
    const subtle = buildPresetGroundStyles(SAMPLE_STYLES, DEFAULT_ECOTONE_BRIDGE, {
      ...DEFAULT_GROUND_MAP_SETTINGS,
      presetId: 'subtle',
      scalePercent: 100,
    });
    const carbot = buildPresetGroundStyles(SAMPLE_STYLES, DEFAULT_ECOTONE_BRIDGE, {
      ...DEFAULT_GROUND_MAP_SETTINGS,
      presetId: 'carbot',
      scalePercent: 100,
    });
    expect(carbot[0].elements[0].density).toBeGreaterThan(subtle[0].elements[0].density);
  });

  it('hides fine detail at medium LOD tier', () => {
    expect(elementVisibleAtLod('stone', 'medium')).toBeFalse();
    expect(elementVisibleAtLod('grass', 'medium')).toBeTrue();
    expect(elementVisibleAtLod('patch', 'coarse')).toBeTrue();
    expect(elementVisibleAtLod('grass', 'coarse')).toBeFalse();
  });

  it('computes LOD tier from map scale', () => {
    const s = { ...DEFAULT_GROUND_MAP_SETTINGS, lodEnabled: true };
    expect(groundLodTier(2, s)).toBe('all');
    expect(groundLodTier(0.7, s)).toBe('medium');
    expect(groundLodTier(0.4, s)).toBe('coarse');
    expect(groundLodTier(0.2, s)).toBe('minimal');
  });

  it('combines preset recipe and UI scale percent', () => {
    const f = groundScaleFactor({ ...DEFAULT_GROUND_MAP_SETTINGS, presetId: 'rich', scalePercent: 150 });
    expect(f).toBeCloseTo(1.38 * 1.5, 2);
  });

  it('quality reduces texture density without touching icon size', () => {
    const styles = { 0: SAMPLE_ZONE };
    const full = { ...DEFAULT_GROUND_MAP_SETTINGS, qualityPercent: 100 };
    const low = { ...DEFAULT_GROUND_MAP_SETTINGS, qualityPercent: 40 };
    const a = buildPresetGroundStyles(styles, DEFAULT_ECOTONE_BRIDGE, full);
    const b = buildPresetGroundStyles(styles, DEFAULT_ECOTONE_BRIDGE, low);
    expect(b[0].elements[0].density).toBeLessThan(a[0].elements[0].density);
    expect(b[0].elements[0].sizeMax).toBeCloseTo(a[0].elements[0].sizeMax, 5);
  });

  it('density factor folds scale and quality together', () => {
    const s = { ...DEFAULT_GROUND_MAP_SETTINGS, presetId: 'balanced' as const, scalePercent: 100, qualityPercent: 50 };
    expect(groundDensityFactor(s)).toBeCloseTo(groundScaleFactor(s) * groundQualityFactor(s), 5);
  });

  it('performance preset lowers quality and forces LOD on', () => {
    const next = settingsForPreset('performance', { ...DEFAULT_GROUND_MAP_SETTINGS, lodEnabled: false });
    expect(next.qualityPercent).toBeLessThan(DEFAULT_GROUND_MAP_SETTINGS.qualityPercent);
    expect(next.lodEnabled).toBeTrue();
  });
});
