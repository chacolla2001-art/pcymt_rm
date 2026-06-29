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
import { MapSessionService } from '../services/map-session.service';
import { MapConfigData, MAP_CONFIG_VERSION } from '../models/map-layer-config.model';
import type { ZoneGroundStyle } from '../utils/draw-ground-texture';
import type { GroundMapSettings } from '../utils/ground-preset';
import type { ParkSectionRecord } from '../data/park-geometry';
import type { SpatialReference } from '../data/spatial-reference';
import type { AmbientTreeSlot, TreeEditorTarget } from '../data/ambient-tree-slots';
import { findAmbientScenario } from '../data/ambient-scenarios';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';
import { AuthService } from '../../../core/services/auth.service';

/**
 * MAP FEATURE — Smart Container
 *
 * Coordinates:
 * - StickerPanelComponent   (left sidebar — map info, controls, options)
 * - MapControlComponent     (canvas map)
 * - MapLayerConfigPanelComponent (top-right save/load button)
 */
@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, MapControlComponent, StickerPanelComponent, MapLayerConfigPanelComponent],
  template: `
    <div class="container-wrapper">

      <!-- Left sidebar: unified map panel -->
      <app-sticker-panel
        [isDarkTheme]="isDarkTheme"
        [isAdmin]="isAdmin"
        [mapViewInfo]="currentViewInfo"
        [coordPickerActive]="coordPickerActive"
        [editableSections]="editableSections"
        [sectionEditorActive]="sectionEditorMode"
        [activeSectionIndex]="sectionEditorIndex"
        [selectedVertexIndex]="sectionEditorSelectedVertex"
        [addVertexMode]="sectionEditorAddVertexMode"
        [treeEditorActive]="treeEditorMode"
        [treePlaceActive]="treePlaceActive"
        [treeEditorTarget]="treeEditorTarget"
        [selectedTreeIndex]="selectedTreeIndex"
        [treePlaceVariant]="treePlaceVariant"
        [treePlaceStyleSection]="treePlaceStyleSection"
        [treePlacementHint]="treePlacementHint"
        [ambientTrees]="ambientTrees"
        [spatialReferences]="spatialReferences"
        [spatialPlaceIndex]="spatialPlaceIndex"
        [activeSpatialRefIndex]="activeSpatialRefIndex"
        [sceneOpts]="sceneOpts"
        [spatialRefsOpts]="spatialRefsOpts"
        [groundStyle]="groundStyleOpts"
        [groundSettings]="groundSettingsOpts"
        [sessionSavedAt]="sessionSavedAt"
        (mapControlEvent)="onMapControlEvent($event)"
        (panelToggled)="onPanelToggled()"
        (configuringLayersChange)="onConfiguringLayersChange($event)">
      </app-sticker-panel>

      <!-- Central canvas area -->
      <div class="map-area">
        <div class="map-float-toolbar">
          <button type="button" class="float-btn" title="Acercar" (click)="onMapControlEvent({ type: 'zoomIn' })">+</button>
          <button type="button" class="float-btn" title="Alejar" (click)="onMapControlEvent({ type: 'zoomOut' })">−</button>
          <button type="button" class="float-btn" title="Centrar mapa" (click)="onMapControlEvent({ type: 'centerMap' })">⌖</button>
          <button type="button" class="float-btn" [class.active]="coordPickerActive" title="Copiar coordenadas GPS"
            (click)="onMapControlEvent({ type: 'toggleCoordPicker' })">📍</button>
          <button type="button" class="float-btn" title="Restablecer vista" (click)="onMapControlEvent({ type: 'reset' })">⟲</button>
        </div>
        <app-map-control
          #mapControl
          (anchorClick)="onAnchorMarkerClick($event)"
          (viewInfo)="onViewInfo($event)"
          (saveRequest)="onSaveRequest()"
          (loadRequest)="onLoadRequest()"
          (sectionsChanged)="onSectionsChanged($event)"
          (ambientTreesChanged)="onAmbientTreesChanged($event)"
          (treeEditorStateChanged)="onTreeEditorStateChanged($event)"
          (spatialReferencesChanged)="onSpatialReferencesChanged($event)">
        </app-map-control>
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
    .map-float-toolbar {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 15;
      display: flex;
      flex-direction: row;
      gap: 4px;
    }
    .float-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--sys-outline-variant, rgba(255,255,255,0.15));
      background: color-mix(in srgb, var(--sys-surface) 88%, transparent);
      color: var(--sys-on-surface);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
      transition: border-color 0.15s, background 0.15s;
    }
    .float-btn:hover {
      border-color: var(--sys-primary);
      background: color-mix(in srgb, var(--sys-primary) 12%, var(--sys-surface));
    }
    .float-btn.active {
      border-color: var(--sys-primary);
      background: var(--sys-primary);
      color: var(--sys-on-primary);
    }
  `]
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapControl') mapControl!: MapControlComponent;
  @ViewChild('configPanel') configPanel!: MapLayerConfigPanelComponent;

  private destroy$ = new Subject<void>();

  isDarkTheme = true;
  isAdmin = false;
  coordPickerActive = false;

  sectionEditorMode = false;
  sectionEditorIndex = 0;
  sectionEditorSelectedVertex: number | null = null;
  sectionEditorAddVertexMode = false;
  treeEditorMode = false;
  treePlaceActive = false;
  treeEditorTarget: TreeEditorTarget = 'park';
  selectedTreeIndex: number | null = null;
  treePlaceVariant: 0 | 1 | 2 = 0;
  treePlaceStyleSection = 1;
  treePlacementHint = '';
  ambientTrees: AmbientTreeSlot[] = [];
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
    rainWindDeg: -1,
    fogWindDeg: -1,
    motesWindDeg: -1,
    cloudShadowWindDeg: -1,
    leavesWindDeg: -1,
    treesWindDeg: -1,
  };
  spatialRefsOpts = {
    showSpatialReferences: true,
    spatialAnimPercent: 100,
  };

  sessionSavedAt: string | null = null;
  groundStyleOpts: Record<number, ZoneGroundStyle> = {};
  groundSettingsOpts: GroundMapSettings | null = null;

  private readonly isBrowser: boolean;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SESSION_SAVE_DEBOUNCE_MS = 1200;
  private restoringSession = false;

  /** Latest map view info from the canvas — passed down to the sticker panel */
  currentViewInfo: MapViewInfo | null = null;

  constructor(
    private router: Router,
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

    return {
      version: MAP_CONFIG_VERSION,
      mapState: map.mapState,
      layerOffsets: map.layerOffsets,
      activeMovableLayer: map.activeMovableLayer,
      sections: map.sections,
      spatialReferences: map.spatialReferences,
      ambientScene: map.ambientScene,
      ambientTrees: map.ambientTrees,
      groundStyle: map.groundStyle,
      groundSettings: map.groundSettings,
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
      ambientScene: configData.ambientScene,
      ambientTrees: configData.ambientTrees,
      groundStyle: configData.groundStyle,
      groundSettings: configData.groundSettings,
    }, { skipLegacySave: true });

    if (scenarioId) {
      const scenario = findAmbientScenario(scenarioId);
      if (scenario?.theme) this.themeService.setThemeMode(scenario.theme);
      this.mapControl.applyAmbientScenarioTint(scenarioId);
    }

    this.editableSections = this.mapControl.getEditableSections();
    this.ambientTrees = this.mapControl.getAmbientTrees();
    this.syncSceneStateFromMap();

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
      case 'groundSettingsChange':
        this.mapControl.applyGroundSettings(event.settings);
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.groundSettingsOpts = this.mapControl.getGroundSettingsSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundAutoTilePx':
        this.mapControl.resetGroundTileToAuto();
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleZoneChange':
        this.mapControl.setGroundStyleZone(event.sectionIndex, event.style);
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleApplyAll':
        this.mapControl.applyGroundStyleAllZones(event.style);
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleApplyParkLayers':
        this.mapControl.applyGroundStyleParkLayers(event.style);
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleClearAll':
        this.mapControl.clearAllGroundLayers();
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleResetZone':
        this.mapControl.resetGroundStyleZone(event.sectionIndex);
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleResetParkLayers':
        this.mapControl.resetGroundStyleParkLayers();
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'groundStyleResetAll':
        this.mapControl.resetGroundStyleAll();
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.scheduleSessionSave();
        break;
      case 'centerMap':    this.mapControl.centerMap(); break;
      case 'toggleCoordPicker': this.mapControl.toggleCoordPicker(); this.coordPickerActive = this.mapControl.coordPickerMode; break;
      case 'saveConfig':   this.onSaveRequest(); break;
      case 'loadConfig':   this.onLoadRequest(); break;
      case 'markerSize':         this.mapControl.markerRadius = event.value; this.mapControl.resize(); break;
      case 'toggleSectionEditor':
        this.sectionEditorMode = !this.sectionEditorMode;
        if (this.sectionEditorMode) {
          this.treeEditorMode = false;
          this.mapControl.setTreeEditorMode(false);
        }
        this.mapControl.setSectionEditorMode(this.sectionEditorMode);
        break;
      case 'toggleTreeEditor':
        this.treeEditorMode = !this.treeEditorMode;
        if (this.treeEditorMode) {
          this.sectionEditorMode = false;
          this.mapControl.setSectionEditorMode(false);
          this.treePlaceActive = true;
          this.mapControl.setTreeEditorMode(true);
          this.mapControl.setTreePlaceActive(true);
          if (!this.sceneOpts.showTreesEffect) {
            this.mapControl.setMapSceneOption('showTreesEffect', true);
            this.sceneOpts.showTreesEffect = true;
          }
        } else {
          this.treePlaceActive = false;
          this.selectedTreeIndex = null;
          this.mapControl.setTreeEditorMode(false);
        }
        break;
      case 'setTreeEditorSection':
        this.treeEditorTarget = event.index;
        this.mapControl.setTreeEditorSectionIndex(event.index);
        break;
      case 'setTreePlaceVariant':
        this.treePlaceVariant = event.variant;
        this.mapControl.setTreePlaceVariant(event.variant);
        break;
      case 'setTreePlaceStyleSection':
        this.treePlaceStyleSection = event.section;
        this.mapControl.setTreePlaceStyleSection(event.section);
        break;
      case 'selectAmbientTree':
        this.selectedTreeIndex = event.index;
        this.mapControl.selectAmbientTree(event.index);
        this.treePlaceActive = this.mapControl.treePlaceActive;
        break;
      case 'updateAmbientTree':
        this.mapControl.updateAmbientTree(event.index, event.patch);
        this.ambientTrees = this.mapControl.getAmbientTrees();
        if (event.patch.variant != null) this.treePlaceVariant = event.patch.variant;
        if (event.patch.styleSection != null) this.treePlaceStyleSection = event.patch.styleSection;
        break;
      case 'setTreePlaceActive':
        this.treePlaceActive = event.active;
        this.mapControl.setTreePlaceActive(event.active);
        break;
      case 'removeAmbientTree':
        this.mapControl.removeAmbientTree(event.index);
        this.ambientTrees = this.mapControl.getAmbientTrees();
        this.selectedTreeIndex = this.mapControl.selectedTreeIndex;
        break;
      case 'exportAmbientTrees':
        this.mapControl.downloadAmbientTreesJson();
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
      case 'clearAllPlacedContent':
        this.mapControl.clearAllPlacedMapContent();
        this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
        this.groundSettingsOpts = this.mapControl.getGroundSettingsSnapshot();
        this.ambientTrees = this.mapControl.getAmbientTrees();
        this.spatialReferences = this.mapControl.getSpatialReferences();
        this.spatialPlaceIndex = this.mapControl.spatialReferencePlaceIndex;
        this.activeSpatialRefIndex = this.mapControl.selectedSpatialReferenceIndex;
        this.selectedTreeIndex = this.mapControl.selectedTreeIndex;
        this.syncSceneStateFromMap();
        break;
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
      case 'effectWindDirectionChange': {
        this.onManualSceneEdit();
        this.mapControl.setEffectWindDirection(event.effect, event.deg);
        switch (event.effect) {
          case 'rain': this.sceneOpts.rainWindDeg = event.deg; break;
          case 'fog': this.sceneOpts.fogWindDeg = event.deg; break;
          case 'motes': this.sceneOpts.motesWindDeg = event.deg; break;
          case 'cloudShadows': this.sceneOpts.cloudShadowWindDeg = event.deg; break;
          case 'leaves': this.sceneOpts.leavesWindDeg = event.deg; break;
          case 'trees': this.sceneOpts.treesWindDeg = event.deg; break;
        }
        break;
      }
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
      rainWindDeg: scene.rainWindDeg ?? -1,
      fogWindDeg: scene.fogWindDeg ?? -1,
      motesWindDeg: scene.motesWindDeg ?? -1,
      cloudShadowWindDeg: scene.cloudShadowWindDeg ?? -1,
      leavesWindDeg: scene.leavesWindDeg ?? -1,
      treesWindDeg: scene.treesWindDeg ?? -1,
    };
    this.spatialRefsOpts = {
      showSpatialReferences: scene.showSpatialReferences,
      spatialAnimPercent: Math.round(scene.spatialAnimSpeed * 100),
    };
    this.spatialReferences = this.mapControl.getSpatialReferences();
    this.spatialPlaceIndex = this.mapControl.spatialReferencePlaceIndex;
    this.activeSpatialRefIndex = this.mapControl.selectedSpatialReferenceIndex;
    this.ambientTrees = this.mapControl.getAmbientTrees();
    this.treeEditorMode = this.mapControl.treeEditorMode;
    this.treePlaceActive = this.mapControl.treePlaceActive;
    this.treeEditorTarget = this.mapControl.treeEditorTarget;
    this.selectedTreeIndex = this.mapControl.selectedTreeIndex;
    this.treePlaceVariant = this.mapControl.treePlaceVariant;
    this.treePlaceStyleSection = this.mapControl.treePlaceStyleSection;
    this.treePlacementHint = this.mapControl.treePlacementHint;
    this.groundStyleOpts = this.mapControl.getGroundStyleSnapshot();
    this.groundSettingsOpts = this.mapControl.getGroundSettingsSnapshot();
  }

  onAmbientTreesChanged(trees: AmbientTreeSlot[]): void {
    this.ambientTrees = trees;
    this.scheduleSessionSave();
  }

  onTreeEditorStateChanged(state: {
    selectedTreeIndex: number | null;
    treePlaceVariant: 0 | 1 | 2;
    treePlaceStyleSection: number;
    treePlacementHint: string;
  }): void {
    this.selectedTreeIndex = state.selectedTreeIndex;
    this.treePlaceVariant = state.treePlaceVariant;
    this.treePlaceStyleSection = state.treePlaceStyleSection;
    this.treePlacementHint = state.treePlacementHint;
  }

  onSectionsChanged(sections: ParkSectionRecord[]): void {
    this.editableSections = sections;
    this.sectionEditorSelectedVertex = this.mapControl?.sectionEditorSelectedVertex ?? null;
    this.scheduleSessionSave();
  }

  onPanelToggled(): void {
    requestAnimationFrame(() => this.mapControl?.resize?.());
  }

  onConfiguringLayersChange(open: boolean): void {
    this.mapControl?.setMapLayersConfigOpen(open);
  }

  // ── Map control events ─────────────────────────────────────

  onAnchorMarkerClick(anchorId: string): void {
    if (this.mapControl?.mapLayersConfigOpen) return;
    this.router.navigate(['/anchor-points'], {
      queryParams: { filterId: anchorId }
    });
  }

  // ── Map config panel events ────────────────────────────────

  onSaveRequest(): void {
    this.configPanel?.saveConfig();
  }

  onLoadRequest(): void {
    this.configPanel?.loadConfig();
  }

  onCaptureStateRequest(): void {
    this.configPanel?.receiveState(this.captureFullState());
  }

  onConfigLoaded(configData: MapConfigData): void {
    this.applyFullState(configData);
  }
}
