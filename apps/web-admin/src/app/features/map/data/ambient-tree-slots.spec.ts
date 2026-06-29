import {
  TREE_BACKDROP_SECTION,
  TREE_BASE_PARK_SECTION,
  canPlaceTreeInParkMode,
  canPlaceTreeOnBackdropLayer,
  canPlaceTreeOnBaseParkLayer,
  isTreeInParkLayers,
  migrateTreeSectionFromV2,
  resolveTreePlacementForParkMode,
  resolveTreePlacementSection,
  treeMatchesEditorTarget,
  treeSectionLabel,
} from './ambient-tree-slots';

describe('ambient-tree-slots', () => {
  const boundary = [
    { lat: 2, lng: 2 },
    { lat: 2, lng: 8 },
    { lat: 8, lng: 8 },
    { lat: 8, lng: 2 },
  ];
  /** Plano grande del mapa (más grande que el contorno). */
  const mapPlate = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 },
  ];
  const sections = [
    { name: 'A', polygon: [{ lat: 3, lng: 3 }, { lat: 3, lng: 5 }, { lat: 5, lng: 5 }, { lat: 5, lng: 3 }] },
  ];

  it('resolveTreePlacementSection picks zone inside contour; gaps return null', () => {
    expect(resolveTreePlacementSection({ lat: 4, lng: 4 }, sections, boundary)).toBe(0);
    expect(resolveTreePlacementSection({ lat: 7, lng: 7 }, sections, boundary)).toBeNull();
    expect(resolveTreePlacementSection({ lat: 20, lng: 20 }, sections, boundary)).toBeNull();
  });

  it('tree sections align with ground layers (v3)', () => {
    expect(TREE_BASE_PARK_SECTION).toBe(-1);
    expect(TREE_BACKDROP_SECTION).toBe(-2);
    expect(treeMatchesEditorTarget(1, 'park')).toBeTrue();
    expect(treeMatchesEditorTarget(TREE_BASE_PARK_SECTION, 'park')).toBeTrue();
    expect(treeMatchesEditorTarget(TREE_BACKDROP_SECTION, 'park')).toBeTrue();
    expect(isTreeInParkLayers(TREE_BACKDROP_SECTION)).toBeFalse();
    expect(treeSectionLabel(TREE_BASE_PARK_SECTION)).toBe('Base parque');
    expect(treeSectionLabel(TREE_BACKDROP_SECTION)).toBe('Fondo mapa');
  });

  it('base (-1) is the ring; fondo (-2) is outside the map plate', () => {
    const inside = { lat: 7, lng: 7 };
    const frame = { lat: 1, lng: 5 };
    const outside = { lat: 11, lng: 5 };
    expect(canPlaceTreeOnBaseParkLayer(inside, boundary, mapPlate)).toBeFalse();
    expect(canPlaceTreeOnBaseParkLayer(frame, boundary, mapPlate)).toBeTrue();
    expect(canPlaceTreeOnBackdropLayer(outside, boundary, mapPlate)).toBeTrue();
    expect(canPlaceTreeOnBackdropLayer(frame, boundary, mapPlate)).toBeFalse();
  });

  it('park mode accepts frame as base (-1), not interior gaps', () => {
    const frame = { lat: 1, lng: 5 };
    const gap = { lat: 7, lng: 7 };
    expect(canPlaceTreeInParkMode(frame, sections, boundary, mapPlate)).toBeTrue();
    expect(resolveTreePlacementForParkMode(frame, sections, boundary, mapPlate)).toBe(TREE_BASE_PARK_SECTION);
    expect(canPlaceTreeInParkMode(gap, sections, boundary, mapPlate)).toBeFalse();
  });

  it('migrates v2 section encoding to ground-aligned v3', () => {
    expect(migrateTreeSectionFromV2(-1)).toBe(TREE_BACKDROP_SECTION);
    expect(migrateTreeSectionFromV2(-2)).toBe(TREE_BASE_PARK_SECTION);
    expect(migrateTreeSectionFromV2(1)).toBe(1);
  });
});
