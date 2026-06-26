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
import { MapSessionService } from '../services/map-session.service';
import { StickerInstance, StickerLayer } from '../models/sticker.model';
import { MapConfigData, MAP_CONFIG_VERSION, MapCheckpointSummary } from '../models/map-layer-config.model';
import type { ParkSectionRecord } from '../data/park-geometry';
import type { SpatialReference } from '../data/spatial-reference';
import { findAmbientScenario } from '../data/ambient-scenarios';
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
        [editableSections]="editableSections"
        [sectionEditorActive]="sectionEditorMode"
        [activeSectionIndex]="sectionEditorIndex"
        [selectedVertexIndex]="sectionEditorSelectedVertex"
        [addVertexMode]="sectionEditorAddVertexMode"
        [spatialReferences]="spatialReferences"
        [spatialPlaceIndex]="spatialPlaceIndex"
        [activeSpatialRefIndex]="activeSpatialRefIndex"
        [sceneOpts]="sceneOpts"
        [spatialRefsOpts]="spatialRefsOpts"
        [checkpoints]="checkpoints"
        [sessionSavedAt]="sessionSavedAt"
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
          (tilePaintToolChange)="onTilePaintToolChange($event)"
          (sectionsChanged)="onSectionsChanged($event)"
          (spatialReferencesChanged)="onSpatialReferencesChanged($event)">
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
    .map-area { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; background: var(--sys-surface); }
    .map-area app-map-control { flex: 1; min-width: 0; }
    app-sticker-panel { flex-shrink: 0; }
    :host-context(.map-fullscreen) .container-wrapper {
      position: fixed; inset: 0; z-index: 9999; background: var(--sys-surface);
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

  sectionEditorMode = false;
  sectionEditorIndex = 0;
  sectionEditorSelectedVertex: number | null = null;
  sectionEditorAddVertexMode = false;
  editableSections: ParkSectionRecord[] = [];

  spatialReferences: SpatialReference[] = [];
  spatialPlaceIndex = -1;
  activeSpatialRefIndex = 0;
  sceneOpts = {
    activeScenarioId: null as string | null,
    showRainEffect: false,
    rainIntensityPercent: 45,
    rainSizePercent: 100,
    rainSectionIndex: -1,
    showFogEffect: false,
    fogIntensityPercent: 35,
    fogSizePercent: 100,
    showMotesEffect: false,
    motesIntensityPercent: 40,
    motesSizePercent: 100,
    showCloudShadows: false,
    cloudShadowIntensityPercent: 40,
    cloudShadowSizePercent: 100,
    showLeavesEffect: false,
    leavesIntensityPercent: 45,
    leavesSizePercent: 100,
    showTreesEffect: false,
    treesIntensityPercent: 55,
    treesSizePercent: 100,
    showLightningEffect: false,
    showNightMistEffect: false,
    nightMistIntensityPercent: 35,
    ambientWindDeg: 245,
    ambientWindStrengthPercent: 45,
  };
  spatialRefsOpts = {
    showSpatialReferences: true,
    spatialAnimPercent: 100,
  };

  checkpoints: MapCheckpointSummary[] = [];
  sessionSavedAt: string | null = null;

  // ── Tile painting state ────────────────────────────────────
  selectedTileDataUrl: string | null = null;
  selectedMultiTiles: { col: number; row: number; dataUrl: string }[] | undefined = undefined;

  private readonly isBrowser: boolean;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SESSION_SAVE_DEBOUNCE_MS = 1200;
  private restoringSession = false;

  /** Latest map view info from the canvas — passed down to the sticker panel */
  currentViewInfo: MapViewInfo | null = null;

  constructor(
    private router: Router,
    private stickerService: StickerLayerService,
    private mapSession: MapSessionService,
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
        if (!this.restoringSession) this.scheduleSessionSave();
      });

    this.mapSession.checkpoints$
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => { this.checkpoints = list; });

  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.restoringSession = true;
    const session = this.mapSession.loadSession();
    if (session) {
      this.applyFullState(session, { fromAutoRestore: true });
    } else if (this.shouldAutoLoadConfig()) {
      setTimeout(() => this.configPanel?.loadConfig(), 0);
    }
    this.restoringSession = false;
    this.sessionSavedAt = this.mapSession.lastSavedAt;
    this.syncSceneStateFromMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private shouldAutoLoadConfig(): boolean {
    return !this.mapSession.hasSession();
  }

  private scheduleSessionSave(): void {
    if (!this.isBrowser || this.restoringSession || !this.mapControl) return;
    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => {
      this.sessionSaveTimer = null;
      const data = this.captureFullState();
      if (this.mapSession.saveSession(data)) {
        this.sessionSavedAt = this.mapSession.lastSavedAt;
      }
    }, this.SESSION_SAVE_DEBOUNCE_MS);
  }

  private captureFullState(): MapConfigData {
    const map = this.mapControl.exportMapPersistedState();
    const stickerLayers = this.stickerService.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      stickers: l.stickers.map((s) => ({
        stickerKey: s.stickerKey,
        lat: s.lat,
        lng: s.lng,
        scale: s.scale,
        rotation: s.rotation,
        opacity: s.opacity,
      })),
    }));

    return {
      version: MAP_CONFIG_VERSION,
      mapState: map.mapState,
      stickerLayers,
      activeStickerLayerId: this.stickerService.activeLayerId,
      canvasGrid: {
        cellW: map.mapState.canvasGridCellW ?? 32,
        cellH: map.mapState.canvasGridCellH ?? 32,
        opacity: map.mapState.canvasGridOpacity ?? 0.35,
        color: map.mapState.canvasGridColor || '#ffffff',
        style: map.mapState.canvasGridStyle ?? 'solid',
      },
      paintedTiles: map.paintedTiles,
      layerOffsets: map.layerOffsets,
      activeMovableLayer: map.activeMovableLayer,
      sections: map.sections,
      spatialReferences: map.spatialReferences,
      ambientScene: map.ambientScene,
      refImageDataUrl: map.refImageDataUrl ?? undefined,
      refImageOpacity: map.refImageOpacity,
      themeMode: this.themeService.isDarkMode() ? 'dark' : 'light',
    };
  }

  private applyFullState(configData: MapConfigData, opts?: { fromAutoRestore?: boolean }): void {
    if (!this.mapControl) return;
    this.restoringSession = true;

    if (configData.themeMode) {
      this.themeService.setThemeMode(configData.themeMode);
    }

    const scenarioId = configData.ambientScene?.activeScenarioId;
    if (scenarioId) {
      const scenario = findAmbientScenario(scenarioId);
      if (scenario?.theme) this.themeService.setThemeMode(scenario.theme);
    }

    this.mapControl.applyMapPersistedState({
      mapState: configData.mapState,
      layerOffsets: configData.layerOffsets,
      activeMovableLayer: configData.activeMovableLayer,
      sections: configData.sections,
      spatialReferences: configData.spatialReferences,
      paintedTiles: configData.paintedTiles,
      refImageDataUrl: configData.refImageDataUrl,
      refImageOpacity: configData.refImageOpacity,
      ambientScene: configData.ambientScene,
    }, { skipLegacySave: true });

    if (scenarioId) {
      const scenario = findAmbientScenario(scenarioId);
      if (scenario?.theme) this.themeService.setThemeMode(scenario.theme);
      this.mapControl.applyAmbientScenarioTint(scenarioId);
    }

    if (configData.stickerLayers?.length) {
      const layers: StickerLayer[] = configData.stickerLayers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: 1,
        stickers: l.stickers.map((s) => ({
          id: `${l.id}_${s.stickerKey}_${s.lat}_${s.lng}`,
          stickerKey: s.stickerKey,
          lat: s.lat,
          lng: s.lng,
          scale: s.scale,
          rotation: s.rotation,
          opacity: s.opacity,
        })),
      }));
      this.stickerService.importLayers(layers);
    }

    this.editableSections = this.mapControl.getEditableSections();
    this.syncSceneStateFromMap();
    setTimeout(() => this.mapControl?.refreshStickers(), 0);

    this.restoringSession = false;
    if (!opts?.fromAutoRestore) {
      this.scheduleSessionSave();
    }
  }

  // ── Map view info (from canvas → sticker panel) ────────────

  onViewInfo(info: MapViewInfo): void {
    this.currentViewInfo = info;
    this.scheduleSessionSave();
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
      case 'groundTilePxChange': this.mapControl.setGroundTilePx(event.value); break;
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
      case 'toggleSectionEditor':
        this.sectionEditorMode = !this.sectionEditorMode;
        if (this.sectionEditorMode) {
          this.tileEditorMode = false;
          this.stickerEditMode = false;
          this.stickerService.setEditMode(false);
        }
        this.mapControl.setSectionEditorMode(this.sectionEditorMode);
        break;
      case 'setSectionEditorIndex':
        this.sectionEditorIndex = event.index;
        this.mapControl.setSectionEditorIndex(event.index);
        break;
      case 'setSectionEditorVertex':
        this.sectionEditorSelectedVertex = event.vertexIndex;
        this.mapControl.setSectionEditorSelectedVertex(event.vertexIndex);
        break;
      case 'setSectionEditorAddVertex':
        this.sectionEditorAddVertexMode = event.enabled;
        this.mapControl.setSectionEditorAddVertexMode(event.enabled);
        break;
      case 'updateSectionVertex':
        this.mapControl.updateSectionVertex(event.sectionIndex, event.vertexIndex, event.lat, event.lng);
        break;
      case 'deleteSectionVertex':
        this.mapControl.deleteSectionVertex(event.sectionIndex, event.vertexIndex);
        this.sectionEditorSelectedVertex = null;
        break;
      case 'exportSectionsJson':
        this.mapControl.downloadSectionsJson();
        break;
      case 'resetSections':
        this.mapControl.resetSectionsToDefault();
        this.sectionEditorSelectedVertex = null;
        break;
      case 'updateSectionColor':
        this.mapControl.updateSectionColor(event.sectionIndex, event.hex);
        break;
      case 'updateSectionFillOpacity':
        this.mapControl.updateSectionFillOpacity(event.sectionIndex, event.which, event.opacity);
        break;
      case 'sceneOptionChange':
        this.onManualSceneEdit();
        this.mapControl.setMapSceneOption(event.option, event.value);
        this.syncSceneStateFromMap();
        break;
      case 'spatialRefsOptionChange':
        this.mapControl.setMapSceneOption('showSpatialReferences', event.value);
        this.syncSceneStateFromMap();
        break;
      case 'applyAmbientScenario': {
        const scenario = findAmbientScenario(event.scenarioId);
        if (!scenario) break;
        if (scenario.theme) this.themeService.setThemeMode(scenario.theme);
        this.mapControl.applyAmbientScenario(scenario);
        this.syncSceneStateFromMap();
        this.sceneOpts.activeScenarioId = scenario.id;
        break;
      }
      case 'rainIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setRainIntensity(event.value);
        this.sceneOpts.rainIntensityPercent = Math.round(event.value * 100);
        break;
      case 'rainSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setRainSize(event.value);
        this.sceneOpts.rainSizePercent = Math.round(event.value * 100);
        break;
      case 'fogIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setFogIntensity(event.value);
        this.sceneOpts.fogIntensityPercent = Math.round(event.value * 100);
        break;
      case 'fogSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setFogSize(event.value);
        this.sceneOpts.fogSizePercent = Math.round(event.value * 100);
        break;
      case 'motesIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setMotesIntensity(event.value);
        this.sceneOpts.motesIntensityPercent = Math.round(event.value * 100);
        break;
      case 'motesSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setMotesSize(event.value);
        this.sceneOpts.motesSizePercent = Math.round(event.value * 100);
        break;
      case 'cloudShadowIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setCloudShadowIntensity(event.value);
        this.sceneOpts.cloudShadowIntensityPercent = Math.round(event.value * 100);
        break;
      case 'cloudShadowSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setCloudShadowSize(event.value);
        this.sceneOpts.cloudShadowSizePercent = Math.round(event.value * 100);
        break;
      case 'leavesIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setLeavesIntensity(event.value);
        this.sceneOpts.leavesIntensityPercent = Math.round(event.value * 100);
        break;
      case 'leavesSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setLeavesSize(event.value);
        this.sceneOpts.leavesSizePercent = Math.round(event.value * 100);
        break;
      case 'treesIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setTreesIntensity(event.value);
        this.sceneOpts.treesIntensityPercent = Math.round(event.value * 100);
        break;
      case 'treesSizeChange':
        this.onManualSceneEdit();
        this.mapControl.setTreesSize(event.value);
        this.sceneOpts.treesSizePercent = Math.round(event.value * 100);
        break;
      case 'nightMistIntensityChange':
        this.onManualSceneEdit();
        this.mapControl.setNightMistIntensity(event.value);
        this.sceneOpts.nightMistIntensityPercent = Math.round(event.value * 100);
        break;
      case 'ambientWindDirectionChange':
        this.onManualSceneEdit();
        this.mapControl.setAmbientWindDirection(event.deg);
        this.sceneOpts.ambientWindDeg = event.deg;
        break;
      case 'ambientWindStrengthChange':
        this.onManualSceneEdit();
        this.mapControl.setAmbientWindStrength(event.value);
        this.sceneOpts.ambientWindStrengthPercent = Math.round(event.value * 100);
        break;
      case 'rainSectionChange':
        this.onManualSceneEdit();
        this.mapControl.setRainSectionIndex(event.sectionIndex);
        this.sceneOpts.rainSectionIndex = event.sectionIndex;
        break;
      case 'spatialAnimSpeedChange':
        this.mapControl.setSpatialAnimSpeed(event.value);
        this.spatialRefsOpts.spatialAnimPercent = Math.round(event.value * 100);
        break;
      case 'selectSpatialReferenceIndex':
        this.activeSpatialRefIndex = event.index;
        this.mapControl.setSelectedSpatialReferenceIndex(event.index);
        break;
      case 'updateSpatialReference':
        this.mapControl.updateSpatialReference(event.index, event.patch);
        this.spatialReferences = this.mapControl.getSpatialReferences();
        break;
      case 'setSpatialReferencePlaceIndex':
        this.spatialPlaceIndex = event.index;
        this.mapControl.setSpatialReferencePlaceIndex(event.index);
        break;
      case 'exportSpatialReferencesJson':
        this.mapControl.downloadSpatialReferencesJson();
        break;
      case 'saveCheckpoint':
        this.onSaveCheckpoint(event.label);
        break;
      case 'restoreCheckpoint':
        this.onRestoreCheckpoint(event.id);
        break;
      case 'deleteCheckpoint':
        this.onDeleteCheckpoint(event.id);
        break;
      case 'renameCheckpoint':
        this.onRenameCheckpoint(event.id, event.label);
        break;
    }
    this.scheduleSessionSave();
  }

  onSpatialReferencesChanged(refs: SpatialReference[]): void {
    this.spatialReferences = refs;
    this.scheduleSessionSave();
  }

  private onManualSceneEdit(): void {
    this.mapControl?.clearAmbientScenarioVisuals();
    this.sceneOpts.activeScenarioId = null;
  }

  private syncSceneStateFromMap(): void {
    if (!this.mapControl) return;
    const scene = this.mapControl.getSceneOptions();
    this.sceneOpts = {
      activeScenarioId: this.mapControl.getActiveAmbientScenarioId(),
      showRainEffect: scene.showRainEffect,
      rainIntensityPercent: Math.round(scene.rainIntensity * 100),
      rainSizePercent: Math.round(scene.rainSize * 100),
      rainSectionIndex: scene.rainSectionIndex,
      showFogEffect: scene.showFogEffect,
      fogIntensityPercent: Math.round(scene.fogIntensity * 100),
      fogSizePercent: Math.round(scene.fogSize * 100),
      showMotesEffect: scene.showMotesEffect,
      motesIntensityPercent: Math.round(scene.motesIntensity * 100),
      motesSizePercent: Math.round(scene.motesSize * 100),
      showCloudShadows: scene.showCloudShadows,
      cloudShadowIntensityPercent: Math.round(scene.cloudShadowIntensity * 100),
      cloudShadowSizePercent: Math.round(scene.cloudShadowSize * 100),
      showLeavesEffect: scene.showLeavesEffect,
      leavesIntensityPercent: Math.round(scene.leavesIntensity * 100),
      leavesSizePercent: Math.round(scene.leavesSize * 100),
      showTreesEffect: scene.showTreesEffect,
      treesIntensityPercent: Math.round(scene.treesIntensity * 100),
      treesSizePercent: Math.round(scene.treesSize * 100),
      showLightningEffect: scene.showLightningEffect,
      showNightMistEffect: scene.showNightMistEffect,
      nightMistIntensityPercent: Math.round(scene.nightMistIntensity * 100),
      ambientWindDeg: scene.ambientWindDeg,
      ambientWindStrengthPercent: Math.round(scene.ambientWindStrength * 100),
    };
    this.spatialRefsOpts = {
      showSpatialReferences: scene.showSpatialReferences,
      spatialAnimPercent: Math.round(scene.spatialAnimSpeed * 100),
    };
    this.spatialReferences = this.mapControl.getSpatialReferences();
    this.spatialPlaceIndex = this.mapControl.spatialReferencePlaceIndex;
    this.activeSpatialRefIndex = this.mapControl.selectedSpatialReferenceIndex;
  }

  onSectionsChanged(sections: ParkSectionRecord[]): void {
    this.editableSections = sections;
    this.sectionEditorSelectedVertex = this.mapControl?.sectionEditorSelectedVertex ?? null;
    this.scheduleSessionSave();
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
    this.scheduleSessionSave();
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
    this.configPanel?.receiveState(this.captureFullState());
  }

  onConfigLoaded(configData: MapConfigData): void {
    this.applyFullState(configData);
  }

  onSaveCheckpoint(label?: string): void {
    this.mapSession.saveCheckpoint(this.captureFullState(), label);
  }

  onRestoreCheckpoint(id: string): void {
    const data = this.mapSession.restoreCheckpoint(id);
    if (data) this.applyFullState(data);
  }

  onDeleteCheckpoint(id: string): void {
    this.mapSession.deleteCheckpoint(id);
  }

  onRenameCheckpoint(id: string, label: string): void {
    this.mapSession.renameCheckpoint(id, label);
  }
}
