/**
 * Map Tile System — Data Models
 *
 * Defines the tilemap data structures for the pre-rendered
 * tile architecture (frontend editor → backend storage → mobile sync).
 */

/** Manifest describing a published tile version */
export interface TileManifest {
  version: number;
  hash: string;
  createdAt: string;
  createdBy: string;
  bounds: TileBounds;
  tileSize: number;
  zoomLevels: ZoomLevel[];
  totalSize: number;
  overlayVersions: Record<string, string>;
}

export interface TileBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ZoomLevel {
  z: number;
  cols: number;
  rows: number;
  totalTiles: number;
}

/** Overlay data: anchor points for the map */
export interface AnchorsOverlay {
  hash: string;
  updatedAt: string;
  anchors: AnchorOverlayItem[];
}

export interface AnchorOverlayItem {
  id: string;
  lat: number;
  lng: number;
  name: string;
  section: string;
  anchorCode: string | null;
  scale: number;
  rotationY: number;
  assetId: string | null;
  assetIcon: string | null;
  assetModel: string | null;
  assetName: string | null;
}

/** Generic overlay (zones, pois, stickers) */
export interface GenericOverlay {
  hash?: string;
  [key: string]: unknown;
}

/** Result of uploading a tileset or sticker */
export interface UploadResult {
  filename: string;
  url: string;
}

/** A tile export item ready for publishing */
export interface TileExportItem {
  zoomLevel: number;
  x: number;
  y: number;
  blob: Blob;
  filename: string;
}

/** Tilemap editor layer */
export interface TilemapLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  type: 'tile' | 'sticker' | 'zone' | 'route' | 'text';
  data: TilemapLayerData[];
}

/** A single item in a tilemap layer */
export interface TilemapLayerData {
  id: string;
  type: 'tile' | 'sticker' | 'text' | 'path' | 'polygon';
  // Position in GPS coordinates
  lat: number;
  lng: number;
  // Visual properties
  scale: number;
  rotation: number;
  opacity: number;
  // Type-specific
  tilesetKey?: string;     // for tiles
  tileIndex?: number;      // for tiles
  stickerKey?: string;     // for stickers
  text?: string;           // for text
  fontSize?: number;       // for text
  color?: string;          // for text, path, polygon
  points?: { lat: number; lng: number }[];  // for path, polygon
  fillColor?: string;      // for polygon
  strokeWidth?: number;    // for path, polygon
}

/** A tileset image that has been uploaded and sliced */
export interface TilesetDefinition {
  key: string;
  name: string;
  imageUrl: string;
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
}
