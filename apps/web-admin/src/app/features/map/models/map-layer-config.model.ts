import type { ParkSectionRecord } from '../data/park-geometry';
import type { SpatialReference } from '../data/spatial-reference';
import type { AmbientTreeSlot } from '../data/ambient-tree-slots';

/**
 * Map Layer Configuration — Data Models
 *
 * Allows users to save/load/share map configurations
 * including map view state, sections, ambient scene, and trees.
 * Frontend configs use platform='web'.
 */

export const MAP_CONFIG_VERSION = 3;

/** A saved map configuration from the backend */
export interface MapLayerConfig {
  id: string;
  userId: string;
  name: string;
  description: string;
  platform: 'web' | 'mobile';
  configData: MapConfigData;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** The actual configuration payload */
export interface MapConfigData {
  version?: number;
  mapState: MapViewState;
  /** v2 — offsets per movable layer */
  layerOffsets?: LayerOffsetsData;
  activeMovableLayer?: 'canvas' | 'boundary' | 'sections' | 'markers';
  sections?: ParkSectionRecord[];
  spatialReferences?: SpatialReference[];
  ambientScene?: AmbientSceneData;
  ambientTrees?: AmbientTreeSlot[];
  themeMode?: 'light' | 'dark';
}

export interface LayerOffsetsData {
  boundary: { x: number; y: number };
  sections: { x: number; y: number };
  markers: { x: number; y: number };
}

export interface AmbientSceneData {
  activeScenarioId: string | null;
  showSpatialReferences: boolean;
  showRainEffect: boolean;
  rainIntensity: number;
  rainSize: number;
  rainSectionIndex: number;
  showFogEffect: boolean;
  fogIntensity: number;
  fogSize: number;
  showMotesEffect: boolean;
  motesIntensity: number;
  motesSize: number;
  showCloudShadows: boolean;
  cloudShadowIntensity: number;
  cloudShadowSize: number;
  showLeavesEffect: boolean;
  leavesIntensity: number;
  leavesSize: number;
  showTreesEffect: boolean;
  treesIntensity: number;
  treesSize: number;
  showLightningEffect: boolean;
  showNightMistEffect: boolean;
  nightMistIntensity: number;
  ambientWindDeg: number;
  ambientWindStrength: number;
  /** -1 = heredar viento global. */
  rainWindDeg?: number;
  fogWindDeg?: number;
  motesWindDeg?: number;
  cloudShadowWindDeg?: number;
  leavesWindDeg?: number;
  treesWindDeg?: number;
  spatialAnimSpeed: number;
}

/** Map view state snapshot */
export interface MapViewState {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  showSections: boolean;
  showLabels: boolean;
  showGroundTextures?: boolean;
  groundTilePx?: number;
  showBoundary?: boolean;
  showMarkers?: boolean;
  markerSize?: number;
  lockedBoundary?: boolean;
}

/** DTO from backend (snake_case) */
export interface MapLayerConfigDTO {
  id: string;
  user_id: string;
  name: string;
  description: string;
  platform: 'web' | 'mobile';
  config_data: MapConfigData;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** Create/Update payload */
export interface MapLayerConfigPayload {
  name: string;
  description?: string;
  platform: 'web';
  config_data: MapConfigData;
  is_public?: boolean;
}

/** Convert backend DTO to frontend model */
export const mapToMapLayerConfig = (dto: MapLayerConfigDTO): MapLayerConfig => ({
  id: dto.id,
  userId: dto.user_id,
  name: dto.name,
  description: dto.description || '',
  platform: dto.platform,
  configData: dto.config_data,
  isPublic: dto.is_public,
  createdAt: new Date(dto.created_at),
  updatedAt: new Date(dto.updated_at),
});
