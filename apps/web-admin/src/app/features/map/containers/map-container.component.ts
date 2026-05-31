import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { MapControlComponent } from '../components/map-control.component';
import {
  StickerPanelComponent,
  MapControlEvent,
  MapViewInfo
} from '../components/sticker-panel.component';
import { MapLayerConfigPanelComponent } from '../components/map-layer-config-panel.component';
import { TilesetPanelComponent, TilesetConfig, TilesetSelection, TilePaintTool } from '../components/tileset-panel.component';
import { StickerLayerService } from '../services/sticker-layer.service';
import { StickerInstance, StickerLayer } from '../models/sticker.model';
import { MapConfigData } from '../models/map-layer-config.model';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';
import { AuthService } from '../../../core/services/auth.service';

/**
 * MAP FEATURE — Smart Container
 *
 * Coordinates:
 * - StickerPanelComponent   (left sidebar — map info, controls, options, stickers)
 * - MapControlComponent     (canvas map)
 * - MapLayerConfigPanelComponent (top-right save/load button)
 */
@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, MapControlComponent, StickerPanelComponent, MapLayerConfigPanelComponent,
            TilesetPanelComponent],
  template: `
    <div class="container-wrapper">

      <!-- Left sidebar: unified map panel -->
      <app-sticker-panel
        #stickerPanel
        [isDarkTheme]="isDarkTheme"
        [isAdmin]="isAdmin"
        [selectedSticker]="selectedSticker"
        [mapViewInfo]="currentViewInfo"
        [tileEditorActive]="tileEditorMode"
        [coordPickerActive]="coordPickerActive"
        (stickerSelected)="onPaletteStickerSelected($event)"
        (stickerChanged)="onStickerPropertyChanged($event)"
        (stickerRemoved)="onStickerRemoved($event)"
        (editModeChanged)="onEditModeChanged($event)"
        (layersChanged)="onLayersChanged()"
        (mapControlEvent)="onMapControlEvent($event)"
        (panelToggled)="onPanelToggled()">
      </app-sticker-panel>

      <!-- Central canvas area: map + bottom tileset panel -->
      <div class="map-area">
        <app-map-control
          #mapControl
          [stickerEditMode]="stickerEditMode"
          [placingStickerKey]="placingStickerKey"
          [stickerLayers]="stickerLayers"
          [editorMode]="tileEditorMode"
          [tilePaintMode]="tileEditorMode && (!!selectedTileDataUrl || activePaintTool === 'grab' || activePaintTool === 'picker' || activePaintTool === 'eraser' || activePaintTool === 'bucket')"
          [tilePaintDataUrl]="selectedTileDataUrl"
          [tilePaintTool]="activePaintTool"
          [tilePaintMultiTiles]="selectedMultiTiles"
          (anchorClick)="onAnchorMarkerClick($event)"
          (stickerSelectedOnMap)="onStickerSelectedOnMap($event)"
          (stickerPlaced)="onStickerPlaced($event)"
          (stickerDroppedOnMap)="onStickerDroppedOnMap($event)"
          (stickerMoved)="onStickerMoved($event)"
          (viewInfo)="onViewInfo($event)"
          (saveRequest)="onSaveRequest()"
          (loadRequest)="onLoadRequest()"
          (clearRequest)="onClearRequest()"
          (tilePickerPicked)="onTilePickerPicked($event)"
          (tilePaintToolChange)="onTilePaintToolChange($event)">
        </app-map-control>

        <app-tileset-panel *ngIf="tileEditorMode"
          #tilesetPanel
          [isDarkTheme]="isDarkTheme"
          (tileSelected)="onTileSelected($event)"
          (configChanged)="onTilesetConfigChanged($event)"
          (paintToolChanged)="onPaintToolChanged($event)">
        </app-tileset-panel>
      </div>

      <!-- Map config panel: always present (hidden behind canvas overlay) -->
      <app-map-layer-config-panel
        #configPanel
        [isDarkTheme]="isDarkTheme"
        [showToggle]="false"
        (captureStateRequest)="onCaptureStateRequest()"
        (configLoaded)="onConfigLoaded($event)">
      </app-map-layer-config-panel>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 0;
      height: 100%;
      width: 100%;
      display: flex;
      position: relative;
    }
    app-map-control { flex: 1; min-width: 0; }
    .map-area { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; background: var(--bg, #1e1e2e); }
    .map-area app-map-control { flex: 1; min-width: 0; }
    app-sticker-panel { flex-shrink: 0; }
    :host-context(.map-fullscreen) .container-wrapper {
      position: fixed; inset: 0; z-index: 9999; background: var(--bg, #1e1e2e);
    }
  `]
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapControl') mapControl!: MapControlComponent;
  @ViewChild('stickerPanel') stickerPanel!: StickerPanelComponent;
  @ViewChild('configPanel') configPanel!: MapLayerConfigPanelComponent;
  @ViewChild('tilesetPanel') tilesetPanel?: TilesetPanelComponent;

  private destroy$ = new Subject<void>();

  stickerEditMode = false;
  placingStickerKey: string | null = null;
  selectedSticker: StickerInstance | null = null;
  stickerLayers: StickerLayer[] = [];
  isDarkTheme = true;
  isAdmin = false;
  tileEditorMode = false;
  coordPickerActive = false;
  isFullscreen = false;

  // ── Tile painting state ────────────────────────────────────
  selectedTileDataUrl: string | null = null;
  selectedMultiTiles: { col: number; row: number; dataUrl: string }[] | undefined = undefined;

  private readonly MAP_STATE_KEY = 'pcymt_map_state_v3';
  private readonly STICKER_STATE_KEY = 'pcymt_sticker_layers_v1';
  private readonly isBrowser: boolean;

  /** Latest map view info from the canvas — passed down to the sticker panel */
  currentViewInfo: MapViewInfo | null = null;

  constructor(
    private router: Router,
    private stickerService: StickerLayerService,
    private themeService: ThemeManagerService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.currentUser?.role === 'admin';

    this.isDarkTheme = this.themeService.isDarkMode();
    this.themeService.themeChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => { this.isDarkTheme = theme === 'dark'; });

    this.stickerService.layers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(layers => {
        this.stickerLayers = layers;
        setTimeout(() => this.mapControl?.refreshStickers(), 0);
      });

  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    if (this.shouldAutoLoadConfig()) {
      // Load global config if local cache is empty (e.g., after clearing browser cache)
      setTimeout(() => this.configPanel?.loadConfig(), 0);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private shouldAutoLoadConfig(): boolean {
    try {
      const mapState = localStorage.getItem(this.MAP_STATE_KEY);
      const stickerState = localStorage.getItem(this.STICKER_STATE_KEY);
      return !mapState && !stickerState;
    } catch {
      // If storage is blocked, fall back to loading from backend
      return true;
    }
  }

  // ── Map view info (from canvas → sticker panel) ────────────

  onViewInfo(info: MapViewInfo): void {
    this.currentViewInfo = info;
  }

  // ── Map control events from sticker panel ─────────────────

  onMapControlEvent(event: MapControlEvent): void {
    if (!this.mapControl) return;
    switch (event.type) {
      case 'zoomIn':       this.mapControl.zoomIn(); break;
      case 'zoomOut':      this.mapControl.zoomOut(); break;
      case 'rotateLeft':   this.mapControl.rotateOnce('left'); break;
      case 'rotateRight':  this.mapControl.rotateOnce('right'); break;
      case 'reset':        this.mapControl.resetView(); break;
      case 'optionChange': this.mapControl.setMapOption(event.option, event.value); break;
      case 'centerMap':    this.mapControl.centerMap(); break;
      case 'toggleCoordPicker': this.mapControl.toggleCoordPicker(); this.coordPickerActive = this.mapControl.coordPickerMode; break;
      case 'saveConfig':   this.onSaveRequest(); break;
      case 'loadConfig':   this.onLoadRequest(); break;
      case 'clearStickers': this.onClearRequest(); break;
      case 'toggleEditorMode': this.toggleEditorMode(); break;
      case 'canvasGridCellSize': this.mapControl.setCanvasGridCellSize(event.cellW, event.cellH); break;
      case 'canvasGridOpacity':  this.mapControl.setCanvasGridOpacity(event.value); break;
      case 'canvasGridColor':    this.mapControl.setCanvasGridColor(event.value); break;
      case 'canvasGridStyle':    this.mapControl.setCanvasGridStyle(event.value); break;
      case 'canvasGridRotation': this.mapControl.setCanvasGridRotation(event.value); break;
      case 'clearPaintedTiles':  this.mapControl.clearPaintedTiles(); break;
      case 'toggleFullscreen':   this.toggleFullscreen(); break;
      case 'markerSize':         this.mapControl.markerRadius = event.value; this.mapControl.resize(); break;
      case 'selectMovableLayer':  this.mapControl.setActiveMovableLayer(event.layer); break;
      case 'loadTileset':        this.onLoadTilesetFromPanel(event.tileset); break;
      case 'refImage':           this.mapControl.setRefImage(event.dataUrl); break;
      case 'refImageOpacity':    this.mapControl.setRefImageOpacity(event.value); break;
    }
  }

  // ── Sticker panel events ───────────────────────────────────

  onEditModeChanged(enabled: boolean): void {
    this.stickerEditMode = enabled;
    if (!enabled) {
      this.placingStickerKey = null;
      this.selectedSticker = null;
    }
  }

  onPaletteStickerSelected(key: string): void {
    this.placingStickerKey = key || null;
    this.selectedSticker = null;
    if (key) this.stickerService.loadImage(key).catch(() => {});
  }

  onStickerPropertyChanged(updated: StickerInstance): void {
    this.selectedSticker = updated;
    this.mapControl?.updateSelectedSticker(updated);
  }

  onStickerRemoved(_id: string): void {
    this.mapControl?.removeSelectedSticker();
    this.selectedSticker = null;
  }

  onLayersChanged(): void {
    this.mapControl?.refreshStickers();
  }

  onPanelToggled(): void {
    requestAnimationFrame(() => this.mapControl?.resize?.());
  }

  // ── Map control events ─────────────────────────────────────

  onAnchorMarkerClick(anchorId: string): void {
    this.router.navigate(['/anchor-points'], {
      queryParams: { filterId: anchorId }
    });
  }

  onStickerSelectedOnMap(sticker: StickerInstance | null): void {
    this.selectedSticker = sticker;
    if (sticker) {
      this.placingStickerKey = null;
      this.stickerPanel?.clearPaletteSelection();
    }
  }

  onStickerPlaced(geo: { lat: number; lng: number }): void {
    if (!this.placingStickerKey) return;
    const activeLayer = this.stickerService.getActiveLayer();
    if (!activeLayer) return;
    this.stickerService.addSticker(activeLayer.id, this.placingStickerKey, geo.lat, geo.lng);
    setTimeout(() => this.mapControl?.refreshStickers(), 0);
  }

  onStickerDroppedOnMap(event: { key: string; lat: number; lng: number }): void {
    const activeLayer = this.stickerService.getActiveLayer();
    if (!activeLayer) return;

    if (!this.stickerEditMode) {
      this.stickerEditMode = true;
      this.stickerService.setEditMode(true);
    }

    this.stickerPanel?.clearPaletteSelection();

    this.stickerService.loadImage(event.key)
      .catch(() => {})
      .finally(() => {
        this.stickerService.addSticker(activeLayer.id, event.key, event.lat, event.lng);
        setTimeout(() => this.mapControl?.refreshStickers(), 0);
      });
  }

  onStickerMoved(sticker: StickerInstance): void {
    this.selectedSticker = sticker;
  }

  // ── Tile editor mode toggle & events ─────────────────────

  toggleEditorMode(): void {
    this.tileEditorMode = !this.tileEditorMode;
    if (!this.tileEditorMode) {
      this.selectedTileDataUrl = null;
    }
    // Resize canvas after tileset panel appears/disappears (#9)
    setTimeout(() => this.mapControl?.resize?.(), 60);
  }

  onTileSelected(selection: TilesetSelection): void {
    this.selectedTileDataUrl = selection.tileDataUrl;
    this.selectedMultiTiles = selection.tiles && selection.tiles.length > 1 ? selection.tiles : undefined;
  }

  onTilePickerPicked(url: string): void {
    // Eyedropper: find the tile in the tileset and highlight it
    this.selectedTileDataUrl = url;
    this.selectedMultiTiles = undefined;
    this.tilesetPanel?.highlightPickerOrigin(0, 0);
  }

  onTilePaintToolChange(tool: string): void {
    this.activePaintTool = tool as TilePaintTool;
    this.tilesetPanel?.setActiveTool(tool as TilePaintTool);
  }

  onTilesetConfigChanged(_config: TilesetConfig): void {
    // Reserved for future tileset config updates
  }

  activePaintTool: TilePaintTool = 'paint';

  onPaintToolChanged(tool: TilePaintTool): void {
    this.activePaintTool = tool;
  }

  /** Load a tileset from sticker-panel into the tileset-panel */
  onLoadTilesetFromPanel(tileset: { name: string; imageUrl: string; config: TilesetConfig }): void {
    if (!this.tileEditorMode) {
      this.tileEditorMode = true;
    }
    // Wait for tileset panel to be created via *ngIf, then load tileset
    setTimeout(() => {
      this.tilesetPanel?.loadTilesetFromUrl(tileset.imageUrl, tileset.name, tileset.config);
      this.mapControl?.resize?.();
    }, 100);
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    document.body.classList.toggle('map-fullscreen', this.isFullscreen);
    // Let the canvas recalculate after layout shift
    setTimeout(() => this.mapControl?.resize?.(), 60);
  }

  // ── Map config panel events ────────────────────────────────

  onSaveRequest(): void {
    this.configPanel?.saveConfig();
  }

  onLoadRequest(): void {
    this.configPanel?.loadConfig();
  }

  onClearRequest(): void {
    const activeLayer = this.stickerService.getActiveLayer();
    if (activeLayer) {
      this.stickerService.clearAllStickers(activeLayer.id);
    }
    this.selectedSticker = null;
    this.placingStickerKey = null;
    setTimeout(() => this.mapControl?.refreshStickers(), 0);
  }

  onCaptureStateRequest(): void {
    const mapState = this.mapControl?.getMapViewState() ?? {
      scale: 1.2,
      rotation: -52 * Math.PI / 180,
      offsetX: 0, offsetY: 0,
      showSections: true, showLabels: true
    };

    const activeLayer = this.stickerService.getActiveLayer();
    const stickerLayers = activeLayer ? [{
      id: activeLayer.id,
      name: activeLayer.name,
      visible: activeLayer.visible,
      stickers: activeLayer.stickers.map(s => ({
        stickerKey: s.stickerKey, lat: s.lat, lng: s.lng,
        scale: s.scale, rotation: s.rotation, opacity: s.opacity
      }))
    }] : [];

    const configData: MapConfigData = { mapState, stickerLayers };

    this.configPanel?.receiveState(configData);
  }

  onConfigLoaded(configData: MapConfigData): void {
    if (configData.mapState) {
      this.mapControl?.setMapViewState(configData.mapState);
    }

    if (configData.stickerLayers?.length > 0) {
      const activeLayer = this.stickerService.getActiveLayer();
      if (activeLayer) {
        this.stickerService.clearAllStickers(activeLayer.id);
        for (const layerData of configData.stickerLayers) {
          for (const s of layerData.stickers) {
            const instance = this.stickerService.addSticker(
              activeLayer.id, s.stickerKey, s.lat, s.lng
            );
            this.stickerService.updateSticker(activeLayer.id, {
              ...instance, scale: s.scale, rotation: s.rotation, opacity: s.opacity
            });
          }
        }
      }
      setTimeout(() => this.mapControl?.refreshStickers(), 0);
    }
  }
}
