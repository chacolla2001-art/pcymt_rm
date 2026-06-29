import {
  groundLodTier,
  type GroundLodTier,
  type GroundMapSettings,
} from './ground-preset';

/** Capas afectadas por LOD al alejar (umbrales de zoom compartidos). */
export interface MapLodCategories {
  ground: boolean;
  ambient: boolean;
  trees: boolean;
  markers: boolean;
  spatialRefs: boolean;
}

export const DEFAULT_MAP_LOD_CATEGORIES: MapLodCategories = {
  ground: true,
  ambient: true,
  trees: true,
  markers: true,
  spatialRefs: true,
};

export type AmbientEffectKind =
  | 'rain'
  | 'fog'
  | 'motes'
  | 'cloudShadows'
  | 'leaves'
  | 'lightning'
  | 'nightMist';

export type TreeLodLayer = 'zone' | 'basePark' | 'backdrop';

export function resolveLodCategories(settings: GroundMapSettings): MapLodCategories {
  return { ...DEFAULT_MAP_LOD_CATEGORIES, ...settings.lodCategories };
}

export function getMapLodTier(mapScale: number, settings: GroundMapSettings): GroundLodTier {
  if (!settings.lodEnabled) return 'all';
  return groundLodTier(mapScale, settings);
}

/** Tier de LOD aplicado al suelo procedural (respeta categoría «ground»). */
export function effectiveGroundLodTier(mapScale: number, settings: GroundMapSettings): GroundLodTier {
  if (!settings.lodEnabled || !resolveLodCategories(settings).ground) return 'all';
  return groundLodTier(mapScale, settings);
}

export function ambientEffectVisibleAtLod(
  kind: AmbientEffectKind,
  tier: GroundLodTier,
  categories: MapLodCategories,
): boolean {
  if (!categories.ambient) return true;
  if (tier === 'all') return true;
  if (tier === 'minimal') return false;
  if (tier === 'coarse') {
    return kind === 'fog' || kind === 'cloudShadows' || kind === 'nightMist';
  }
  return kind !== 'motes' && kind !== 'leaves';
}

export function treesLayerVisibleAtLod(
  layer: TreeLodLayer,
  tier: GroundLodTier,
  categories: MapLodCategories,
): boolean {
  if (!categories.trees) return true;
  if (tier === 'all') return true;
  if (tier === 'minimal') return false;
  if (tier === 'coarse') return layer === 'backdrop';
  if (tier === 'medium') return layer !== 'zone';
  return true;
}

export function markersVisibleAtLod(tier: GroundLodTier, categories: MapLodCategories): boolean {
  if (!categories.markers) return true;
  return tier === 'all' || tier === 'medium';
}

export function markerLabelsVisibleAtLod(tier: GroundLodTier, categories: MapLodCategories): boolean {
  if (!categories.markers) return true;
  return tier === 'all';
}

export function spatialRefsVisibleAtLod(tier: GroundLodTier, categories: MapLodCategories): boolean {
  if (!categories.spatialRefs) return true;
  return tier !== 'minimal';
}

export function sectionLabelsVisibleAtLod(tier: GroundLodTier, categories: MapLodCategories): boolean {
  if (!categories.markers) return true;
  return tier === 'all';
}

/** Multiplicador de opacidad/intensidad para efectos que siguen visibles en tiers intermedios. */
export function ambientLodIntensityMul(tier: GroundLodTier, categories: MapLodCategories): number {
  if (!categories.ambient) return 1;
  switch (tier) {
    case 'all': return 1;
    case 'medium': return 0.82;
    case 'coarse': return 0.55;
    default: return 0;
  }
}
