import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiRoutesService } from '@core/services/api-routes.service';
import {
  TileManifest,
  AnchorsOverlay,
  GenericOverlay,
  UploadResult,
  TileExportItem,
} from '../models/map-tile.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Service for managing pre-rendered map tiles.
 * Handles publishing tiles, uploading tilesets/stickers,
 * and fetching manifest/overlays with ETag caching.
 */
@Injectable({ providedIn: 'root' })
export class MapTileService {
  private lastManifestETag: string | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService,
  ) {}

  /**
   * Get current tile manifest with ETag support.
   * Returns null if no tiles have been published yet.
   */
  getManifest(): Observable<TileManifest | null> {
    const headers: Record<string, string> = {};
    if (this.lastManifestETag) {
      headers['If-None-Match'] = this.lastManifestETag;
    }

    return this.http.get<ApiResponse<TileManifest | null>>(
      this.apiRoutes.endpoints.mapTiles.manifest,
      { headers, observe: 'response' },
    ).pipe(
      map((response: HttpResponse<ApiResponse<TileManifest | null>>) => {
        const etag = response.headers.get('ETag');
        if (etag) this.lastManifestETag = etag;
        return response.body?.data ?? null;
      }),
      catchError((err) => {
        if (err.status === 304) {
          return of(null); // Not modified, use cached version
        }
        throw err;
      }),
    );
  }

  /**
   * Get a specific overlay (anchors, zones, pois, stickers)
   */
  getOverlay<T = GenericOverlay>(name: string): Observable<T | null> {
    return this.http.get<ApiResponse<T>>(
      this.apiRoutes.endpoints.mapTiles.overlay(name),
    ).pipe(
      map(res => res.data ?? null),
    );
  }

  /**
   * Get anchors overlay specifically
   */
  getAnchorsOverlay(): Observable<AnchorsOverlay | null> {
    return this.getOverlay<AnchorsOverlay>('anchors');
  }

  /**
   * Publish new tile version.
   * Sends tile PNG blobs + overlay JSON data to the backend.
   */
  publish(tiles: TileExportItem[], overlays: Record<string, unknown>): Observable<TileManifest> {
    const formData = new FormData();

    // Add tile files
    for (const tile of tiles) {
      formData.append('tiles', tile.blob, tile.filename);
    }

    // Add overlays as JSON string
    formData.append('overlays', JSON.stringify(overlays));

    return this.http.post<ApiResponse<TileManifest>>(
      this.apiRoutes.endpoints.mapTiles.publish,
      formData,
    ).pipe(
      map(res => res.data),
    );
  }

  /**
   * Upload a custom tileset image (PNG/JPG/SVG)
   */
  uploadTileset(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('tileset', file);

    return this.http.post<ApiResponse<UploadResult>>(
      this.apiRoutes.endpoints.mapTiles.tilesets,
      formData,
    ).pipe(map(res => res.data));
  }

  /**
   * Upload a custom sticker image (PNG/SVG)
   */
  uploadSticker(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('sticker', file);

    return this.http.post<ApiResponse<UploadResult>>(
      this.apiRoutes.endpoints.mapTiles.stickers,
      formData,
    ).pipe(map(res => res.data));
  }

  /**
   * Get the URL for a specific tile (for rendering)
   */
  getTileUrl(z: number, x: number, y: number): string {
    return this.apiRoutes.endpoints.mapTiles.tile(z, x, y);
  }

  /**
   * Get the URL for downloading all tiles at a zoom level as ZIP
   */
  getZoomZipUrl(z: number): string {
    return this.apiRoutes.endpoints.mapTiles.zoomZip(z);
  }

  /**
   * Export canvas to tile PNGs at multiple zoom levels.
   * The canvas param is the full-resolution map canvas.
   * Returns an array of TileExportItems ready for publishing.
   */
  exportCanvasToTiles(
    canvas: HTMLCanvasElement,
    tileSize: number = 512,
    maxZoom: number = 2,
  ): TileExportItem[] {
    const items: TileExportItem[] = [];

    for (let z = 0; z <= maxZoom; z++) {
      const gridSize = Math.pow(2, z);
      const levelWidth = tileSize * gridSize;
      const levelHeight = tileSize * gridSize;

      // Create a scaled version of the canvas for this zoom level
      const levelCanvas = document.createElement('canvas');
      levelCanvas.width = levelWidth;
      levelCanvas.height = levelHeight;
      const ctx = levelCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0, levelWidth, levelHeight);

      // Slice into tiles
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = tileSize;
          tileCanvas.height = tileSize;
          const tileCtx = tileCanvas.getContext('2d')!;

          tileCtx.drawImage(
            levelCanvas,
            x * tileSize, y * tileSize, tileSize, tileSize,
            0, 0, tileSize, tileSize,
          );

          // Convert to blob synchronously via toDataURL + manual conversion
          const dataUrl = tileCanvas.toDataURL('image/png');
          const binary = atob(dataUrl.split(',')[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([array], { type: 'image/png' });

          items.push({
            zoomLevel: z,
            x,
            y,
            blob,
            filename: `z${z}_${x}_${y}.png`,
          });
        }
      }
    }

    return items;
  }
}
