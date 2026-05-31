/**
 * Map Layer Configuration — Data Models
 *
 * Allows users to save/load/share map configurations
 * including map view state and sticker layers.
 * Frontend configs use platform='web'.
 */

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
  stickerLayers: StickerLayerData[];
  canvasGrid?: CanvasGridConfig;
  paintedTiles?: PaintedTileData[];
  tilesets?: TilesetRefData[];
}

/** Map view state snapshot */
export interface MapViewState {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  showSections: boolean;
  showLabels: boolean;
  showCanvasGrid?: boolean;
  markerSize?: number;
  lockedGrid?: boolean;
  lockedBoundary?: boolean;
}

/** Canvas grid configuration */
export interface CanvasGridConfig {
  cellW: number;
  cellH: number;
  opacity: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
}

/** Serialised painted tile cell */
export interface PaintedTileData {
  col: number;
  row: number;
  url: string;
}

/** Reference to a tileset image used in the editor */
export interface TilesetRefData {
  name: string;
  imageUrl: string;
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
}

/** Serialized sticker layer */
export interface StickerLayerData {
  id: string;
  name: string;
  visible: boolean;
  stickers: StickerInstanceData[];
}

/** Serialized sticker instance */
export interface StickerInstanceData {
  stickerKey: string;
  lat: number;
  lng: number;
  scale: number;
  rotation: number;
  opacity: number;
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
