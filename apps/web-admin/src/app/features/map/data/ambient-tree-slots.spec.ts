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
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 },
  ];
  const sections = [
    { name: 'A', polygon: [{ lat: 1, lng: 1 }, { lat: 1, lng: 4 }, { lat: 4, lng: 4 }, { lat: 4, lng: 1 }] },
  ];

  it('resolveTreePlacementSection picks zone or base (-1) inside park', () => {
    expect(resolveTreePlacementSection({ lat: 2, lng: 2 }, sections, boundary)).toBe(0);
    expect(resolveTreePlacementSection({ lat: 8, lng: 8 }, sections, boundary)).toBe(TREE_BASE_PARK_SECTION);
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

  it('base (-1) is inside contour; fondo (-2) is the outer frame', () => {
    const inside = { lat: 8, lng: 8 };
    const frame = { lat: 9.5, lng: 9.5 };
    expect(canPlaceTreeOnBaseParkLayer(inside, boundary)).toBeTrue();
    expect(canPlaceTreeOnBaseParkLayer(frame, boundary)).toBeFalse();
    expect(canPlaceTreeOnBackdropLayer(frame, boundary)).toBeTrue();
    expect(canPlaceTreeOnBackdropLayer(inside, boundary)).toBeFalse();
  });

  it('park mode accepts frame as fondo (-2), not base', () => {
    const frame = { lat: 9.5, lng: 9.5 };
    expect(canPlaceTreeInParkMode(frame, sections, boundary)).toBeTrue();
    expect(resolveTreePlacementForParkMode(frame, sections, boundary)).toBe(TREE_BACKDROP_SECTION);
  });

  it('migrates v2 section encoding to ground-aligned v3', () => {
    expect(migrateTreeSectionFromV2(-1)).toBe(TREE_BACKDROP_SECTION);
    expect(migrateTreeSectionFromV2(-2)).toBe(TREE_BASE_PARK_SECTION);
    expect(migrateTreeSectionFromV2(1)).toBe(1);
  });
});
