import {
  DEFAULT_ECOTONE_BRIDGE,
  exportGroundStyleSnapshot,
  fillPolygonWithGroundTexture,
  getGroundStyleOverride,
  GroundPatternCache,
  GROUND_BASE_PARK_SECTION,
  GROUND_MAP_BACKDROP_SECTION,
  groundPaletteForSection,
  importGroundStyleSnapshot,
  mapBackdropPalette,
  migrateGroundStyleMapFromV2,
  parkBasePalette,
  parseGroundLayerSelectValue,
  groundLayerSelectValueForTarget,
  resetGroundStyleToDefaults,
  clearAllGroundLayers,
  applyGroundStyleToLayerKeys,
  updateGroundStyleZone,
  paintSectionGroundElements,
  GROUND_ELEMENT_TYPES,
  GROUND_ELEMENT_LABELS,
  GROUND_PARK_LAYER_KEYS,
} from './draw-ground-texture';

describe('draw-ground-texture', () => {
  afterEach(() => resetGroundStyleToDefaults());

  it('keeps distinct base palettes per zone, park base and backdrop', () => {
    expect(groundPaletteForSection(0, true).base).not.toBe(groundPaletteForSection(2, true).base);
    expect(parkBasePalette(false).base).not.toBe(groundPaletteForSection(1, false).base);
    expect(mapBackdropPalette(false).base).not.toBe(parkBasePalette(false).base);
  });

  it('draws ground elements as vectors (no raster pattern) without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const poly = [
      { x: 10, y: 10 }, { x: 180, y: 12 }, { x: 175, y: 175 }, { x: 12, y: 170 },
    ];
    expect(() =>
      fillPolygonWithGroundTexture(ctx, poly, 1, false, '#7DBE3F', 0.05, new GroundPatternCache(), 1.15),
    ).not.toThrow();
    // Algo se pintó (no quedó transparente).
    const data = ctx.getImageData(90, 90, 1, 1).data;
    expect(data[3]).toBeGreaterThan(0);
  });

  it('persists UI ground style overrides in snapshot', () => {
    const snap = exportGroundStyleSnapshot();
    snap[0].elements[0].density = 0.01;
    importGroundStyleSnapshot(snap);
    expect(exportGroundStyleSnapshot()[0].elements[0].density).toBe(0.01);
    resetGroundStyleToDefaults();
    expect(exportGroundStyleSnapshot()[0].elements[0].density).not.toBe(0.01);
  });

  it('persists edge-blend (ecotono) settings across snapshot round-trip', () => {
    const snap = exportGroundStyleSnapshot();
    snap[0].edgeBlend = 40;
    snap[0].edgeBlendAlpha = 0.5;
    importGroundStyleSnapshot(snap);
    const out = exportGroundStyleSnapshot();
    expect(out[0].edgeBlend).toBe(40);
    expect(out[0].edgeBlendAlpha).toBe(0.5);
  });

  it('exposes a label for every ground element type', () => {
    for (const type of GROUND_ELEMENT_TYPES) {
      expect(GROUND_ELEMENT_LABELS[type]).toBeTruthy();
    }
    // nuevas texturas presentes
    expect(GROUND_ELEMENT_TYPES).toContain('crack');
    expect(GROUND_ELEMENT_TYPES).toContain('bush');
    expect(GROUND_ELEMENT_TYPES).toContain('reed');
  });

  it('ships empty ecotone bridge presets by default', () => {
    expect(DEFAULT_ECOTONE_BRIDGE[0].elements.length).toBe(0);
    expect(DEFAULT_ECOTONE_BRIDGE[1].basePatternMix).toBe(0);
  });

  it('clearAllGroundLayers empties every floor layer', () => {
    const snap = exportGroundStyleSnapshot();
    snap[0].elements.push({ type: 'stone', density: 0.5, min: 1, sizeMin: 0.1, sizeMax: 0.2 });
    importGroundStyleSnapshot(snap);
    clearAllGroundLayers();
    const out = exportGroundStyleSnapshot();
    for (const k of [0, 1, 2, -1, -2]) {
      expect(out[k].elements.length).toBe(0);
      expect(out[k].macroDensity).toBe(0);
    }
  });

  it('applyGroundStyleToLayerKeys syncs base parque (-1) with park zones', () => {
    const style = {
      elements: [{ type: 'grass' as const, density: 0.42, sizeMin: 0.15, sizeMax: 0.35 }],
      macroDensity: 0.3,
      macroAlpha: 0.4,
      edgeBlend: 8,
      edgeBlendAlpha: 0.7,
    };
    applyGroundStyleToLayerKeys(GROUND_PARK_LAYER_KEYS, style);
    const out = exportGroundStyleSnapshot();
    for (const k of GROUND_PARK_LAYER_KEYS) {
      expect(out[k].elements[0]?.type).toBe('grass');
      expect(out[k].elements[0]?.density).toBe(0.42);
    }
  });

  it('applyGroundStyleToLayerKeys backfills -1 when only zones 0/1/2 are passed', () => {
    const style = {
      elements: [{ type: 'stone' as const, density: 0.33, sizeMin: 0.1, sizeMax: 0.2 }],
      macroDensity: 0.5,
      macroAlpha: 0.6,
      edgeBlend: 4,
      edgeBlendAlpha: 0.8,
    };
    applyGroundStyleToLayerKeys([0, 1, 2], style);
    const out = exportGroundStyleSnapshot();
    expect(out[-1].elements[0]?.type).toBe('stone');
    expect(out[-1].elements[0]?.density).toBe(0.33);
  });

  it('getGroundStyleOverride backfills -1 from matching park zones', () => {
    const style = {
      elements: [{ type: 'reed' as const, density: 0.25, sizeMin: 0.12, sizeMax: 0.28 }],
      macroDensity: 0.4,
      macroAlpha: 0.5,
      edgeBlend: 6,
      edgeBlendAlpha: 0.75,
    };
    updateGroundStyleZone(0, style);
    updateGroundStyleZone(1, style);
    updateGroundStyleZone(2, style);
    const o = getGroundStyleOverride();
    expect(o?.[-1]?.elements[0]?.type).toBe('reed');
  });

  it('paintSectionGroundElements draws base (-1) when override has elements', () => {
    const style = {
      elements: [{ type: 'stone' as const, density: 0.8, sizeMin: 0.2, sizeMax: 0.5 }],
      macroDensity: 0,
      macroAlpha: 0,
      edgeBlend: 0,
      edgeBlendAlpha: 0,
    };
    updateGroundStyleZone(-1, style);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 200, 200);
    paintSectionGroundElements(
      ctx,
      -1,
      false,
      { minX: 0, minY: 0, maxX: 200, maxY: 200 },
      1.15,
    );
    const data = ctx.getImageData(100, 100, 1, 1).data;
    expect(data[0] + data[1] + data[2]).toBeGreaterThan(0);
  });

  it('migrateGroundStyleMapFromV2 swaps -1 fondo and -2 base to v3 encoding', () => {
    const fondoStyle = {
      elements: [{ type: 'stone' as const, density: 0.5, sizeMin: 0.1, sizeMax: 0.2 }],
      macroDensity: 0, macroAlpha: 0, edgeBlend: 0, edgeBlendAlpha: 0,
    };
    const baseStyle = {
      elements: [{ type: 'grass' as const, density: 0.3, sizeMin: 0.15, sizeMax: 0.35 }],
      macroDensity: 0, macroAlpha: 0, edgeBlend: 0, edgeBlendAlpha: 0,
    };
    const migrated = migrateGroundStyleMapFromV2({ [-1]: fondoStyle, [-2]: baseStyle });
    expect(migrated[GROUND_MAP_BACKDROP_SECTION].elements[0]?.type).toBe('stone');
    expect(migrated[GROUND_BASE_PARK_SECTION].elements[0]?.type).toBe('grass');
  });

  it('importGroundStyleSnapshot migrates v2 layer keys when config version < 3', () => {
    const style = {
      elements: [{ type: 'reed' as const, density: 0.25, sizeMin: 0.1, sizeMax: 0.2 }],
      macroDensity: 0, macroAlpha: 0, edgeBlend: 0, edgeBlendAlpha: 0,
    };
    importGroundStyleSnapshot({ '-1': style }, { configVersion: 2 });
    const out = exportGroundStyleSnapshot();
    expect(out[GROUND_MAP_BACKDROP_SECTION].elements[0]?.type).toBe('reed');
    expect(out[GROUND_BASE_PARK_SECTION].elements[0]?.type).not.toBe('reed');
    resetGroundStyleToDefaults();
  });

  it('parseGroundLayerSelectValue maps base_park and map_backdrop to correct sections', () => {
    expect(parseGroundLayerSelectValue('base_park')).toBe(GROUND_BASE_PARK_SECTION);
    expect(parseGroundLayerSelectValue('map_backdrop')).toBe(GROUND_MAP_BACKDROP_SECTION);
    expect(groundLayerSelectValueForTarget(GROUND_BASE_PARK_SECTION)).toBe('base_park');
    expect(groundLayerSelectValueForTarget(GROUND_MAP_BACKDROP_SECTION)).toBe('map_backdrop');
  });

  it('importGroundStyleSnapshot normalizes string keys and backfills -1 from zones', () => {
    const style = {
      elements: [{ type: 'stone' as const, density: 0.2, sizeMin: 0.1, sizeMax: 0.2 }],
      macroDensity: 0,
      macroAlpha: 0,
      edgeBlend: 0,
      edgeBlendAlpha: 0,
    };
    importGroundStyleSnapshot({
      '0': style,
      '1': style,
      '2': style,
    });
    const out = exportGroundStyleSnapshot();
    expect(out[-1].elements[0]?.type).toBe('stone');
  });
});
