import { Component, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, OnDestroy, HostListener, OnInit, Inject, PLATFORM_ID, Input, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnchorPointService } from '../../anchor-points/services/anchor-point.service';
import { AnchorPoint, AnchorCluster } from '../../anchor-points/models/anchor-point.model';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';
import { AppShellLoadService } from '../../../core/services/app-shell-load.service';
import { Subject, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * MAPA DE ULTRA ALTA PRECISIÓN v3.0 - Parque de las Culturas y de la Madre Tierra
 *
 * Características:
 * 1. Sistema WGS84 (EPSG:4326) con 8 decimales (~1.1mm precisión)
 * 2. Labels que NO rotan (siempre legibles)
 * 3. Marcadores con tamaño constante independiente del zoom
 * 4. Rotación suave animada con soporte de mantener pulsado
 * 5. Panel de opciones colapsable
 * 6. Áreas/secciones del parque visibles
 * 7. Soporte de tema claro/oscuro
 * 8. Estado persistente en localStorage
 * 9. Polígono detallado con 100+ puntos
 */

import {
  PARK_BOUNDARY,
  PARK_CENTER,
  cloneParkSectionRecords,
  type GeoPoint as SharedGeoPoint,
  type ParkSection as SharedParkSection,
  type ParkSectionRecord,
} from '../data/park-geometry';
import {
  isPointInPolygon,
  findParkSectionAt,
  sectionLabelCentroids,
  toParkSectionsView,
} from '../utils/park-map.util';
import {
  fillColorsFromHex,
  resolveSectionFillOpacities,
  syncSectionFillColors,
} from '../utils/section-color.util';
import {
  cloneSpatialReferences,
  exportSpatialReferencesJson,
  isGeoInPark,
  SPATIAL_REFERENCE_CATEGORY_COLORS,
  spatialReferenceImageUrl,
  spatialReferenceSummary,
  type SpatialReference,
  type SpatialReferenceCategory,
  type SpatialReferenceMarkerStyle,
} from '../data/spatial-reference';
import { MapRainEffect } from '../utils/map-rain-effect';
import type { MapPlaneBounds, RainTickOptions } from '../utils/map-rain-effect';
import { MapFogEffect } from '../utils/map-fog-effect';
import { MapMotesEffect } from '../utils/map-motes-effect';
import { MapCloudShadowEffect } from '../utils/map-cloud-shadow-effect';
import { MapLeavesEffect } from '../utils/map-leaves-effect';
import { MapTreesEffect } from '../utils/map-trees-effect';
import { BACKDROP_TREE_SECTION, cloneAmbientTreeSlots, exportAmbientTreesJson, isGeoInBackdropFrame, isBackdropTreeSlot, type AmbientTreeSlot } from '../data/ambient-tree-slots';
import type { AmbientSceneData } from '../models/map-layer-config.model';
import type { AmbientWind } from '../utils/map-ambient-zone';
import { DEFAULT_AMBIENT_WIND, EFFECT_WIND_INHERIT, normalizeWindDegrees, type AmbientEffectWindKey } from '../utils/map-ambient-wind';
import { MapLightningEffect } from '../utils/map-lightning-effect';
import { MapNightMistEffect } from '../utils/map-night-mist-effect';
import { SpatialReferenceLayer } from '../utils/spatial-reference-layer';
import type { AmbientScenario, AmbientScenarioTint } from '../data/ambient-scenarios';
import { findAmbientScenario } from '../data/ambient-scenarios';
import { clampGroundTilePx, PARK_MAP_VIS, parkGroundTintOpacity } from '../utils/map-park-visual-scale';
import {
  GroundPatternCache,
  fillPolygonWithGroundTexture,
  MapBackdropCache,
  fillMapRectWithBackdrop,
  exportGroundStyleSnapshot,
  importGroundStyleSnapshot,
  resetGroundStyleToDefaults,
  resetGroundStyleZone,
  updateGroundStyleZone,
  type ZoneGroundStyle,
} from '../utils/draw-ground-texture';

type GeoPoint = SharedGeoPoint;
type ParkSection = SharedParkSection;

interface CanvasPoint {
  x: number;
  y: number;
}

interface Marker {
  id: string;
  name: string;
  geo: GeoPoint;
  isInsidePark: boolean;
  section?: string;
}

// Constantes geodésicas (centroide OSM del parque — shared/data/park-boundary.json)
const LAT_CENTER = PARK_CENTER.lat;
const LNG_CENTER = PARK_CENTER.lng;
const METERS_PER_DEG_LAT = 111320;
const LAT_CORRECTION = Math.cos(LAT_CENTER * Math.PI / 180);
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * LAT_CORRECTION;

// Colores para tema oscuro y claro — matches ParkMapView ThemeColors from mobile app
const THEME_COLORS = {
  dark: {
    background: '#1a1a2e',
    grid: 'rgba(50, 50, 80, 0.5)',
    gridText: 'rgba(100, 100, 150, 0.7)',
    boundary: '#4caf50',
    boundaryFill: 'rgba(76, 175, 80, 0.2)',
    text: '#ffffff',
    textSecondary: '#888888',
    panelBg: 'rgba(0, 0, 0, 0.78)',
    panelBorder: '#444444',
    accent: '#4caf50',
    markerInside: '#4caf50',
    markerOutside: '#f44336',
    scale: '#4caf50'
  },
  light: {
    background: '#ddd8ce',
    grid: 'rgba(100, 100, 120, 0.3)',
    gridText: 'rgba(80, 80, 100, 0.8)',
    boundary: '#2e7d32',
    boundaryFill: 'rgba(76, 175, 80, 0.15)',
    text: '#212121',
    textSecondary: '#666666',
    panelBg: 'rgba(255, 255, 255, 0.90)',
    panelBorder: '#cccccc',
    accent: '#2e7d32',
    markerInside: '#2e7d32',
    markerOutside: '#c62828',
    scale: '#2e7d32'
  }
};

@Component({
  selector: 'app-map-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="precision-map" [class.light-theme]="!isDarkTheme">
      <canvas #mapCanvas
        [class.coord-picker]="coordPickerMode"
        [class.section-hover]="hoveredSectionIndex >= 0 && !sectionEditorMode"
        (mousedown)="onMouseDown($event)"
        (mousemove)="onMouseMove($event)"
        (mouseup)="onMouseUp()"
        (mouseleave)="onMouseLeave()"
        (wheel)="onWheel($event)"
        (click)="onClick($event)"
        (contextmenu)="$event.preventDefault()">
      </canvas>



      <div class="copy-toast" [class.visible]="showCopyToast">
        📋 {{ lastCopiedCoords }}
      </div>

      <div class="map-orientation-hud">
        <div class="section-chip" *ngIf="visitorSectionLabel">
          Estás en: {{ visitorSectionLabel }}
        </div>
        <div class="section-chip muted" *ngIf="geoActive && !visitorSectionLabel">
          Fuera de las zonas del parque
        </div>
        <div class="map-legend" *ngIf="mapOptions.showSections">
          <div class="legend-title">Zonas del parque</div>
          <button type="button" class="section-play-btn"
            *ngFor="let s of editableSections; let i = index"
            [class.active]="!sectionEditorMode && playerFichaSectionIndex === i"
            [class.editor-active]="sectionEditorMode && sectionEditorIndex === i"
            [style.--zone-color]="s.chartColor"
            (click)="onZoneButtonClick(i); $event.stopPropagation()">
            <span class="legend-swatch" [style.background]="s.chartColor"></span>
            <span>{{ s.name }}</span>
          </button>
          <div class="legend-row you-row">
            <span class="legend-swatch you"></span>
            <span>Tú (GPS)</span>
          </div>
        </div>
      </div>

      <!-- Hint -->
      <div class="click-hint">
        {{ sectionEditorMode
             ? (sectionEditorAddVertexMode
               ? 'Click en el mapa para añadir vértice a la sección activa'
               : 'Botones de zona · click dentro del polígono para seleccionar · arrastra vértices')
           : treeEditorMode && treePlaceActive
             ? (treeEditorSectionIndex === -1
               ? 'Click fuera del parque para colocar · sigue colocando sin pulsar de nuevo'
               : 'Click en la zona activa para colocar · puedes poner varios seguidos')
           : coordPickerMode
             ? 'Click en el mapa para copiar coordenadas GPS | Usa vista Z↓ para máxima precisión'
             : 'Scroll = zoom | Zonas: botón encuadra y abre ficha · hover resalta contorno' }}
      </div>

      <div class="edit-banner section-editor-banner" *ngIf="sectionEditorMode">
        ✏️ Editor de secciones — arrastra vértices · Del borrar · click añade si está activo
      </div>

      <div class="edit-banner section-editor-banner" *ngIf="treeEditorMode">
        🌳 {{ treeEditorBannerText }}
      </div>

      <!-- Ficha educativa (vista jugador + editor) -->
      <div class="section-edu-card" *ngIf="showSectionFicha && fichaSection as sec"
        (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
        <button type="button" class="section-edu-close" *ngIf="!sectionEditorMode"
          (click)="closePlayerFicha()" title="Cerrar">✕</button>
        <div class="section-edu-tabs">
          <button type="button" class="section-edu-tab"
            *ngFor="let s of editableSections; let i = index"
            [class.active]="fichaSectionIndex === i"
            [style.--tab-color]="s.chartColor"
            (click)="onZoneButtonClick(i)">
            <span class="tab-swatch" [style.background]="s.chartColor"></span>
            {{ s.name }}
          </button>
        </div>

        <!-- Vista jugador (solo lectura) -->
        <div class="section-edu-body" *ngIf="!sectionEditorMode">
          <div class="section-edu-media" *ngIf="sec.education?.referenceImageUrl">
            <img [src]="sec.education!.referenceImageUrl!" [alt]="'Referencia ' + sec.name">
          </div>
          <p class="section-edu-readonly">{{ sec.education?.summary || 'Sin descripción educativa aún.' }}</p>
        </div>

        <!-- Editor -->
        <div class="section-edu-body" *ngIf="sectionEditorMode">
          <div class="section-edu-media" *ngIf="sec.education?.referenceImageUrl">
            <img [src]="sec.education!.referenceImageUrl!" [alt]="'Referencia ' + sec.name">
            <button type="button" class="section-edu-clear-img" (click)="clearSectionReferenceImage()"
              title="Quitar imagen">✕</button>
          </div>
          <div class="section-edu-media placeholder" *ngIf="!sec.education?.referenceImageUrl">
            <span>Sin imagen de referencia</span>
          </div>

          <button type="button" class="section-edu-img-btn" (click)="sectionImgInput.click()">
            📷 Subir imagen de referencia
          </button>
          <input #sectionImgInput type="file" accept="image/*" hidden
            (change)="onSectionReferenceImagePicked($event)">

          <label class="section-edu-label">Definición educativa</label>
          <textarea class="section-edu-textarea" rows="5" maxlength="1200"
            [ngModel]="sec.education?.summary ?? ''"
            (ngModelChange)="onEducationSummaryChange($event)"
            placeholder="Describe el ecosistema, especies y mensaje educativo para visitantes…"></textarea>
        </div>
      </div>

      <!-- Ficha referencia espacial -->
      <div class="section-edu-card spatial-ref-ficha" *ngIf="playerSpatialRefIndex !== null && activeSpatialRef as sref"
        (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
        <button type="button" class="section-edu-close" (click)="closeSpatialRefFicha()" title="Cerrar">✕</button>
        <div class="spatial-ref-ficha-bar" [style.background]="spatialRefCategoryColor(sref.category)"></div>
        <div class="section-edu-tabs">
          <button type="button" class="section-edu-tab"
            *ngFor="let r of spatialReferences; let i = index"
            [class.active]="playerSpatialRefIndex === i"
            [style.--tab-color]="spatialRefCategoryColor(r.category)"
            (click)="openSpatialRefFicha(i)">
            <span class="tab-swatch" [style.background]="spatialRefCategoryColor(r.category)"></span>
            {{ r.name }}
          </button>
        </div>
        <div class="section-edu-body">
          <h3 class="spatial-ref-ficha-title">{{ sref.name }}</h3>
          <span class="spatial-ref-ficha-cat">{{ sref.category }}</span>
          <div class="section-edu-media" *ngIf="spatialRefImage(sref) as imgUrl">
            <img [src]="imgUrl" [alt]="sref.name">
          </div>
          <p class="section-edu-readonly">{{ spatialRefSummary(sref) || 'Sin información aún.' }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }

    .precision-map {
      --bg: #1a1a2e;
      --text: #ffffff;
      --text-secondary: #888888;
      --panel-bg: rgba(0, 0, 0, 0.78);
      --panel-border: #444444;
      --accent: #4caf50;

      position: relative;
      height: 100%;
      width: 100%;
      background: var(--bg);
      overflow: hidden;
    }

    .precision-map.light-theme {
      --bg: #f5f5f5;
      --text: #212121;
      --text-secondary: #666666;
      --panel-bg: rgba(255, 255, 255, 0.90);
      --panel-border: #cccccc;
      --accent: #2e7d32;
    }

    canvas {
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 2;
    }

    canvas.coord-picker {
      cursor: crosshair !important;
    }

    canvas.transparent-bg {
      background: transparent !important;
    }



    .copy-toast {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(0, 100, 0, 0.95);
      color: #fff;
      padding: 10px 16px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      opacity: 0;
      transition: all 0.3s;
      pointer-events: none;
    }

    .copy-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .click-hint {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--panel-bg);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-family: sans-serif;
      border: 1px solid var(--panel-border);
    }

    .edit-banner {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(124, 77, 255, 0.9);
      color: #fff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: sans-serif;
      pointer-events: none;
      z-index: 5;
    }
    .edit-banner.editor-banner {
      background: rgba(124, 131, 255, 0.9);
    }
    .edit-banner.section-editor-banner {
      background: rgba(255, 152, 0, 0.92);
      top: 44px;
    }

    .map-orientation-hud {
      position: absolute;
      left: 12px;
      bottom: 48px;
      z-index: 6;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: min(220px, 55vw);
    }

    .section-chip {
      background: rgba(46, 125, 50, 0.92);
      color: #fff;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }

    .section-chip.muted {
      background: rgba(97, 97, 97, 0.9);
    }

    .map-legend {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      color: var(--text);
      font-family: sans-serif;
      pointer-events: auto;
    }

    .legend-title {
      font-weight: 700;
      margin-bottom: 6px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .legend-row.you-row {
      margin-top: 6px;
      pointer-events: none;
    }

    .section-play-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin-bottom: 4px;
      padding: 7px 8px;
      border-radius: 8px;
      border: 2px solid transparent;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      transition: transform 0.12s, border-color 0.12s, background 0.12s, box-shadow 0.12s;
    }

    .precision-map.light-theme .section-play-btn {
      background: rgba(0, 0, 0, 0.03);
    }

    .section-play-btn:hover {
      transform: translateY(-1px);
      border-color: var(--zone-color, #ff9800);
      background: color-mix(in srgb, var(--zone-color, #ff9800) 14%, transparent);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--zone-color, #ff9800) 35%, transparent);
    }

    .section-play-btn.active,
    .section-play-btn.editor-active {
      border-color: var(--zone-color, #ff9800);
      background: color-mix(in srgb, var(--zone-color, #ff9800) 20%, transparent);
    }

    .legend-row:last-child {
      margin-bottom: 0;
    }

    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }

    .legend-swatch.you {
      background: #1e88e5;
      border-radius: 50%;
    }

    .section-edu-card {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 12;
      width: min(320px, calc(100% - 24px));
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      pointer-events: auto;
    }

    .section-edu-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      border-bottom: 1px solid var(--panel-border);
      background: rgba(0, 0, 0, 0.12);
    }

    .precision-map.light-theme .section-edu-tabs {
      background: rgba(0, 0, 0, 0.03);
    }

    .section-edu-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 2px solid transparent;
      background: transparent;
      color: var(--text);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s;
    }

    .section-edu-tab:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .section-edu-tab.active {
      border-color: var(--tab-color, #ff9800);
      background: color-mix(in srgb, var(--tab-color, #ff9800) 16%, transparent);
    }

    .tab-swatch {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.12);
    }

    .section-edu-body {
      padding: 10px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-edu-media {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--panel-border);
      background: rgba(0, 0, 0, 0.2);
      min-height: 88px;
      max-height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .section-edu-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      max-height: 140px;
    }

    .section-edu-media.placeholder {
      color: var(--text-secondary);
      font-size: 11px;
    }

    .section-edu-clear-img {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
    }

    .section-edu-img-btn {
      width: 100%;
      padding: 7px 10px;
      border-radius: 8px;
      border: 1px dashed var(--panel-border);
      background: transparent;
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
    }

    .section-edu-img-btn:hover {
      border-color: #ff9800;
      color: var(--text);
    }

    .section-edu-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }

    .section-edu-textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 96px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--panel-border);
      background: rgba(0, 0, 0, 0.15);
      color: var(--text);
      font-size: 12px;
      line-height: 1.45;
      font-family: inherit;
    }

    .precision-map.light-theme .section-edu-textarea {
      background: rgba(255, 255, 255, 0.9);
    }

    .section-edu-textarea:focus {
      outline: none;
      border-color: #ff9800;
    }

    .section-edu-close {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    }

    .section-edu-readonly {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
    }

    .spatial-ref-ficha {
      top: 12px;
      left: 12px;
      right: auto;
      width: min(320px, calc(100% - 24px));
    }

    .spatial-ref-ficha-bar {
      height: 4px;
      width: 100%;
    }

    .spatial-ref-ficha-title {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
    }

    .spatial-ref-ficha-cat {
      display: inline-block;
      margin-bottom: 10px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }

    canvas.section-hover {
      cursor: pointer;
    }
  `]
})
export class MapControlComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('mapCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() anchorClick = new EventEmitter<string>();

  // ── Map view info output (throttled, ~500ms) ─────────────────
  /** Emits current map center lat/lng, zoom and rotation for external panels */
  @Output() viewInfo = new EventEmitter<{
    lat: number; lng: number; zoom: number; rotDeg: number;
    showSections: boolean; showLabels: boolean;
    showGroundTextures: boolean;
    groundTilePx: number;
    showBoundary: boolean; showMarkers: boolean;
  }>();

  /** Polígonos de sección editados (para panel lateral). */
  @Output() sectionsChanged = new EventEmitter<ParkSectionRecord[]>();

  /** Árboles ambientales colocados por zona. */
  @Output() ambientTreesChanged = new EventEmitter<AmbientTreeSlot[]>();
  @Output() treeEditorStateChanged = new EventEmitter<{
    selectedTreeIndex: number | null;
    treePlaceVariant: 0 | 1 | 2;
    treePlaceStyleSection: number;
    treePlacementHint: string;
  }>();

  /** Referencias espaciales (elementos de escena del mapa). */
  @Output() spatialReferencesChanged = new EventEmitter<SpatialReference[]>();

  // ── Layer config I/O ──────────────────────────────────
  /** Request parent to save current map layer configuration */
  @Output() saveRequest = new EventEmitter<void>();
  /** Request parent to load saved map layer configuration */
  @Output() loadRequest = new EventEmitter<void>();

  private ctx!: CanvasRenderingContext2D;
  private destroy$ = new Subject<void>();
  private readonly shellLoad = inject(AppShellLoadService);
  private isBrowser: boolean;

  // Estado del mapa
  private scale = 1.2;
  private targetScale = 1.2;
  private rotation = 0;
  private targetRotation = 0;
  private offsetX = 0;
  private offsetY = 0;
  private targetOffsetX = 0;
  private targetOffsetY = 0;

  // Animación
  private animationId: number | null = null;
  private readonly ANIMATION_SPEED = 0.08;
  private readonly ZOOM_ANIMATION_SPEED = 0.2;
  /** Interpolación más rápida al encuadrar una zona. */
  private readonly SECTION_FOCUS_ANIM_SPEED = 0.22;
  private sectionFocusAnimating = false;
  private readonly groundPatternCache = new GroundPatternCache();
  private readonly mapBackdropCache = new MapBackdropCache();
  private readonly STORAGE_KEY = 'pcymt_map_state_v3';

  // Rotación continua
  private rotationInterval: ReturnType<typeof setInterval> | null = null;
  private rotationHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private isRotating = false;
  private readonly ROTATION_STEP = Math.PI / 180; // 1° por frame
  private readonly HOLD_DELAY = 200; // ms antes de empezar rotación continua

  // Tamaños de marcadores
  private readonly MARKER_RADIUS = 10;
  private readonly MARKER_INNER_RADIUS = 4;
  private readonly MARKER_WARNING_RADIUS = 16;

  // Bounds
  private bounds = this.calculateBounds(PARK_BOUNDARY, 0.0002);

  // Datos
  private markers: Marker[] = [];
  private clusters: AnchorCluster[] = [];
  editableSections: ParkSectionRecord[] = cloneParkSectionRecords();

  // Editor de polígonos de sección
  sectionEditorMode = false;
  sectionEditorIndex = 0;
  sectionEditorSelectedVertex: number | null = null;
  sectionEditorAddVertexMode = false;
  private draggingSectionVertex = false;

  // Editor de árboles por zona
  treeEditorMode = false;
  treePlaceActive = false;
  treeEditorSectionIndex = 0;
  selectedTreeIndex: number | null = null;
  treePlaceVariant: 0 | 1 | 2 = 0;
  treePlaceStyleSection = 1;
  treePlacementHint = '';
  ambientTrees: AmbientTreeSlot[] = [];
  private draggingTreeIndex: number | null = null;

  private pointerMovedSinceDown = false;
  private pointerDownX = 0;
  private pointerDownY = 0;
  /** Tap en polígono de zona (mousedown) — evita que el pan robe el click. */
  private pendingZoneTapIndex = -1;
  /** Vista jugador: ficha abierta para esta sección (null = cerrada). */
  playerFichaSectionIndex: number | null = null;
  playerSpatialRefIndex: number | null = null;
  /** Hover sobre polígono de sección (-1 = ninguna). */
  hoveredSectionIndex = -1;

  // UI
  private _cursorLat = LAT_CENTER;
  private _cursorLng = LNG_CENTER;
  showCopyToast = false;
  lastCopiedCoords = '';

  isDarkTheme = true;

  /** P0 orientación visitante — leyenda dinámica según colores de sección. */
  get legendItems(): Array<{ name: string; swatch: string }> {
    return this.editableSections.map((s) => ({ name: s.name, swatch: s.chartColor }));
  }

  get showSectionFicha(): boolean {
    return this.sectionEditorMode || this.playerFichaSectionIndex !== null;
  }

  get fichaSectionIndex(): number {
    if (this.sectionEditorMode) return this.sectionEditorIndex;
    return this.playerFichaSectionIndex ?? 0;
  }

  get activeSpatialRef(): SpatialReference | null {
    if (this.playerSpatialRefIndex === null) return null;
    return this.spatialReferences[this.playerSpatialRefIndex] ?? null;
  }

  readonly spatialRefSummary = spatialReferenceSummary;
  readonly spatialRefImage = spatialReferenceImageUrl;

  spatialRefCategoryColor(cat: SpatialReferenceCategory): string {
    return SPATIAL_REFERENCE_CATEGORY_COLORS[cat] ?? '#607D8B';
  }

  get fichaSection(): ParkSectionRecord | null {
    return this.editableSections[this.fichaSectionIndex] ?? null;
  }
  visitorSectionLabel: string | null = null;
  geoActive = false;
  private geoWatchId: number | null = null;

  // Opciones del mapa
  mapOptions = {
    showSections: true,
    showSectionLabels: true,
    showLabels: true,
    showGroundTextures: true,
    groundTilePx: PARK_MAP_VIS.groundTilePx as number,
    showBoundary: true,
    showMarkers: true,
    showSpatialReferences: true,
    showRainEffect: false,
    rainIntensity: 0.45,
    rainSize: 1,
    rainSectionIndex: -1,
    showFogEffect: false,
    fogIntensity: 0.35,
    fogSize: 1,
    showMotesEffect: false,
    motesIntensity: 0.4,
    motesSize: 1,
    showCloudShadows: false,
    cloudShadowIntensity: 0.4,
    cloudShadowSize: 1,
    showLeavesEffect: false,
    leavesIntensity: 0.45,
    leavesSize: 1,
    showTreesEffect: false,
    treesIntensity: 0.55,
    treesSize: 1,
    showLightningEffect: false,
    showNightMistEffect: false,
    nightMistIntensity: 0.35,
    ambientWindDeg: DEFAULT_AMBIENT_WIND.directionDeg,
    ambientWindStrength: DEFAULT_AMBIENT_WIND.strength,
    rainWindDeg: EFFECT_WIND_INHERIT,
    fogWindDeg: EFFECT_WIND_INHERIT,
    motesWindDeg: EFFECT_WIND_INHERIT,
    cloudShadowWindDeg: EFFECT_WIND_INHERIT,
    leavesWindDeg: EFFECT_WIND_INHERIT,
    treesWindDeg: EFFECT_WIND_INHERIT,
    spatialAnimSpeed: 1,
  };

  spatialReferences: SpatialReference[] = cloneSpatialReferences();
  /** Índice activo para colocar referencia espacial con click en mapa (-1 = ninguno). */
  spatialReferencePlaceIndex = -1;
  selectedSpatialReferenceIndex = -1;

  private readonly rainEffect = new MapRainEffect();
  private readonly fogEffect = new MapFogEffect();
  private readonly motesEffect = new MapMotesEffect();
  private readonly cloudShadowEffect = new MapCloudShadowEffect();
  private readonly leavesEffect = new MapLeavesEffect();
  private readonly treesEffect = new MapTreesEffect();
  private readonly lightningEffect = new MapLightningEffect();
  private readonly nightMistEffect = new MapNightMistEffect();
  private readonly spatialRefLayer = new SpatialReferenceLayer();
  private spatialRefsPhase = 0;

  /** Escenario demo activo (tinte + boost de contraste en secciones). */
  ambientScenarioId: string | null = null;
  private ambientScenarioTint: AmbientScenarioTint | null = null;
  private ambientSectionOpacityBoost = 0;

  @Input() markerRadius = 10;

  /** Which layer is currently movable ('canvas' = move all) */
  activeMovableLayer: 'canvas' | 'boundary' | 'sections' | 'markers' = 'canvas';

  /** Per-layer offsets in map-space (used when moving individual layers) */
  layerOffsets = {
    boundary: { x: 0, y: 0 },
    sections: { x: 0, y: 0 },
    markers:  { x: 0, y: 0 },
  };

  /** Saved transform snapshot for locked boundary */
  // lockedBoundaryTransform removed — lock now only prevents layer editing, not panning
  private resizeObserver: ResizeObserver | null = null;

  // Interacción
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  // ── Cursor throttle (hit-test at most every 30ms) ────────
  private lastCursorX = -9999;
  private lastCursorY = -9999;
  private readonly CURSOR_MOVE_THRESHOLD = 4; // px

  // ── Zoom-to-cursor anchor (updated per-frame in animation loop) ──
  private _zoomFocusScreen: { x: number; y: number } | null = null;
  private _zoomFocusMap: { x: number; y: number } | null = null;
  private _hasZoomAnchor = false;
  private lastPointerOnCanvas = { x: 0, y: 0, valid: false };

  /** When true, clicking on the map copies lat/lng coordinates. */
  coordPickerMode = false;

  // ── ViewInfo throttle ─────────────────────────────────────────
  private lastViewInfoTime = 0;

  get zoom(): number { return this.scale; }
  get rotationDeg(): number { return this.rotation * 180 / Math.PI; }
  get theme() { return this.isDarkTheme ? THEME_COLORS.dark : THEME_COLORS.light; }

  constructor(
    private anchorService: AnchorPointService,
    private themeService: ThemeManagerService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadState();
      this.isDarkTheme = this.themeService.isDarkMode();
      this.themeService.themeChanged$
        .pipe(takeUntil(this.destroy$))
        .subscribe(theme => {
          this.isDarkTheme = theme === 'dark';
          this.groundPatternCache.clear();
          this.mapBackdropCache.clear();
          this.render();
        });
      this.startVisitorGeolocation();
    }
  }

  private startVisitorGeolocation(): void {
    if (!navigator.geolocation) return;
    this.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.geoActive = true;
        this.visitorSectionLabel = findParkSectionAt(
          pos.coords.latitude,
          pos.coords.longitude,
          toParkSectionsView(this.editableSections),
        );
      },
      () => {
        this.geoActive = false;
        this.visitorSectionLabel = null;
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.loadMarkers();
    this.rainEffect.setIntensity(this.mapOptions.rainIntensity);
    this.rainEffect.setSizeMul(this.mapOptions.rainSize);
    this.fogEffect.setIntensity(this.mapOptions.fogIntensity);
    this.fogEffect.setSizeMul(this.mapOptions.fogSize);
    this.motesEffect.setIntensity(this.mapOptions.motesIntensity);
    this.motesEffect.setSizeMul(this.mapOptions.motesSize);
    this.cloudShadowEffect.setIntensity(this.mapOptions.cloudShadowIntensity);
    this.cloudShadowEffect.setSizeMul(this.mapOptions.cloudShadowSize);
    this.leavesEffect.setIntensity(this.mapOptions.leavesIntensity);
    this.leavesEffect.setSizeMul(this.mapOptions.leavesSize);
    this.treesEffect.setIntensity(this.mapOptions.treesIntensity);
    this.treesEffect.setSizeMul(this.mapOptions.treesSize);
    this.treesEffect.setSlots(this.ambientTrees);
    this.lightningEffect.setEnabled(this.mapOptions.showLightningEffect);
    this.lightningEffect.setRainIntensity(this.mapOptions.rainIntensity);
    this.nightMistEffect.setIntensity(this.mapOptions.nightMistIntensity);
    this.syncAmbientZoneCallbacks();
    this.spatialRefLayer.preload(this.spatialReferences);
    this.startAnimationLoop();
    // Emit initial view info after a short delay so the canvas has sized up
    setTimeout(() => this.emitViewInfo(), 300);
    setTimeout(() => this.emitSectionsChanged(), 350);
    setTimeout(() => this.emitAmbientTreesChanged(), 360);
    setTimeout(() => this.emitTreeEditorState(), 370);

    // Observe parent element size changes (e.g. sidenav toggle) to auto-resize canvas
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(parent);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.saveState();
    this.stopContinuousRotation();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.geoWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geoWatchId);
    }
  }

  // === PERSISTENCIA ===

  private loadState(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        this.scale = state.scale ?? 1.2;
        this.targetScale = this.scale;
        this.rotation = state.rotation ?? (-52 * Math.PI / 180);
        this.targetRotation = this.rotation;
        this.offsetX = state.offsetX ?? 0;
        this.offsetY = state.offsetY ?? 0;
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
        this.mapOptions.showSections = state.showSections ?? true;
        this.mapOptions.showLabels = state.showLabels ?? true;
        this.mapOptions.showGroundTextures = state.showGroundTextures ?? true;
        if (state.groundTilePx != null) {
          this.mapOptions.groundTilePx = clampGroundTilePx(state.groundTilePx);
          this.groundPatternCache.setTilePx(this.mapOptions.groundTilePx);
          this.mapBackdropCache.setTilePx(this.mapOptions.groundTilePx);
        }
      }
    } catch (e) {
      console.warn('Error loading map state:', e);
    }
  }

  private saveState(): void {
    try {
      const state = {
        scale: this.scale,
        rotation: this.rotation,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        showSections: this.mapOptions.showSections,
        showLabels: this.mapOptions.showLabels,
        showGroundTextures: this.mapOptions.showGroundTextures,
        groundTilePx: this.mapOptions.groundTilePx,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Error saving map state:', e);
    }
  }

  onOptionChange(): void {
    this.render();
    this.saveState();
  }

  // === ANIMACIÓN ===

  private startAnimationLoop(): void {
    const animate = () => {
      let needsRender = false;

      // Interpolar escala (with zoom-to-cursor anchor adjustment)
      if (Math.abs(this.scale - this.targetScale) > 0.001) {
        const zoomSpeed = this._hasZoomAnchor ? this.ZOOM_ANIMATION_SPEED : (this.sectionFocusAnimating ? this.SECTION_FOCUS_ANIM_SPEED : this.ANIMATION_SPEED);
        this.scale += (this.targetScale - this.scale) * zoomSpeed;
        if (this._hasZoomAnchor) this.applyZoomFocus(this.scale);
        needsRender = true;
      } else if (this.scale !== this.targetScale) {
        this.scale = this.targetScale;
        if (this._hasZoomAnchor) this.applyZoomFocus(this.scale);
        this._hasZoomAnchor = false;
        this._zoomFocusScreen = null;
        this._zoomFocusMap = null;
        needsRender = true;
      }

      // Interpolar rotación (camino más corto)
      let rotDiff = this.targetRotation - this.rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

      if (Math.abs(rotDiff) > 0.001) {
        this.rotation += rotDiff * this.ANIMATION_SPEED;
        needsRender = true;
      } else if (this.rotation !== this.targetRotation) {
        this.rotation = this.targetRotation;
        needsRender = true;
      }

      if (Math.abs(this.offsetX - this.targetOffsetX) > 0.5) {
        const panSpeed = this.sectionFocusAnimating ? this.SECTION_FOCUS_ANIM_SPEED : this.ANIMATION_SPEED;
        this.offsetX += (this.targetOffsetX - this.offsetX) * panSpeed;
        needsRender = true;
      } else if (this.offsetX !== this.targetOffsetX) {
        this.offsetX = this.targetOffsetX;
        needsRender = true;
      }

      if (Math.abs(this.offsetY - this.targetOffsetY) > 0.5) {
        const panSpeed = this.sectionFocusAnimating ? this.SECTION_FOCUS_ANIM_SPEED : this.ANIMATION_SPEED;
        this.offsetY += (this.targetOffsetY - this.offsetY) * panSpeed;
        needsRender = true;
      } else if (this.offsetY !== this.targetOffsetY) {
        this.offsetY = this.targetOffsetY;
        needsRender = true;
      }

      if (this.sectionFocusAnimating
          && Math.abs(this.scale - this.targetScale) <= 0.001
          && Math.abs(this.offsetX - this.targetOffsetX) <= 0.5
          && Math.abs(this.offsetY - this.targetOffsetY) <= 0.5) {
        this.sectionFocusAnimating = false;
      }

      // Rotación continua
      if (this.isRotating) {
        needsRender = true;
      }

      if (this.canvasRef?.nativeElement && this.hasActiveAmbientEffects()) {
        const zone = this.getAmbientTickZone();
        if (this.mapOptions.showCloudShadows) {
          this.cloudShadowEffect.tick({ ...zone, wind: this.getEffectWind(this.mapOptions.cloudShadowWindDeg) });
        }
        if (this.mapOptions.showFogEffect) {
          this.fogEffect.tick({ ...zone, wind: this.getEffectWind(this.mapOptions.fogWindDeg) });
        }
        if (this.mapOptions.showNightMistEffect && this.isDarkTheme) this.nightMistEffect.tick(zone);
        if (this.mapOptions.showRainEffect) {
          this.rainEffect.tick({ ...zone, wind: this.getEffectWind(this.mapOptions.rainWindDeg) });
        }
        if (this.mapOptions.showMotesEffect) {
          this.motesEffect.tick({ ...zone, wind: this.getEffectWind(this.mapOptions.motesWindDeg) });
        }
        if (this.mapOptions.showLeavesEffect) {
          this.leavesEffect.tick({ ...zone, wind: this.getEffectWind(this.mapOptions.leavesWindDeg) });
        }
        if (this.mapOptions.showLightningEffect) {
          this.lightningEffect.setRainIntensity(this.mapOptions.rainIntensity);
          this.lightningEffect.tick(this.mapOptions.showRainEffect);
        }
        needsRender = true;
      }

      if (this.mapOptions.showSpatialReferences) {
        this.spatialRefsPhase += 0.018 * this.mapOptions.spatialAnimSpeed;
        needsRender = true;
      }

      if (needsRender) {
        this.render();
      }

      // Emit view info at most every 500ms when map is moving
      const now = Date.now();
      if (needsRender && (now - this.lastViewInfoTime) > 500) {
        this.lastViewInfoTime = now;
        this.emitViewInfo();
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  @HostListener('window:resize')
  resize(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }

  private loadMarkers(): void {
    this.anchorService.getActiveAnchorPoints()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.shellLoad.endNavigation()),
      )
      .subscribe((points: AnchorPoint[]) => {
        this.markers = points.map(p => {
          const geo = { lat: Number(p.latitude), lng: Number(p.longitude) };
          return {
            id: p.id,
            name: p.name,
            geo,
            isInsidePark: isPointInPolygon(geo, PARK_BOUNDARY),
            section: (p as any).section
          };
        });
        this.render();
      });

    // Cluster zones disabled to avoid dashed connector overlays on the map
    this.clusters = [];
  }

  private calculateBounds(polygon: GeoPoint[], padding: number) {
    const lats = polygon.map(p => p.lat);
    const lngs = polygon.map(p => p.lng);
    return {
      minLat: Math.min(...lats) - padding,
      maxLat: Math.max(...lats) + padding,
      minLng: Math.min(...lngs) - padding,
      maxLng: Math.max(...lngs) + padding
    };
  }

  // === CONVERSIONES ===

  private geoToCanvas(geo: GeoPoint): CanvasPoint {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const geoW = this.bounds.maxLng - this.bounds.minLng;
    const geoH = this.bounds.maxLat - this.bounds.minLat;
    const latCorrectionFactor = Math.cos(LAT_CENTER * Math.PI / 180);
    const correctedGeoW = geoW * latCorrectionFactor;

    const scaleX = w / correctedGeoW;
    const scaleY = h / geoH;
    const s = Math.min(scaleX, scaleY) * 0.9;

    const cx = w / 2;
    const cy = h / 2;
    const geoMidLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    const geoMidLng = (this.bounds.minLng + this.bounds.maxLng) / 2;

    const relX = (geo.lng - geoMidLng) * latCorrectionFactor * s;
    const relY = (geoMidLat - geo.lat) * s;

    return { x: cx + relX, y: cy + relY };
  }

  private geoToScreen(geo: GeoPoint): CanvasPoint {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const basePoint = this.geoToCanvas(geo);
    const cx = w / 2;
    const cy = h / 2;

    let x = basePoint.x - cx;
    let y = basePoint.y - cy;

    x *= this.scale;
    y *= this.scale;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * x - sin * y;
    const ry = sin * x + cos * y;

    return {
      x: rx + cx + this.offsetX,
      y: ry + cy + this.offsetY
    };
  }

  /** Convert screen coordinates to map-space coordinates (inverse of the map transform). */
  private screenToMap(sx: number, sy: number): { x: number; y: number } {
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const cx = sx - w / 2 - this.offsetX;
    const cy = sy - h / 2 - this.offsetY;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return {
      x: (cx * cos - cy * sin) / this.scale + w / 2,
      y: (cx * sin + cy * cos) / this.scale + h / 2
    };
  }

  private canvasToGeo(canvas: CanvasPoint): GeoPoint {
    const canvasEl = this.canvasRef.nativeElement;
    const w = canvasEl.width / (window.devicePixelRatio || 1);
    const h = canvasEl.height / (window.devicePixelRatio || 1);

    const cx = w / 2;
    const cy = h / 2;

    let x = (canvas.x - cx - this.offsetX) / this.scale;
    let y = (canvas.y - cy - this.offsetY) / this.scale;

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const rx = cos * x - sin * y;
    const ry = sin * x + cos * y;

    const geoW = this.bounds.maxLng - this.bounds.minLng;
    const geoH = this.bounds.maxLat - this.bounds.minLat;
    const latCorrectionFactor = Math.cos(LAT_CENTER * Math.PI / 180);
    const correctedGeoW = geoW * latCorrectionFactor;

    const scaleX = w / correctedGeoW;
    const scaleY = h / geoH;
    const s = Math.min(scaleX, scaleY) * 0.9;

    const geoMidLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    const geoMidLng = (this.bounds.minLng + this.bounds.maxLng) / 2;

    return {
      lat: geoMidLat - ry / s,
      lng: geoMidLng + rx / (latCorrectionFactor * s)
    };
  }

  // === RENDERIZADO ===

  private render(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Always reset to DPR-only transform to guarantee a clean slate each frame
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Solid viewport background (theme — fixed while panning/zooming)
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, w, h);

    // Transformaciones
    this.ctx.save();
    this.ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    this.ctx.rotate(this.rotation);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.translate(-w / 2, -h / 2);

    // Ground layers in map space: backdrop → park base → sections (zones)
    if (this.mapOptions.showGroundTextures) {
      const lo = this.layerOffsets.sections;
      this.ctx.save();
      this.ctx.translate(lo.x, lo.y);
      this.drawMapGroundBackdrop(w, h);
      if (this.mapOptions.showTreesEffect) {
        this.drawPlacedBackdropTrees(w, h);
      }
      if (PARK_BOUNDARY.length >= 3) {
        this.drawParkGroundBase();
      }
      this.ctx.restore();
    }
    if (this.mapOptions.showSections) {
      const lo = this.layerOffsets.sections;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawSections(w, h);
      this.ctx.restore();
    }
    if (this.mapOptions.showBoundary) {
      const lo = this.layerOffsets.boundary;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawBoundary(w, h);
      this.ctx.restore();
    }
    if (this.mapOptions.showMarkers) {
      const lo = this.layerOffsets.markers;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawMarkerDots(w, h);
      this.ctx.restore();
    }

    if (this.treeEditorMode) {
      this.drawTreeEditorMarkers(w, h);
    }
    if (this.mapOptions.showTreesEffect) {
      this.treesEffect.drawWorld(this.ctx, this.buildTreesDrawOptions(w, h));
    }

    this.drawCameraPivotWorld(w, h);

    this.ctx.restore();

    // Capa ambiental (bajo referencias espaciales)
    const ambientClip = this.buildRainClipPath();
    const ambientToScreen = (bx: number, by: number) => this.baseCanvasToScreen(bx, by);
    if (this.mapOptions.showCloudShadows) {
      this.cloudShadowEffect.draw(this.ctx, ambientClip, ambientToScreen, this.scale);
    }
    if (this.mapOptions.showFogEffect) {
      this.fogEffect.draw(this.ctx, ambientClip, ambientToScreen, this.scale);
    }
    if (this.mapOptions.showNightMistEffect) {
      this.nightMistEffect.draw(
        this.ctx, ambientClip, ambientToScreen, this.scale, this.isDarkTheme, w, h,
      );
    }
    if (this.mapOptions.showRainEffect) {
      this.rainEffect.draw(this.ctx, ambientClip, ambientToScreen, this.scale);
    }
    if (this.mapOptions.showMotesEffect) {
      this.motesEffect.draw(this.ctx, ambientClip, ambientToScreen, this.scale);
    }
    if (this.mapOptions.showLeavesEffect) {
      this.leavesEffect.draw(this.ctx, ambientClip, ambientToScreen, this.scale);
    }
    if (this.mapOptions.showLightningEffect) {
      this.lightningEffect.draw(this.ctx, ambientClip, w, h);
    }
    this.drawAmbientScenarioTint(ambientClip, w, h);
    if (this.mapOptions.showSpatialReferences) {
      this.spatialRefLayer.draw(this.ctx, this.spatialReferences, {
        geoToScreen: (geo) => this.geoToScreen(geo),
        phase: this.spatialRefsPhase,
        viewportW: w,
        viewportH: h,
        placeIndex: this.spatialReferencePlaceIndex,
        selectedIndex: this.selectedSpatialReferenceIndex,
        fichaIndex: this.playerSpatialRefIndex ?? -1,
      });
    }

    // Section names (screen-space, always readable)
    if (this.mapOptions.showSections && this.mapOptions.showSectionLabels) {
      this.drawSectionLabels();
    }

    if (this.sectionEditorMode) {
      this.drawSectionEditorVertices();
    }

    // Marker labels (screen-space) — shift by markers layer offset converted to screen delta
    if (this.mapOptions.showMarkers && this.mapOptions.showLabels) {
      const lo = this.layerOffsets.markers;
      if (lo.x !== 0 || lo.y !== 0) {
        const s = this.scale;
        const c = Math.cos(this.rotation);
        const sn = Math.sin(this.rotation);
        const sdx = (lo.x * c - lo.y * sn) * s;
        const sdy = (lo.x * sn + lo.y * c) * s;
        this.ctx.save();
        this.ctx.translate(sdx, sdy);
        this.drawMarkerLabels();
        this.ctx.restore();
      } else {
        this.drawMarkerLabels();
      }
    }

    if (!this.sectionEditorMode) {
      this.drawCameraReticle(w, h, dpr);
    }
  }

  /** Anilla en el mapa: punto de mira de la cámara (se desplaza al panear). */
  private drawCameraPivotWorld(w: number, h: number): void {
    const pivot = this.getCameraMapPoint(w, h);
    const r = 5 / this.scale;
    const arm = 9 / this.scale;
    const color = this.theme.accent;
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = this.isDarkTheme ? 'rgba(124,77,255,0.22)' : 'rgba(46,125,50,0.22)';
    this.ctx.lineWidth = 1.4 / this.scale;
    this.ctx.globalAlpha = 0.85;
    this.ctx.beginPath();
    this.ctx.arc(pivot.x, pivot.y, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(pivot.x - arm, pivot.y);
    this.ctx.lineTo(pivot.x + arm, pivot.y);
    this.ctx.moveTo(pivot.x, pivot.y - arm);
    this.ctx.lineTo(pivot.x, pivot.y + arm);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  /** Retícula fija en pantalla = centro óptico de la cámara. */
  private drawCameraReticle(w: number, h: number, dpr: number): void {
    const cx = w / 2;
    const cy = h / 2;
    const color = this.theme.accent;
    this.ctx.save();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.65;
    this.ctx.lineWidth = 1;
    const r = 14;
    const gap = 5;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cx - r - gap, cy);
    this.ctx.lineTo(cx - 2, cy);
    this.ctx.moveTo(cx + 2, cy);
    this.ctx.lineTo(cx + r + gap, cy);
    this.ctx.moveTo(cx, cy - r - gap);
    this.ctx.lineTo(cx, cy - 2);
    this.ctx.moveTo(cx, cy + 2);
    this.ctx.lineTo(cx, cy + r + gap);
    this.ctx.stroke();
    this.ctx.globalAlpha = 0.95;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private getCameraMapPoint(w: number, h: number): { x: number; y: number } {
    return this.screenToMap(w / 2, h / 2);
  }

  private getCameraScreenCenter(): { x: number; y: number } {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvasRef.nativeElement.width / dpr;
    const h = this.canvasRef.nativeElement.height / dpr;
    return { x: w / 2, y: h / 2 };
  }

  private clampZoom(scale: number): number {
    return Math.max(PARK_MAP_VIS.zoomMin, Math.min(PARK_MAP_VIS.zoomMax, scale));
  }

  private beginCameraZoomFocus(): void {
    const { x, y } = this.getCameraScreenCenter();
    this.beginZoomFocus(x, y);
  }

  private drawGrid(w: number, h: number): void {
    this.ctx.strokeStyle = this.theme.grid;
    this.ctx.lineWidth = 0.5 / this.scale;
    this.ctx.font = `${9 / this.scale}px monospace`;
    this.ctx.fillStyle = this.theme.gridText;

    const interval = 0.0005;
    const startLat = Math.ceil(this.bounds.minLat / interval) * interval;
    const startLng = Math.ceil(this.bounds.minLng / interval) * interval;

    for (let lat = startLat; lat <= this.bounds.maxLat; lat += interval) {
      const p1 = this.geoToCanvas({ lat, lng: this.bounds.minLng });
      const p2 = this.geoToCanvas({ lat, lng: this.bounds.maxLng });
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }

    for (let lng = startLng; lng <= this.bounds.maxLng; lng += interval) {
      const p1 = this.geoToCanvas({ lat: this.bounds.minLat, lng });
      const p2 = this.geoToCanvas({ lat: this.bounds.maxLat, lng });
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
  }

  private drawPlacedBackdropTrees(w: number, h: number): void {
    this.treesEffect.drawBackdrop(this.ctx, this.buildTreesDrawOptions(w, h));
  }

  private buildTreesDrawOptions(w: number, h: number) {
    return {
      geoToCanvas: (geo: GeoPoint) => this.geoToCanvas(geo),
      isParkTreeVisible: (slot: AmbientTreeSlot, geo: GeoPoint) => {
        if (isBackdropTreeSlot(slot)) return false;
        const polygon = this.editableSections[slot.section]?.polygon;
        if (!polygon?.length) return isPointInPolygon(geo, PARK_BOUNDARY);
        return isPointInPolygon(geo, polygon);
      },
      isBackdropTreeVisible: (slot: AmbientTreeSlot, geo: GeoPoint) => {
        if (!isBackdropTreeSlot(slot)) return false;
        return isGeoInBackdropFrame(geo, PARK_BOUNDARY);
      },
      viewport: this.getWorldViewportBounds(w, h),
      isDark: this.isDarkTheme,
      baseHeight: PARK_MAP_VIS.treeBaseWorld,
      wind: this.getEffectWind(this.mapOptions.treesWindDeg),
    };
  }

  get treeEditorBannerText(): string {
    if (this.treePlaceActive) {
      if (this.treeEditorSectionIndex === BACKDROP_TREE_SECTION) {
        return 'Modo colocar: click fuera del parque (varios seguidos). Click en marcador = editar · arrastrar = mover.';
      }
      return 'Modo colocar: click en la zona activa (varios seguidos). Click en marcador = editar · arrastrar = mover.';
    }
    if (this.selectedTreeIndex !== null) {
      return 'Árbol seleccionado — ajusta en el panel, arrastra en el mapa, o pulsa «Modo colocar» para añadir más.';
    }
    return 'Elige zona y silueta · «Modo colocar» activo al abrir el editor.';
  }

  private drawMapGroundBackdrop(w: number, h: number): void {
    const pad = Math.max(w, h) * 2;
    fillMapRectWithBackdrop(
      this.ctx,
      -pad,
      -pad,
      w + pad * 2,
      h + pad * 2,
      this.isDarkTheme,
      this.mapBackdropCache,
      this.scale,
    );
  }

  private drawParkGroundBase(): void {
    const points = PARK_BOUNDARY.map(g => this.geoToCanvas(g));
    fillPolygonWithGroundTexture(
      this.ctx,
      points,
      -1,
      this.isDarkTheme,
      this.theme.boundaryFill,
      this.isDarkTheme ? PARK_MAP_VIS.parkBaseTintDark : PARK_MAP_VIS.parkBaseTintLight,
      this.groundPatternCache,
      this.scale,
    );
  }

  private drawSections(w: number, h: number): void {
    const sections = toParkSectionsView(this.editableSections);
    sections.forEach((section, idx) => {
      if (section.polygon.length < 3) return;

      const record = this.editableSections[idx];
      const points = section.polygon.map(g => this.geoToCanvas(g));
      const isHovered = idx === this.hoveredSectionIndex;
      const isActive = this.sectionEditorMode
        ? idx === this.sectionEditorIndex
        : idx === this.playerFichaSectionIndex;
      const boosted = isHovered || isActive;
      const { dark, light } = resolveSectionFillOpacities(record);
      const zoneIdx = this.mapOptions.rainSectionIndex;
      const inScenarioZone = !!this.ambientScenarioId
        && (zoneIdx < 0 || idx === zoneIdx);
      const scenarioBoost = inScenarioZone ? this.ambientSectionOpacityBoost : 0;
      const drawOpDark = Math.min(dark + scenarioBoost + (boosted ? 0.12 : 0), 1);
      const drawOpLight = Math.min(light + scenarioBoost * 0.7 + (boosted ? 0.08 : 0), 1);
      const effectiveOp = this.isDarkTheme ? drawOpDark : drawOpLight;
      const fill = fillColorsFromHex(record.chartColor, drawOpDark, drawOpLight);
      const fillColor = this.isDarkTheme ? fill.webFill : fill.webFillLight;

      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.closePath();

      if (effectiveOp > 0) {
        if (this.mapOptions.showGroundTextures) {
          fillPolygonWithGroundTexture(
            this.ctx,
            points,
            idx,
            this.isDarkTheme,
            fillColor,
            parkGroundTintOpacity(effectiveOp),
            this.groundPatternCache,
            this.scale,
          );
        } else {
          this.ctx.fillStyle = fillColor;
          this.ctx.fill();
        }
      }

      // Contorno solo al hover (o zona activa en editor de secciones)
      const showStroke = isHovered || (this.sectionEditorMode && isActive);
      if (showStroke) {
        const strokeW = (isHovered ? PARK_MAP_VIS.sectionStrokeHover : PARK_MAP_VIS.sectionStrokeActive) / this.scale;
        this.ctx.strokeStyle = record.chartColor;
        this.ctx.lineWidth = strokeW;
        if (isHovered) {
          this.ctx.shadowColor = record.chartColor;
          this.ctx.shadowBlur = 10 / this.scale;
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }
    });
  }

  private drawBoundary(w: number, h: number): void {
    if (PARK_BOUNDARY.length < 3) return;

    const points = PARK_BOUNDARY.map(g => this.geoToCanvas(g));

    if (!this.mapOptions.showGroundTextures) {
      this.ctx.fillStyle = this.theme.boundaryFill;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    this.ctx.strokeStyle = this.theme.boundary;
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.stroke();

    const vertexRadius = 2 / this.scale;
    this.ctx.fillStyle = this.theme.text;
    points.forEach((p) => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, vertexRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  /** Nombres de ecosistema — pantalla fija, siempre legibles (P0). */
  private drawSectionLabels(): void {
    const sections = toParkSectionsView(this.editableSections);
    for (const { name, geo } of sectionLabelCentroids(sections)) {
      const screenPos = this.geoToScreen(geo);
      this.ctx.font = 'bold 12px sans-serif';
      const textWidth = this.ctx.measureText(name).width + 14;
      const textHeight = 18;

      this.ctx.fillStyle = this.isDarkTheme ? 'rgba(0, 0, 0, 0.78)' : 'rgba(255, 255, 255, 0.92)';
      this.ctx.beginPath();
      this.ctx.roundRect(screenPos.x - textWidth / 2, screenPos.y - textHeight / 2, textWidth, textHeight, 6);
      this.ctx.fill();

      this.ctx.fillStyle = this.isDarkTheme ? '#ffffff' : '#212121';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(name, screenPos.x, screenPos.y);
    }
  }

  /** Vértices de la sección activa con etiquetas lat/lng (editor manual). */
  private drawSectionEditorVertices(): void {
    const section = this.editableSections[this.sectionEditorIndex];
    if (!section) return;

    const lo = this.layerOffsets.sections;
    const sdx = lo.x * this.scale;
    const sdy = lo.y * this.scale;

    section.polygon.forEach((geo, vi) => {
      const base = this.geoToScreen(geo);
      const screenPos = { x: base.x + sdx, y: base.y + sdy };
      const selected = vi === this.sectionEditorSelectedVertex;
      const radius = selected ? 9 : 7;

      this.ctx.fillStyle = selected ? '#ff9800' : '#ffffff';
      this.ctx.strokeStyle = selected ? '#e65100' : '#ff9800';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      const label = `${vi + 1}: ${geo.lat.toFixed(8)}, ${geo.lng.toFixed(8)}`;
      this.ctx.font = '10px monospace';
      const tw = this.ctx.measureText(label).width + 8;
      const lx = screenPos.x + 12;
      const ly = screenPos.y - 10;

      this.ctx.fillStyle = this.isDarkTheme ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
      this.ctx.strokeStyle = selected ? '#ff9800' : 'rgba(255,152,0,0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(lx, ly - 10, tw, 16, 4);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = this.isDarkTheme ? '#fff' : '#212121';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, lx + 4, ly - 2);
    });
  }

  private hitTestSectionVertex(screenX: number, screenY: number): number | null {
    const section = this.editableSections[this.sectionEditorIndex];
    if (!section) return null;

    const threshold = 14;
    const lo = this.layerOffsets.sections;
    const sdx = lo.x * this.scale;
    const sdy = lo.y * this.scale;

    for (let vi = section.polygon.length - 1; vi >= 0; vi--) {
      const sp = this.geoToScreen(section.polygon[vi]);
      const dx = screenX - (sp.x + sdx);
      const dy = screenY - (sp.y + sdy);
      if (dx * dx + dy * dy <= threshold * threshold) return vi;
    }
    return null;
  }

  // ── API editor de secciones (panel lateral) ─────────────────

  setSectionEditorMode(enabled: boolean): void {
    this.sectionEditorMode = enabled;
    if (enabled) {
      this.mapOptions.showSections = true;
      this.mapOptions.showBoundary = true;
    } else {
      this.hoveredSectionIndex = -1;
    }
    if (!enabled) {
      this.sectionEditorAddVertexMode = false;
      this.sectionEditorSelectedVertex = null;
      this.draggingSectionVertex = false;
    }
    this.render();
  }

  onZoneButtonClick(index: number): void {
    this.focusZone(index);
  }

  /** Encuadra zona + abre ficha (vista jugador) o selecciona en editor. */
  focusZone(index: number): void {
    if (index < 0 || index >= this.editableSections.length) return;
    if (this.sectionEditorMode) {
      this.setSectionEditorIndex(index);
    } else {
      this.openPlayerFicha(index);
      this.fitSectionToView(index);
    }
  }

  /**
   * Encuadra el polígono de la sección para que ocupe ~fill de la pantalla (animado).
   */
  fitSectionToView(index: number, fill = 0.88): void {
    if (!this.isBrowser || !this.canvasRef?.nativeElement) return;
    const section = this.editableSections[index];
    if (!section?.polygon?.length) return;

    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const cx = w / 2;
    const cy = h / 2;

    const basePoints = section.polygon.map(g => this.geoToCanvas(g));
    const bcx = basePoints.reduce((s, p) => s + p.x, 0) / basePoints.length;
    const bcy = basePoints.reduce((s, p) => s + p.y, 0) / basePoints.length;

    const rot = this.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const centroidRelX = (bcx - cx) * cos - (bcy - cy) * sin;
    const centroidRelY = (bcx - cx) * sin + (bcy - cy) * cos;

    let minDx = Infinity;
    let maxDx = -Infinity;
    let minDy = Infinity;
    let maxDy = -Infinity;
    for (const p of basePoints) {
      const rdx = (p.x - cx) * cos - (p.y - cy) * sin - centroidRelX;
      const rdy = (p.x - cx) * sin + (p.y - cy) * cos - centroidRelY;
      minDx = Math.min(minDx, rdx);
      maxDx = Math.max(maxDx, rdx);
      minDy = Math.min(minDy, rdy);
      maxDy = Math.max(maxDy, rdy);
    }

    const baseW = Math.max(maxDx - minDx, 1);
    const baseH = Math.max(maxDy - minDy, 1);
    const margin = (1 - fill) / 2;
    const availW = w * (1 - 2 * margin);
    const availH = h * (1 - 2 * margin);

    let newScale = Math.min(availW / baseW, availH / baseH);
    newScale = this.clampZoom(newScale);

    const dx0 = (bcx - cx) * newScale;
    const dy0 = (bcy - cy) * newScale;
    const rx = cos * dx0 - sin * dy0;
    const ry = sin * dx0 + cos * dy0;

    this._hasZoomAnchor = false;
    this.sectionFocusAnimating = true;
    this.targetScale = newScale;
    this.targetOffsetX = w / 2 - cx - rx;
    this.targetOffsetY = h / 2 - cy - ry;
    this.saveState();
    this.emitViewInfo();
  }

  openPlayerFicha(index: number): void {
    if (index < 0 || index >= this.editableSections.length) return;
    this.playerFichaSectionIndex = index;
    this.render();
  }

  closePlayerFicha(): void {
    this.playerFichaSectionIndex = null;
    this.render();
  }

  openSpatialRefFicha(index: number): void {
    if (index < 0 || index >= this.spatialReferences.length) return;
    this.playerSpatialRefIndex = index;
    this.selectedSpatialReferenceIndex = index;
    this.render();
  }

  closeSpatialRefFicha(): void {
    this.playerSpatialRefIndex = null;
    this.render();
  }

  updateSpatialReference(index: number, patch: Partial<SpatialReference>): void {
    const ref = this.spatialReferences[index];
    if (!ref) return;
    Object.assign(ref, patch);
    if (patch.summary !== undefined && !ref.education) {
      ref.education = { summary: patch.summary };
    }
    this.emitSpatialReferencesChanged();
    this.render();
  }

  setSelectedSpatialReferenceIndex(index: number): void {
    this.selectedSpatialReferenceIndex = index;
    this.render();
  }

  /** Plano del mapa (coords. base canvas) → pantalla, respeta zoom/rotación/pan. */
  private baseCanvasToScreen(bx: number, by: number): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    let x = bx - cx;
    let y = by - cy;
    x *= this.scale;
    y *= this.scale;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return {
      x: cos * x - sin * y + cx + this.offsetX,
      y: sin * x + cos * y + cy + this.offsetY,
    };
  }

  private getParkMapPlaneBounds(): MapPlaneBounds {
    const pts = PARK_BOUNDARY.map((g) => this.geoToCanvas(g));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY };
  }

  private hitTestSectionAtGeo(geo: GeoPoint): number {
    for (let i = this.editableSections.length - 1; i >= 0; i--) {
      if (isPointInPolygon(geo, this.editableSections[i].polygon)) return i;
    }
    return -1;
  }

  private updateSectionHover(x: number, y: number): void {
    if (this.sectionEditorMode || !this.mapOptions.showSections) return;
    if (this.isDragging || this.draggingSectionVertex) return;

    const geo = this.canvasToGeo({ x, y });
    const hit = this.hitTestSectionAtGeo(geo);
    if (hit !== this.hoveredSectionIndex) {
      this.hoveredSectionIndex = hit;
      this.render();
    }
  }

  setSectionEditorIndex(index: number): void {
    if (index < 0 || index >= this.editableSections.length) return;
    this.sectionEditorIndex = index;
    this.sectionEditorSelectedVertex = null;
    this.fitSectionToView(index);
    this.render();
  }

  setSectionEditorSelectedVertex(vertexIndex: number | null): void {
    this.sectionEditorSelectedVertex = vertexIndex;
    this.render();
  }

  setSectionEditorAddVertexMode(enabled: boolean): void {
    this.sectionEditorAddVertexMode = enabled;
    this.render();
  }

  get activeSectionRecord(): ParkSectionRecord | null {
    return this.editableSections[this.sectionEditorIndex] ?? null;
  }

  updateSectionColor(sectionIndex: number, hex: string): void {
    const section = this.editableSections[sectionIndex];
    if (!section) return;
    section.chartColor = hex;
    syncSectionFillColors(section);
    this.emitSectionsChanged();
    this.render();
  }

  updateSectionFillOpacity(
    sectionIndex: number,
    which: 'dark' | 'light',
    opacity: number,
  ): void {
    const section = this.editableSections[sectionIndex];
    if (!section) return;
    const v = Math.min(1, Math.max(0, opacity));
    if (which === 'dark') section.fillOpacity = v;
    else section.fillOpacityLight = v;
    syncSectionFillColors(section);
    this.emitSectionsChanged();
    this.render();
  }

  onEducationSummaryChange(summary: string): void {
    const section = this.editableSections[this.sectionEditorIndex];
    if (!section) return;
    if (!section.education) {
      section.education = { summary: '', referenceImageUrl: '' };
    }
    section.education.summary = summary;
    this.emitSectionsChanged();
  }

  onSectionReferenceImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file?.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const section = this.editableSections[this.sectionEditorIndex];
      if (!section) return;
      if (!section.education) {
        section.education = { summary: '', referenceImageUrl: '' };
      }
      section.education.referenceImageUrl = reader.result as string;
      this.emitSectionsChanged();
      this.render();
    };
    reader.readAsDataURL(file);
  }

  clearSectionReferenceImage(): void {
    const section = this.editableSections[this.sectionEditorIndex];
    if (!section?.education) return;
    section.education.referenceImageUrl = '';
    this.emitSectionsChanged();
    this.render();
  }

  getEditableSections(): ParkSectionRecord[] {
    return this.editableSections.map((s) => ({
      ...s,
      colors: { ...s.colors },
      polygon: s.polygon.map((p) => ({ ...p })),
      education: s.education
        ? { ...s.education }
        : { summary: '', referenceImageUrl: '' },
    }));
  }

  updateSectionVertex(sectionIndex: number, vertexIndex: number, lat: number, lng: number): void {
    const section = this.editableSections[sectionIndex];
    if (!section?.polygon[vertexIndex]) return;
    section.polygon[vertexIndex] = {
      lat: Number(lat.toFixed(8)),
      lng: Number(lng.toFixed(8)),
    };
    this.emitSectionsChanged();
    this.render();
  }

  addSectionVertex(sectionIndex: number, lat: number, lng: number): void {
    const section = this.editableSections[sectionIndex];
    if (!section) return;
    section.polygon.push({
      lat: Number(lat.toFixed(8)),
      lng: Number(lng.toFixed(8)),
    });
    this.sectionEditorSelectedVertex = section.polygon.length - 1;
    this.emitSectionsChanged();
    this.render();
  }

  deleteSectionVertex(sectionIndex: number, vertexIndex: number): void {
    const section = this.editableSections[sectionIndex];
    if (!section || section.polygon.length <= 3) return;
    section.polygon.splice(vertexIndex, 1);
    this.sectionEditorSelectedVertex = null;
    this.emitSectionsChanged();
    this.render();
  }

  resetSectionsToDefault(): void {
    this.editableSections = cloneParkSectionRecords();
    this.sectionEditorSelectedVertex = null;
    this.emitSectionsChanged();
    this.render();
  }

  exportSectionsJson(): string {
    return JSON.stringify(
      {
        version: 2,
        source: 'web-admin-manual-edit',
        partition: 'manual',
        syncedAt: new Date().toISOString(),
        sections: this.editableSections.map((s) => ({
          id: s.id,
          code: s.code,
          semanticKey: s.semanticKey,
          chartColor: s.chartColor,
          name: s.name,
          fillOpacity: s.fillOpacity,
          fillOpacityLight: s.fillOpacityLight,
          colors: s.colors,
          education: s.education
            ? {
                summary: s.education.summary ?? '',
                ...(s.education.referenceImageUrl
                  ? { referenceImageUrl: s.education.referenceImageUrl }
                  : {}),
              }
            : undefined,
          polygon: s.polygon.map((p) => ({
            lat: Number(p.lat.toFixed(8)),
            lng: Number(p.lng.toFixed(8)),
          })),
        })),
      },
      null,
      2,
    );
  }

  downloadSectionsJson(): void {
    const blob = new Blob([this.exportSectionsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'park-sections.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  setTreeEditorMode(enabled: boolean): void {
    this.treeEditorMode = enabled;
    if (!enabled) {
      this.treePlaceActive = false;
      this.selectedTreeIndex = null;
      this.draggingTreeIndex = null;
      this.treePlacementHint = '';
    } else {
      this.treePlaceActive = true;
    }
    this.emitTreeEditorState();
    this.render();
  }

  setTreePlaceActive(active: boolean): void {
    this.treePlaceActive = active;
    if (active) this.treePlacementHint = '';
    this.emitTreeEditorState();
    this.render();
  }

  setTreeEditorSectionIndex(index: number): void {
    if (index !== BACKDROP_TREE_SECTION && (index < 0 || index >= this.editableSections.length)) return;
    this.treeEditorSectionIndex = index;
    this.selectedTreeIndex = null;
    this.treePlacementHint = '';
    if (this.treeEditorMode) {
      this.treePlaceActive = true;
    }
    this.emitTreeEditorState();
    this.render();
  }

  setTreePlaceVariant(variant: 0 | 1 | 2): void {
    this.treePlaceVariant = variant;
    if (this.selectedTreeIndex !== null) {
      this.updateAmbientTree(this.selectedTreeIndex, { variant });
    } else {
      this.emitTreeEditorState();
    }
  }

  setTreePlaceStyleSection(section: number): void {
    this.treePlaceStyleSection = Math.min(2, Math.max(0, Math.floor(section)));
    if (this.selectedTreeIndex !== null) {
      const slot = this.ambientTrees[this.selectedTreeIndex];
      if (slot && isBackdropTreeSlot(slot)) {
        this.updateAmbientTree(this.selectedTreeIndex, { styleSection: this.treePlaceStyleSection });
      }
    } else {
      this.emitTreeEditorState();
    }
  }

  selectAmbientTree(index: number | null): void {
    this.selectedTreeIndex = index;
    if (index !== null && this.ambientTrees[index]) {
      const t = this.ambientTrees[index];
      this.treePlaceVariant = t.variant;
      if (isBackdropTreeSlot(t) && t.styleSection != null) {
        this.treePlaceStyleSection = t.styleSection;
      }
      this.treePlaceActive = false;
    } else if (this.treeEditorMode) {
      this.treePlaceActive = true;
    }
    this.treePlacementHint = '';
    this.emitTreeEditorState();
    this.render();
  }

  updateAmbientTree(index: number, patch: Partial<AmbientTreeSlot>): void {
    if (index < 0 || index >= this.ambientTrees.length) return;
    this.ambientTrees = this.ambientTrees.map((t, i) => (i === index ? { ...t, ...patch } : t));
    this.syncAmbientTrees();
    this.emitAmbientTreesChanged();
    this.emitTreeEditorState();
    this.render();
  }

  private canPlaceTreeAtGeo(geo: GeoPoint): boolean {
    return this.canPlaceTreeAtGeoForSection(geo, this.treeEditorSectionIndex);
  }

  private canPlaceTreeAtGeoForSection(geo: GeoPoint, section: number): boolean {
    if (section === BACKDROP_TREE_SECTION) {
      return isGeoInBackdropFrame(geo, PARK_BOUNDARY);
    }
    const sectionName = findParkSectionAt(geo.lat, geo.lng, this.editableSections);
    const expected = this.editableSections[section]?.name;
    return sectionName === expected && isGeoInPark(geo, PARK_BOUNDARY);
  }

  addAmbientTreeAtGeo(lat: number, lng: number): void {
    const geo = { lat, lng };
    if (!this.canPlaceTreeAtGeo(geo)) {
      this.treePlacementHint = this.treeEditorSectionIndex === BACKDROP_TREE_SECTION
        ? 'Debe quedar fuera del parque, en el marco visible.'
        : 'El click debe caer dentro de la zona activa.';
      this.emitTreeEditorState();
      this.render();
      return;
    }
    const slot: AmbientTreeSlot = {
      lat: Number(lat.toFixed(8)),
      lng: Number(lng.toFixed(8)),
      section: this.treeEditorSectionIndex,
      variant: this.treePlaceVariant,
      seed: Math.random() * 180,
      scale: 0.85 + Math.random() * 0.35,
    };
    if (this.treeEditorSectionIndex === BACKDROP_TREE_SECTION) {
      slot.styleSection = this.treePlaceStyleSection;
    }
    this.ambientTrees = [...this.ambientTrees, slot];
    this.selectedTreeIndex = this.ambientTrees.length - 1;
    this.treePlacementHint = '';
    this.syncAmbientTrees();
    this.emitAmbientTreesChanged();
    this.emitTreeEditorState();
    this.render();
  }

  moveAmbientTreeToGeo(index: number, lat: number, lng: number): boolean {
    if (index < 0 || index >= this.ambientTrees.length) return false;
    const section = this.ambientTrees[index].section;
    if (!this.canPlaceTreeAtGeoForSection({ lat, lng }, section)) return false;
    this.ambientTrees = this.ambientTrees.map((t, i) => (i === index
      ? { ...t, lat: Number(lat.toFixed(8)), lng: Number(lng.toFixed(8)) }
      : t));
    this.syncAmbientTrees();
    this.emitAmbientTreesChanged();
    this.render();
    return true;
  }

  removeAmbientTree(index: number): void {
    if (index < 0 || index >= this.ambientTrees.length) return;
    this.ambientTrees = this.ambientTrees.filter((_, i) => i !== index);
    if (this.selectedTreeIndex === index) this.selectedTreeIndex = null;
    else if (this.selectedTreeIndex !== null && this.selectedTreeIndex > index) {
      this.selectedTreeIndex--;
    }
    this.syncAmbientTrees();
    this.emitAmbientTreesChanged();
    this.emitTreeEditorState();
    this.render();
  }

  getAmbientTrees(): AmbientTreeSlot[] {
    return cloneAmbientTreeSlots(this.ambientTrees);
  }

  setAmbientTrees(slots: AmbientTreeSlot[]): void {
    this.ambientTrees = cloneAmbientTreeSlots(slots);
    this.syncAmbientTrees();
    this.emitAmbientTreesChanged();
    this.render();
  }

  downloadAmbientTreesJson(): void {
    const blob = new Blob([exportAmbientTreesJson(this.ambientTrees)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ambient-trees.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  private syncAmbientTrees(): void {
    this.treesEffect.setSlots(this.ambientTrees);
  }

  private emitAmbientTreesChanged(): void {
    this.ambientTreesChanged.emit(this.getAmbientTrees());
  }

  private emitTreeEditorState(): void {
    this.treeEditorStateChanged.emit({
      selectedTreeIndex: this.selectedTreeIndex,
      treePlaceVariant: this.treePlaceVariant,
      treePlaceStyleSection: this.treePlaceStyleSection,
      treePlacementHint: this.treePlacementHint,
    });
  }

  private hitTestTreeMarker(screenX: number, screenY: number): number {
    const hitR = 16;
    for (let i = this.ambientTrees.length - 1; i >= 0; i--) {
      const t = this.ambientTrees[i];
      if (t.section !== this.treeEditorSectionIndex) continue;
      const screen = this.geoToScreen({ lat: t.lat, lng: t.lng });
      const dx = screen.x - screenX;
      const dy = screen.y - screenY;
      if (dx * dx + dy * dy <= hitR * hitR) return i;
    }
    return -1;
  }

  private drawTreeEditorMarkers(w: number, h: number): void {
    const viewport = this.getWorldViewportBounds(w, h);
    const pad = 48;
    for (let i = 0; i < this.ambientTrees.length; i++) {
      const t = this.ambientTrees[i];
      const pos = this.geoToCanvas({ lat: t.lat, lng: t.lng });
      if (pos.x < viewport.minX - pad || pos.x > viewport.maxX + pad
        || pos.y < viewport.minY - pad || pos.y > viewport.maxY + pad) {
        continue;
      }
      const inActiveZone = t.section === this.treeEditorSectionIndex;
      const selected = i === this.selectedTreeIndex;
      const dragging = i === this.draggingTreeIndex;
      this.ctx.save();
      this.ctx.fillStyle = dragging ? '#ff5722' : (selected ? '#ff9800' : (inActiveZone ? '#4caf50' : 'rgba(120,120,120,0.75)'));
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.2 / this.scale;
      const r = (selected ? 5 : 4) / this.scale;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private emitSectionsChanged(): void {
    this.sectionsChanged.emit(this.getEditableSections());
  }

  private drawMarkerDots(w: number, h: number): void {
    const mRadius = this.markerRadius || this.MARKER_RADIUS;
    const markerRadius = mRadius / this.scale;
    const innerRadius = (mRadius * 0.4) / this.scale;
    const warningRadius = (mRadius * 1.6) / this.scale;

    this.markers.forEach(marker => {
      const p = this.geoToCanvas(marker.geo);
      const isInside = marker.isInsidePark;

      if (!isInside) {
        this.ctx.strokeStyle = this.theme.markerOutside;
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([3 / this.scale, 3 / this.scale]);
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, warningRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      this.ctx.fillStyle = isInside ? this.theme.markerInside : this.theme.markerOutside;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, markerRadius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = this.theme.text;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, innerRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  /**
   * Draws semi-transparent polygon zones for clusters (multiple anchors
   * sharing the same virtual asset). Uses a convex hull polygon when 3+
   * points exist, a dashed capsule for 2 points, or a pulsing ring for 1.
   */
  private drawClusterZones(w: number, h: number): void {
    if (!this.clusters || this.clusters.length === 0) return;

    // Section-based color map
    const clusterColors: Record<string, { fill: string; stroke: string }> = {
      'Tierras Altas':    { fill: 'rgba(139, 90, 43, 0.18)',  stroke: 'rgba(139, 90, 43, 0.6)' },
      'Tierras Medias':   { fill: 'rgba(76, 175, 80, 0.18)',  stroke: 'rgba(76, 175, 80, 0.6)' },
      'Tierras Bajas':    { fill: 'rgba(255, 193, 7, 0.18)',   stroke: 'rgba(255, 193, 7, 0.6)' },
    };
    const defaultColor = { fill: 'rgba(33, 150, 243, 0.18)', stroke: 'rgba(33, 150, 243, 0.6)' };

    this.clusters.forEach(cluster => {
      const colors = clusterColors[cluster.section] || defaultColor;

      if (cluster.polygon && cluster.polygon.length >= 3) {
        // Draw convex hull polygon with padding
        const points = cluster.polygon.map(p => this.geoToCanvas({ lat: p.lat, lng: p.lng }));

        this.ctx.fillStyle = colors.fill;
        this.ctx.strokeStyle = colors.stroke;
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw count badge at centroid
        const center = this.geoToCanvas(cluster.center);
        const fontSize = 12 / this.scale;
        this.ctx.font = `bold ${fontSize}px sans-serif`;
        const label = `×${cluster.count}`;
        const metrics = this.ctx.measureText(label);
        const badgeW = metrics.width + 8 / this.scale;
        const badgeH = fontSize + 6 / this.scale;

        this.ctx.fillStyle = colors.stroke;
        this.ctx.beginPath();
        this.ctx.roundRect(
          center.x - badgeW / 2, center.y - badgeH / 2,
          badgeW, badgeH, 4 / this.scale
        );
        this.ctx.fill();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, center.x, center.y);

      } else if (cluster.locations.length === 2) {
        // Two points — draw connecting dashed line with zone
        const p1 = this.geoToCanvas({ lat: cluster.locations[0].latitude, lng: cluster.locations[0].longitude });
        const p2 = this.geoToCanvas({ lat: cluster.locations[1].latitude, lng: cluster.locations[1].longitude });

        this.ctx.strokeStyle = colors.stroke;
        this.ctx.lineWidth = 3 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });
  }

  /** Set which layer is currently movable for independent dragging */
  setActiveMovableLayer(layer: 'canvas' | 'boundary' | 'sections' | 'markers'): void {
    this.activeMovableLayer = layer;
    this.render();
  }

  private drawMarkerLabels(): void {
    if (!this.mapOptions.showLabels) return;

    this.markers.forEach(marker => {
      const screenPos = this.geoToScreen(marker.geo);
      const isInside = marker.isInsidePark;

      this.ctx.font = 'bold 11px sans-serif';
      const textMetrics = this.ctx.measureText(marker.name);
      const textWidth = textMetrics.width + 10;
      const textHeight = 16;

      this.ctx.fillStyle = isInside
        ? (this.isDarkTheme ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)')
        : 'rgba(80, 0, 0, 0.9)';
      this.ctx.beginPath();
      this.ctx.roundRect(screenPos.x - textWidth / 2, screenPos.y - 32, textWidth, textHeight, 4);
      this.ctx.fill();

      this.ctx.fillStyle = isInside ? this.theme.text : '#ffcccc';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(marker.name, screenPos.x, screenPos.y - 24);

      if (!isInside) {
        this.ctx.fillStyle = '#ff6666';
        this.ctx.font = '9px sans-serif';
        this.ctx.fillText('⚠ FUERA', screenPos.x, screenPos.y + 22);
      }
    });
  }

  private drawScale(w: number, h: number): void {
    const scaleBarWidth = 100;
    const x = w - scaleBarWidth - 20;
    const y = h - 30;

    const degreesPerPixel = (this.bounds.maxLng - this.bounds.minLng) / w / this.scale;
    const metersPerPixel = degreesPerPixel * METERS_PER_DEG_LNG;
    const meters = Math.round(scaleBarWidth * metersPerPixel);

    this.ctx.fillStyle = this.isDarkTheme ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    this.ctx.fillRect(x - 5, y - 18, scaleBarWidth + 10, 28);

    this.ctx.fillStyle = this.theme.scale;
    this.ctx.fillRect(x, y, scaleBarWidth, 4);

    this.ctx.fillStyle = this.theme.text;
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillText(`${meters}m`, x + scaleBarWidth / 2, y - 5);
  }

  // === EVENTOS ===

  onMouseDown(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointerMovedSinceDown = false;
    this.pointerDownX = e.clientX;
    this.pointerDownY = e.clientY;

    if (this.treeEditorMode && this.treePlaceActive && e.button === 0) {
      return;
    }

    if (this.treeEditorMode && !this.treePlaceActive && e.button === 0) {
      const hit = this.hitTestTreeMarker(x, y);
      if (hit >= 0) {
        this.selectAmbientTree(hit);
        this.draggingTreeIndex = hit;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        return;
      }
    }

    // ── Section polygon editor ─────────────────────────────
    if (this.sectionEditorMode && e.button === 0) {
      const vertexHit = this.hitTestSectionVertex(x, y);
      if (vertexHit !== null) {
        this.sectionEditorSelectedVertex = vertexHit;
        this.draggingSectionVertex = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.emitSectionsChanged();
        this.render();
        return;
      }
      if (!this.sectionEditorAddVertexMode) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        const container = this.canvasRef.nativeElement.parentElement;
        if (container) container.style.cursor = 'grabbing';
      }
      return;
    }

    // Vista jugador: tap en zona — no iniciar pan hasta confirmar que no es drag
    if (e.button === 0 && !this.sectionEditorMode
        && !this.coordPickerMode && this.mapOptions.showSections) {
      const geo = this.canvasToGeo({ x, y });
      const hit = this.hitTestSectionAtGeo(geo);
      if (hit >= 0) {
        this.pendingZoneTapIndex = hit;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        return;
      }
    }

    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const container = this.canvasRef.nativeElement.parentElement;
    if (container) {
      container.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.lastPointerOnCanvas = { x, y, valid: true };

    if (!this.pointerMovedSinceDown) {
      const dx = e.clientX - this.pointerDownX;
      const dy = e.clientY - this.pointerDownY;
      if (dx * dx + dy * dy > 16) this.pointerMovedSinceDown = true;
    }

    if (this.pendingZoneTapIndex >= 0 && this.pointerMovedSinceDown) {
      this.isDragging = true;
      this.pendingZoneTapIndex = -1;
    }

    const geo = this.canvasToGeo({ x, y });
    this._cursorLat = geo.lat;
    this._cursorLng = geo.lng;

    if (this.draggingSectionVertex && this.sectionEditorSelectedVertex !== null) {
      this.updateSectionVertex(
        this.sectionEditorIndex,
        this.sectionEditorSelectedVertex,
        geo.lat,
        geo.lng,
      );
      return;
    }

    if (this.draggingTreeIndex !== null) {
      const idx = this.draggingTreeIndex;
      const t = this.ambientTrees[idx];
      if (t) {
        const ok = this.moveAmbientTreeToGeo(idx, geo.lat, geo.lng);
        this.treePlacementHint = ok ? '' : 'Posición inválida para esta zona.';
        if (!ok) this.emitTreeEditorState();
      }
      return;
    }

    this.updateSectionHover(x, y);

    if (!this.isDragging) {
      // Throttle: skip expensive hit-test if cursor barely moved
      const movedEnough =
        Math.abs(x - this.lastCursorX) >= this.CURSOR_MOVE_THRESHOLD ||
        Math.abs(y - this.lastCursorY) >= this.CURSOR_MOVE_THRESHOLD;

      if (!movedEnough) return; // no cursor update needed
      this.lastCursorX = x;
      this.lastCursorY = y;

      let overInteractive = false;
      let cursorType = 'grab';

      for (const marker of this.markers) {
          const mp = this.geoToScreen(marker.geo);
          const dx = x - mp.x;
          const dy = y - mp.y;
          if (Math.sqrt(dx * dx + dy * dy) < (this.markerRadius || this.MARKER_RADIUS) + 5) {
            overInteractive = true;
            cursorType = 'pointer';
            break;
          }
      }

      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        if (overInteractive) {
          container.style.cursor = cursorType;
        } else {
          container.style.cursor = 'grab';
        }
      }
    }

    if (this.isDragging) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (this.activeMovableLayer === 'canvas') {
        this.offsetX += dx;
        this.offsetY += dy;
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
      } else {
        const c = Math.cos(-this.rotation);
        const sn = Math.sin(-this.rotation);
        const mdx = (dx * c - dy * sn) / this.scale;
        const mdy = (dx * sn + dy * c) / this.scale;
        const lo = this.layerOffsets[this.activeMovableLayer];
        lo.x += mdx;
        lo.y += mdy;
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.render();
    }
  }

  onMouseUp(): void {
    if (this.draggingTreeIndex !== null) {
      this.draggingTreeIndex = null;
      this.emitTreeEditorState();
    }
    if (this.draggingSectionVertex) {
      this.draggingSectionVertex = false;
    }
    if (this.pendingZoneTapIndex >= 0) {
      if (!this.pointerMovedSinceDown) {
        this.focusZone(this.pendingZoneTapIndex);
      }
      this.pendingZoneTapIndex = -1;
      return;
    }
    if (this.isDragging) {
      this.isDragging = false;
      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        container.style.cursor = 'grab';
      }
      this.saveState();
    }
  }

  onMouseLeave(): void {
    this.isDragging = false;
    this.pendingZoneTapIndex = -1;
    this.stopContinuousRotation();
    if (this.hoveredSectionIndex >= 0) {
      this.hoveredSectionIndex = -1;
      this.render();
    }
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvasRef.nativeElement.width / dpr;
    const h = this.canvasRef.nativeElement.height / dpr;
    const factor = e.deltaY > 0 ? PARK_MAP_VIS.zoomWheelOut : PARK_MAP_VIS.zoomWheelIn;
    const newScale = this.clampZoom(this.scale * factor);
    if (Math.abs(newScale - this.scale) < 0.0001) return;

    this.beginZoomFocus(w / 2, h / 2);
    this.scale = newScale;
    this.targetScale = newScale;
    this.applyZoomFocus(this.scale);
    this._hasZoomAnchor = false;
    this._zoomFocusScreen = null;
    this._zoomFocusMap = null;
    this.render();
    this.saveState();
    this.emitViewInfo();
  }

  /** Mantiene fijo el punto del mapa bajo el cursor al cambiar escala (respeta rotación). */
  private beginZoomFocus(sx: number, sy: number): void {
    this._zoomFocusScreen = { x: sx, y: sy };
    this._zoomFocusMap = this.screenToMap(sx, sy);
    this._hasZoomAnchor = true;
  }

  private applyZoomFocus(scale: number): void {
    if (!this._zoomFocusMap || !this._zoomFocusScreen) return;
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const mapPt = this._zoomFocusMap;
    let mx = mapPt.x - cx;
    let my = mapPt.y - cy;
    mx *= scale;
    my *= scale;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * mx - sin * my;
    const ry = sin * mx + cos * my;
    this.offsetX = this._zoomFocusScreen.x - rx - cx;
    this.offsetY = this._zoomFocusScreen.y - ry - cy;
    this.targetOffsetX = this.offsetX;
    this.targetOffsetY = this.offsetY;
  }

  onClick(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ── Section editor: add vertex on map click ─────────────
    if (this.sectionEditorMode && this.sectionEditorAddVertexMode) {
      const geo = this.canvasToGeo({ x, y });
      this.addSectionVertex(this.sectionEditorIndex, geo.lat, geo.lng);
      return;
    }

    // ── Colocar árbol ambiental ─────────────────────────────
    if (this.treeEditorMode && this.treePlaceActive && !this.pointerMovedSinceDown) {
      const geo = this.canvasToGeo({ x, y });
      this.addAmbientTreeAtGeo(geo.lat, geo.lng);
      return;
    }

    // ── Seleccionar árbol (tap sin arrastre) ────────────────
    if (this.treeEditorMode && !this.treePlaceActive && !this.pointerMovedSinceDown) {
      const hit = this.hitTestTreeMarker(x, y);
      if (hit >= 0) {
        this.selectAmbientTree(hit);
        return;
      }
      this.selectAmbientTree(null);
    }

    // ── Colocar referencia espacial ─────────────────────────
    if (this.spatialReferencePlaceIndex >= 0 && !this.pointerMovedSinceDown) {
      const geo = this.canvasToGeo({ x, y });
      const ref = this.spatialReferences[this.spatialReferencePlaceIndex];
      if (ref && isGeoInPark(geo, PARK_BOUNDARY)) {
        ref.lat = Number(geo.lat.toFixed(8));
        ref.lng = Number(geo.lng.toFixed(8));
        this.emitSpatialReferencesChanged();
        this.render();
      }
      return;
    }

    // ── Section editor: tap inside polygon selects zone ─────
    if (this.sectionEditorMode && !this.pointerMovedSinceDown) {
      const geo = this.canvasToGeo({ x, y });
      const hit = this.hitTestSectionAtGeo(geo);
      if (hit >= 0) {
        this.setSectionEditorIndex(hit);
        return;
      }
    }

    // ── Vista jugador: referencia espacial → ficha ──────────
    if (!this.sectionEditorMode && !this.coordPickerMode
        && !this.pointerMovedSinceDown && this.mapOptions.showSpatialReferences) {
      const refHit = this.spatialRefLayer.hitTest(
        this.spatialReferences, x, y, (geo) => this.geoToScreen(geo),
      );
      if (refHit >= 0) {
        this.openSpatialRefFicha(refHit);
        return;
      }
    }

    // ── Normal mode: copy coords + check anchor click ───────
    if (this.coordPickerMode) {
      const geo = this.canvasToGeo({ x, y });
      const coords = `${geo.lat.toFixed(8)}, ${geo.lng.toFixed(8)}`;
      navigator.clipboard.writeText(coords).then(() => {
        this.lastCopiedCoords = coords;
        this.showCopyToast = true;
        setTimeout(() => this.showCopyToast = false, 2500);
      });
      return; // coord picker mode — no other click actions
    }

    const geo = this.canvasToGeo({ x, y });
    const coords = `${geo.lat.toFixed(8)}, ${geo.lng.toFixed(8)}`;

    navigator.clipboard.writeText(coords).then(() => {
      this.lastCopiedCoords = coords;
      this.showCopyToast = true;
      setTimeout(() => this.showCopyToast = false, 2500);
    });

    for (const marker of this.markers) {
      const mp = this.geoToScreen(marker.geo);
      const dx = x - mp.x;
      const dy = y - mp.y;
      if (Math.sqrt(dx*dx + dy*dy) < (this.markerRadius || this.MARKER_RADIUS) + 5) {
        this.anchorClick.emit(marker.id);
        break;
      }
    }
  }

  setMapOption(option: 'showSections' | 'showLabels' | 'showBoundary' | 'showMarkers' | 'showGroundTextures', value: boolean): void {
    this.mapOptions[option] = value;
    this.onOptionChange();
    this.emitViewInfo();
  }

  setGroundTilePx(px: number): void {
    const next = clampGroundTilePx(px);
    if (next === this.mapOptions.groundTilePx) return;
    this.mapOptions.groundTilePx = next;
    this.groundPatternCache.setTilePx(next);
    this.mapBackdropCache.setTilePx(next);
    this.onOptionChange();
    this.emitViewInfo();
  }

  getGroundStyleSnapshot(): Record<number, ZoneGroundStyle> {
    return exportGroundStyleSnapshot();
  }

  applyGroundStyle(snapshot: Record<number, ZoneGroundStyle> | null | undefined): void {
    importGroundStyleSnapshot(snapshot);
    this.invalidateGroundPatterns();
  }

  setGroundStyleZone(sectionIndex: number, style: ZoneGroundStyle): void {
    updateGroundStyleZone(sectionIndex, style);
    this.invalidateGroundPatterns();
  }

  resetGroundStyleZone(sectionIndex: number): void {
    resetGroundStyleZone(sectionIndex);
    this.invalidateGroundPatterns();
  }

  resetGroundStyleAll(): void {
    resetGroundStyleToDefaults();
    this.invalidateGroundPatterns();
  }

  private invalidateGroundPatterns(): void {
    this.groundPatternCache.clear();
    this.mapBackdropCache.clear();
    this.onOptionChange();
    this.render();
    this.emitViewInfo();
  }

  setMapSceneOption(
    option:
      | 'showSpatialReferences'
      | 'showRainEffect'
      | 'showFogEffect'
      | 'showMotesEffect'
      | 'showCloudShadows'
      | 'showLeavesEffect'
      | 'showTreesEffect'
      | 'showLightningEffect'
      | 'showNightMistEffect',
    value: boolean,
  ): void {
    this.mapOptions[option] = value;
    if (option === 'showRainEffect' && !value) this.rainEffect.clear();
    if (option === 'showFogEffect' && !value) this.fogEffect.clear();
    if (option === 'showMotesEffect' && !value) this.motesEffect.clear();
    if (option === 'showCloudShadows' && !value) this.cloudShadowEffect.clear();
    if (option === 'showLeavesEffect' && !value) this.leavesEffect.clear();
    if (option === 'showLightningEffect') {
      this.lightningEffect.setEnabled(value);
      if (!value) this.lightningEffect.clear();
    }
    if (option === 'showNightMistEffect' && !value) this.nightMistEffect.clear();
    this.onOptionChange();
    this.emitViewInfo();
  }

  private hasActiveAmbientEffects(): boolean {
    return this.mapOptions.showRainEffect
      || this.mapOptions.showFogEffect
      || this.mapOptions.showMotesEffect
      || this.mapOptions.showCloudShadows
      || this.mapOptions.showLeavesEffect
      || this.mapOptions.showLightningEffect
      || (this.mapOptions.showNightMistEffect && this.isDarkTheme);
  }

  private isInAmbientGeoZone(geo: GeoPoint): boolean {
    const idx = this.mapOptions.rainSectionIndex;
    if (idx < 0) return isPointInPolygon(geo, PARK_BOUNDARY);
    const polygon = this.editableSections[idx]?.polygon;
    if (!polygon?.length) return isPointInPolygon(geo, PARK_BOUNDARY);
    return isPointInPolygon(geo, polygon);
  }

  private getWorldViewportBounds(w: number, h: number): MapPlaneBounds {
    const corners = [
      this.screenToMap(0, 0),
      this.screenToMap(w, 0),
      this.screenToMap(w, h),
      this.screenToMap(0, h),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of corners) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY };
  }

  private syncAmbientZoneCallbacks(): void {
    const contains = this.getRainContainsPoint() ?? null;
    this.rainEffect.setContainsPoint(contains);
    this.fogEffect.setContainsPoint(contains);
    this.motesEffect.setContainsPoint(contains);
    this.cloudShadowEffect.setContainsPoint(contains);
    this.leavesEffect.setContainsPoint(contains);
    this.nightMistEffect.setContainsPoint(contains);
    this.leavesEffect.setSectionAt((bx, by) => this.hitTestSectionAtCanvas(bx, by));
  }

  private hitTestSectionAtCanvas(bx: number, by: number): number {
    return this.hitTestSectionAtGeo(this.canvasToGeo({ x: bx, y: by }));
  }

  setRainIntensity(value: number): void {
    this.mapOptions.rainIntensity = Math.min(1, Math.max(0, value));
    this.rainEffect.setIntensity(this.mapOptions.rainIntensity);
    this.lightningEffect.setRainIntensity(this.mapOptions.rainIntensity);
    this.onOptionChange();
  }

  setRainSize(value: number): void {
    this.mapOptions.rainSize = Math.min(2.5, Math.max(0.08, value));
    this.rainEffect.setSizeMul(this.mapOptions.rainSize);
    this.onOptionChange();
  }

  setFogIntensity(value: number): void {
    this.mapOptions.fogIntensity = Math.min(1, Math.max(0, value));
    this.fogEffect.setIntensity(this.mapOptions.fogIntensity);
    this.onOptionChange();
  }

  setFogSize(value: number): void {
    this.mapOptions.fogSize = Math.min(2.5, Math.max(0.08, value));
    this.fogEffect.setSizeMul(this.mapOptions.fogSize);
    this.onOptionChange();
  }

  setMotesIntensity(value: number): void {
    this.mapOptions.motesIntensity = Math.min(1, Math.max(0, value));
    this.motesEffect.setIntensity(this.mapOptions.motesIntensity);
    this.onOptionChange();
  }

  setMotesSize(value: number): void {
    this.mapOptions.motesSize = Math.min(2.5, Math.max(0.08, value));
    this.motesEffect.setSizeMul(this.mapOptions.motesSize);
    this.onOptionChange();
  }

  setCloudShadowIntensity(value: number): void {
    this.mapOptions.cloudShadowIntensity = Math.min(1, Math.max(0, value));
    this.cloudShadowEffect.setIntensity(this.mapOptions.cloudShadowIntensity);
    this.onOptionChange();
  }

  setCloudShadowSize(value: number): void {
    this.mapOptions.cloudShadowSize = Math.min(2.5, Math.max(0.08, value));
    this.cloudShadowEffect.setSizeMul(this.mapOptions.cloudShadowSize);
    this.onOptionChange();
  }

  setLeavesIntensity(value: number): void {
    this.mapOptions.leavesIntensity = Math.min(1, Math.max(0, value));
    this.leavesEffect.setIntensity(this.mapOptions.leavesIntensity);
    this.onOptionChange();
  }

  setLeavesSize(value: number): void {
    this.mapOptions.leavesSize = Math.min(2.5, Math.max(0.08, value));
    this.leavesEffect.setSizeMul(this.mapOptions.leavesSize);
    this.onOptionChange();
  }

  setTreesIntensity(value: number): void {
    this.mapOptions.treesIntensity = Math.min(1, Math.max(0, value));
    this.treesEffect.setIntensity(this.mapOptions.treesIntensity);
    this.onOptionChange();
  }

  setTreesSize(value: number): void {
    this.mapOptions.treesSize = Math.min(2.5, Math.max(0.08, value));
    this.treesEffect.setSizeMul(this.mapOptions.treesSize);
    this.onOptionChange();
  }

  setNightMistIntensity(value: number): void {
    this.mapOptions.nightMistIntensity = Math.min(1, Math.max(0, value));
    this.nightMistEffect.setIntensity(this.mapOptions.nightMistIntensity);
    this.onOptionChange();
  }

  applyAmbientScenario(scenario: AmbientScenario, opts?: { skipCamera?: boolean }): void {
    this.rainEffect.clear();
    this.fogEffect.clear();
    this.motesEffect.clear();
    this.cloudShadowEffect.clear();
    this.leavesEffect.clear();
    this.nightMistEffect.clear();
    this.lightningEffect.clear();

    this.ambientScenarioId = scenario.id;
    this.ambientScenarioTint = scenario.tint;
    this.ambientSectionOpacityBoost = scenario.sectionOpacityBoost;

    const s = scenario.scene;
    this.mapOptions.showRainEffect = s.showRainEffect;
    this.mapOptions.rainIntensity = s.rainIntensity;
    this.mapOptions.rainSize = s.rainSize;
    this.mapOptions.rainSectionIndex = s.rainSectionIndex;
    this.mapOptions.showFogEffect = s.showFogEffect;
    this.mapOptions.fogIntensity = s.fogIntensity;
    this.mapOptions.fogSize = s.fogSize;
    this.mapOptions.showMotesEffect = s.showMotesEffect;
    this.mapOptions.motesIntensity = s.motesIntensity;
    this.mapOptions.motesSize = s.motesSize;
    this.mapOptions.showCloudShadows = s.showCloudShadows;
    this.mapOptions.cloudShadowIntensity = s.cloudShadowIntensity;
    this.mapOptions.cloudShadowSize = s.cloudShadowSize;
    this.mapOptions.showLeavesEffect = s.showLeavesEffect;
    this.mapOptions.leavesIntensity = s.leavesIntensity;
    this.mapOptions.leavesSize = s.leavesSize;
    this.mapOptions.showTreesEffect = s.showTreesEffect;
    this.mapOptions.treesIntensity = s.treesIntensity;
    this.mapOptions.treesSize = s.treesSize;
    this.mapOptions.showLightningEffect = s.showLightningEffect;
    this.mapOptions.showNightMistEffect = s.showNightMistEffect;
    this.mapOptions.nightMistIntensity = s.nightMistIntensity;
    this.mapOptions.ambientWindDeg = s.ambientWindDeg;
    this.mapOptions.ambientWindStrength = s.ambientWindStrength;

    this.rainEffect.setIntensity(s.rainIntensity);
    this.rainEffect.setSizeMul(s.rainSize);
    this.fogEffect.setIntensity(s.fogIntensity);
    this.fogEffect.setSizeMul(s.fogSize);
    this.motesEffect.setIntensity(s.motesIntensity);
    this.motesEffect.setSizeMul(s.motesSize);
    this.cloudShadowEffect.setIntensity(s.cloudShadowIntensity);
    this.cloudShadowEffect.setSizeMul(s.cloudShadowSize);
    this.leavesEffect.setIntensity(s.leavesIntensity);
    this.leavesEffect.setSizeMul(s.leavesSize);
    this.treesEffect.setIntensity(s.treesIntensity);
    this.treesEffect.setSizeMul(s.treesSize);
    this.nightMistEffect.setIntensity(s.nightMistIntensity);
    this.lightningEffect.setEnabled(s.showLightningEffect);
    this.lightningEffect.setRainIntensity(s.rainIntensity);
    this.syncAmbientZoneCallbacks();

    if (!opts?.skipCamera && scenario.focusSection !== null) {
      if (scenario.focusSection >= 0) {
        this.fitSectionToView(scenario.focusSection);
      } else {
        this.resetView();
      }
    }

    this.onOptionChange();
    this.render();
  }

  getActiveAmbientScenarioId(): string | null {
    return this.ambientScenarioId;
  }

  /** Scenario color tint without changing camera or effect sliders. */
  applyAmbientScenarioTint(scenarioId: string | null): void {
    if (!scenarioId) {
      this.ambientScenarioId = null;
      this.ambientScenarioTint = null;
      this.ambientSectionOpacityBoost = 0;
      this.render();
      return;
    }
    const scenario = findAmbientScenario(scenarioId);
    if (!scenario) return;
    this.ambientScenarioId = scenario.id;
    this.ambientScenarioTint = scenario.tint;
    this.ambientSectionOpacityBoost = scenario.sectionOpacityBoost;
    this.render();
  }

  clearAmbientScenarioVisuals(): void {
    if (!this.ambientScenarioId && !this.ambientScenarioTint) return;
    this.ambientScenarioId = null;
    this.ambientScenarioTint = null;
    this.ambientSectionOpacityBoost = 0;
    this.render();
  }

  private drawAmbientScenarioTint(clipPath: Path2D | null, w: number, h: number): void {
    const tint = this.ambientScenarioTint;
    if (!tint || tint.alpha <= 0) return;

    this.ctx.save();
    if (clipPath) this.ctx.clip(clipPath);

    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, tint.top);
    grad.addColorStop(1, tint.bottom);
    this.ctx.globalAlpha = tint.alpha;
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalAlpha = 1;

    this.ctx.restore();
  }

  setRainSectionIndex(index: number): void {
    const next = Number.isFinite(index) ? Math.round(index) : -1;
    if (this.mapOptions.rainSectionIndex === next) return;
    this.mapOptions.rainSectionIndex = next;
    this.rainEffect.clear();
    this.fogEffect.clear();
    this.motesEffect.clear();
    this.cloudShadowEffect.clear();
    this.leavesEffect.clear();
    this.nightMistEffect.clear();
    this.syncAmbientZoneCallbacks();
    this.onOptionChange();
  }

  setSpatialAnimSpeed(value: number): void {
    this.mapOptions.spatialAnimSpeed = Math.min(2, Math.max(0.2, value));
  }

  setSpatialReferencePlaceIndex(index: number): void {
    this.spatialReferencePlaceIndex = index;
    this.render();
  }

  getSceneOptions(): {
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
    rainWindDeg: number;
    fogWindDeg: number;
    motesWindDeg: number;
    cloudShadowWindDeg: number;
    leavesWindDeg: number;
    treesWindDeg: number;
    spatialAnimSpeed: number;
  } {
    return {
      showSpatialReferences: this.mapOptions.showSpatialReferences,
      showRainEffect: this.mapOptions.showRainEffect,
      rainIntensity: this.mapOptions.rainIntensity,
      rainSize: this.mapOptions.rainSize,
      rainSectionIndex: this.mapOptions.rainSectionIndex,
      showFogEffect: this.mapOptions.showFogEffect,
      fogIntensity: this.mapOptions.fogIntensity,
      fogSize: this.mapOptions.fogSize,
      showMotesEffect: this.mapOptions.showMotesEffect,
      motesIntensity: this.mapOptions.motesIntensity,
      motesSize: this.mapOptions.motesSize,
      showCloudShadows: this.mapOptions.showCloudShadows,
      cloudShadowIntensity: this.mapOptions.cloudShadowIntensity,
      cloudShadowSize: this.mapOptions.cloudShadowSize,
      showLeavesEffect: this.mapOptions.showLeavesEffect,
      leavesIntensity: this.mapOptions.leavesIntensity,
      leavesSize: this.mapOptions.leavesSize,
      showTreesEffect: this.mapOptions.showTreesEffect,
      treesIntensity: this.mapOptions.treesIntensity,
      treesSize: this.mapOptions.treesSize,
      showLightningEffect: this.mapOptions.showLightningEffect,
      showNightMistEffect: this.mapOptions.showNightMistEffect,
      nightMistIntensity: this.mapOptions.nightMistIntensity,
      ambientWindDeg: this.mapOptions.ambientWindDeg,
      ambientWindStrength: this.mapOptions.ambientWindStrength,
      rainWindDeg: this.mapOptions.rainWindDeg,
      fogWindDeg: this.mapOptions.fogWindDeg,
      motesWindDeg: this.mapOptions.motesWindDeg,
      cloudShadowWindDeg: this.mapOptions.cloudShadowWindDeg,
      leavesWindDeg: this.mapOptions.leavesWindDeg,
      treesWindDeg: this.mapOptions.treesWindDeg,
      spatialAnimSpeed: this.mapOptions.spatialAnimSpeed,
    };
  }

  getSpatialReferences(): SpatialReference[] {
    return this.spatialReferences.map((r) => ({ ...r }));
  }

  downloadSpatialReferencesJson(): void {
    const blob = new Blob([exportSpatialReferencesJson(this.spatialReferences)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spatial-references.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  private emitSpatialReferencesChanged(): void {
    this.spatialReferencesChanged.emit(this.getSpatialReferences());
    this.spatialRefLayer.preload(this.spatialReferences);
  }

  /** Clip del polígono del parque en espacio de pantalla (para lluvia). */
  private buildParkClipPath(): Path2D | null {
    return this.buildGeoClipPath(PARK_BOUNDARY);
  }

  private buildRainClipPath(): Path2D | null {
    const idx = this.mapOptions.rainSectionIndex;
    if (idx < 0) return this.buildParkClipPath();
    const polygon = this.editableSections[idx]?.polygon;
    if (!polygon?.length) return this.buildParkClipPath();
    return this.buildGeoClipPath(polygon);
  }

  private buildGeoClipPath(polygon: GeoPoint[]): Path2D | null {
    const pts = polygon.map((g) => this.geoToScreen(g));
    if (pts.length < 3) return null;
    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    path.closePath();
    return path;
  }

  private getAmbientWind(): AmbientWind {
    return {
      directionDeg: this.mapOptions.ambientWindDeg,
      strength: this.mapOptions.ambientWindStrength,
    };
  }

  private getEffectWind(deg: number): AmbientWind {
    return {
      directionDeg: deg < 0 ? this.mapOptions.ambientWindDeg : normalizeWindDegrees(deg),
      strength: this.mapOptions.ambientWindStrength,
    };
  }

  setEffectWindDirection(effect: AmbientEffectWindKey, deg: number): void {
    const value = deg < 0 ? EFFECT_WIND_INHERIT : normalizeWindDegrees(deg);
    switch (effect) {
      case 'rain': this.mapOptions.rainWindDeg = value; break;
      case 'fog': this.mapOptions.fogWindDeg = value; break;
      case 'motes': this.mapOptions.motesWindDeg = value; break;
      case 'cloudShadows': this.mapOptions.cloudShadowWindDeg = value; break;
      case 'leaves': this.mapOptions.leavesWindDeg = value; break;
      case 'trees': this.mapOptions.treesWindDeg = value; break;
    }
    this.onOptionChange();
  }

  setAmbientWindDirection(deg: number): void {
    this.mapOptions.ambientWindDeg = normalizeWindDegrees(deg);
    this.onOptionChange();
  }

  setAmbientWindStrength(value: number): void {
    this.mapOptions.ambientWindStrength = Math.min(1, Math.max(0, value));
    this.onOptionChange();
  }

  private getAmbientTickZone(): Pick<RainTickOptions, 'bounds' | 'containsPoint'> {
    const opts = this.getRainEffectOptions();
    return { bounds: opts.bounds, containsPoint: opts.containsPoint };
  }

  private getRainEffectOptions(): RainTickOptions {
    return {
      bounds: this.getRainPlaneBounds(),
      containsPoint: this.getRainContainsPoint(),
      wind: this.getAmbientWind(),
    };
  }

  private getRainContainsPoint(): ((bx: number, by: number) => boolean) | undefined {
    const idx = this.mapOptions.rainSectionIndex;
    if (idx < 0) return undefined;
    const polygon = this.editableSections[idx]?.polygon;
    if (!polygon?.length) return undefined;
    return (bx, by) => isPointInPolygon(this.canvasToGeo({ x: bx, y: by }), polygon);
  }

  private getRainPlaneBounds(): MapPlaneBounds {
    const idx = this.mapOptions.rainSectionIndex;
    if (idx < 0) return this.getParkMapPlaneBounds();
    const polygon = this.editableSections[idx]?.polygon;
    if (!polygon?.length) return this.getParkMapPlaneBounds();
    const pts = polygon.map((g) => this.geoToCanvas(g));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY };
  }

  private emitViewInfo(): void {
    if (!this.isBrowser || !this.canvasRef?.nativeElement) return;
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const center = this.canvasToGeo({ x: w / 2, y: h / 2 });
    this.viewInfo.emit({
      lat: center.lat,
      lng: center.lng,
      zoom: this.scale,
      rotDeg: this.rotationDeg,
      showSections: this.mapOptions.showSections,
      showLabels: this.mapOptions.showLabels,
      showGroundTextures: this.mapOptions.showGroundTextures,
      groundTilePx: this.mapOptions.groundTilePx,
      showBoundary: this.mapOptions.showBoundary,
      showMarkers: this.mapOptions.showMarkers,
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // ── Global map shortcuts (work regardless of edit mode) ─────
    if (e.ctrlKey) {
      switch (e.key) {
        case '=': case '+':  // Ctrl++ zoom in
          e.preventDefault(); this.zoomIn(); return;
        case '-': case '_':  // Ctrl+- zoom out
          e.preventDefault(); this.zoomOut(); return;
        case 'ArrowLeft':    // Ctrl+← rotate left
          e.preventDefault(); this.rotateOnce('left'); return;
        case 'ArrowRight':   // Ctrl+→ rotate right
          e.preventDefault(); this.rotateOnce('right'); return;
        case 'r': case 'R':  // Ctrl+R reset view
          e.preventDefault(); this.resetView(); this.emitViewInfo(); return;
        case 'l': case 'L':  // Ctrl+L toggle labels
          e.preventDefault(); this.setMapOption('showLabels', !this.mapOptions.showLabels); return;
        case 'S':            // Ctrl+Shift+S toggle sections
          if (e.shiftKey) { e.preventDefault(); this.setMapOption('showSections', !this.mapOptions.showSections); return; }
          break;
      }
    }

    // ── Section editor: delete selected vertex ───────────────
    if (this.sectionEditorMode && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (this.sectionEditorSelectedVertex !== null) {
        e.preventDefault();
        this.deleteSectionVertex(this.sectionEditorIndex, this.sectionEditorSelectedVertex);
      }
    }
  }

  // === CONTROLES ===

  zoomIn(): void {
    this.beginCameraZoomFocus();
    this.targetScale = this.clampZoom(this.targetScale * PARK_MAP_VIS.zoomButtonFactor);
  }

  zoomOut(): void {
    this.beginCameraZoomFocus();
    this.targetScale = this.clampZoom(this.targetScale / PARK_MAP_VIS.zoomButtonFactor);
  }

  rotateOnce(direction: 'left' | 'right'): void {
    if (this.isRotating) return; // Evitar si ya estamos en rotación continua

    const step = Math.PI / 48; // 3.75° por click
    if (direction === 'left') {
      this.targetRotation -= step;
    } else {
      this.targetRotation += step;
    }
  }

  startContinuousRotation(direction: 'left' | 'right'): void {
    // Esperar un momento antes de empezar rotación continua
    this.rotationHoldTimer = setTimeout(() => {
      this.isRotating = true;

      this.rotationInterval = setInterval(() => {
        if (direction === 'left') {
          this.rotation -= this.ROTATION_STEP;
          this.targetRotation = this.rotation;
        } else {
          this.rotation += this.ROTATION_STEP;
          this.targetRotation = this.rotation;
        }
      }, 16); // ~60fps
    }, this.HOLD_DELAY);
  }

  stopContinuousRotation(): void {
    if (this.rotationHoldTimer) {
      clearTimeout(this.rotationHoldTimer);
      this.rotationHoldTimer = null;
    }
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    if (this.isRotating) {
      this.isRotating = false;
      this.saveState();
    }
  }

  resetView(): void {
    this.targetScale = 1.2;
    this.targetRotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.targetOffsetX = 0;
    this.targetOffsetY = 0;
    this._hasZoomAnchor = false;
    this._zoomFocusScreen = null;
    this._zoomFocusMap = null;
    this.saveState();
  }

  /** Recentra el mapa en el centroide del contorno del parque sin cambiar zoom. */
  centerMap(): void {
    if (!this.isBrowser || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Compute centroid of park boundary
    let sumLat = 0, sumLng = 0;
    for (const p of PARK_BOUNDARY) { sumLat += p.lat; sumLng += p.lng; }
    const centroid: GeoPoint = { lat: sumLat / PARK_BOUNDARY.length, lng: sumLng / PARK_BOUNDARY.length };

    // Convert centroid to base canvas coords (before transform)
    const base = this.geoToCanvas(centroid);
    const cx = w / 2;
    const cy = h / 2;

    // Apply current scale + rotation to get the offset needed
    let dx = base.x - cx;
    let dy = base.y - cy;
    dx *= this.scale;
    dy *= this.scale;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * dx - sin * dy;
    const ry = sin * dx + cos * dy;

    // offsetX/Y moves screen — to center the centroid we negate the displacement
    this.offsetX = -rx;
    this.offsetY = -ry;
    this.targetOffsetX = this.offsetX;
    this.targetOffsetY = this.offsetY;
    this._hasZoomAnchor = false;
    this.saveState();
    this.render();
    this.emitViewInfo();
  }

  /** Toggle GPS coordinate picker mode. */
  toggleCoordPicker(): void {
    this.coordPickerMode = !this.coordPickerMode;
  }

  // === MAP STATE CAPTURE / RESTORE (for layer config system) ===

  /** Capture current map view state as a serializable object */
  getMapViewState(): { scale: number; rotation: number; offsetX: number; offsetY: number; showSections: boolean; showLabels: boolean; showGroundTextures: boolean; groundTilePx: number } {
    return {
      scale: this.scale,
      rotation: this.rotation,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      showSections: this.mapOptions.showSections,
      showLabels: this.mapOptions.showLabels,
      showGroundTextures: this.mapOptions.showGroundTextures,
      groundTilePx: this.mapOptions.groundTilePx,
    };
  }

  /** Restore map view state from a saved configuration */
  setMapViewState(state: { scale: number; rotation: number; offsetX: number; offsetY: number; showSections: boolean; showLabels: boolean; showGroundTextures?: boolean; groundTilePx?: number; showBoundary?: boolean; showMarkers?: boolean; markerSize?: number }): void {
    this.scale = state.scale;
    this.targetScale = state.scale;
    this.rotation = state.rotation;
    this.targetRotation = state.rotation;
    this.offsetX = state.offsetX;
    this.offsetY = state.offsetY;
    this.targetOffsetX = state.offsetX;
    this.targetOffsetY = state.offsetY;
    this.mapOptions.showSections = state.showSections;
    this.mapOptions.showLabels = state.showLabels;
    this.mapOptions.showGroundTextures = state.showGroundTextures ?? true;
    if (state.groundTilePx != null) this.setGroundTilePx(state.groundTilePx);
    this.mapOptions.showBoundary = state.showBoundary ?? true;
    this.mapOptions.showMarkers = state.showMarkers ?? true;
    if (state.markerSize != null) this.markerRadius = state.markerSize;
    this.saveState();
    this.render();
    this.emitViewInfo();
  }

  /** Full map-side snapshot. */
  exportMapPersistedState() {
    const base = this.getMapViewState();
    return {
      mapState: {
        ...base,
        showGroundTextures: this.mapOptions.showGroundTextures,
        groundTilePx: this.mapOptions.groundTilePx,
        showBoundary: this.mapOptions.showBoundary,
        showMarkers: this.mapOptions.showMarkers,
        markerSize: this.markerRadius,
      },
      layerOffsets: JSON.parse(JSON.stringify(this.layerOffsets)),
      activeMovableLayer: this.activeMovableLayer,
      sections: this.getEditableSections(),
      spatialReferences: this.getSpatialReferences(),
      ambientScene: {
        ...this.getSceneOptions(),
        activeScenarioId: this.getActiveAmbientScenarioId(),
      },
      ambientTrees: this.getAmbientTrees(),
      groundStyle: exportGroundStyleSnapshot(),
    };
  }

  /** Restore map-side state from snapshot. */
  applyMapPersistedState(
    data: {
      mapState?: Parameters<MapControlComponent['setMapViewState']>[0];
      layerOffsets?: { boundary: { x: number; y: number }; sections: { x: number; y: number }; markers: { x: number; y: number } };
      activeMovableLayer?: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers';
      sections?: ParkSectionRecord[];
      spatialReferences?: SpatialReference[];
      ambientScene?: AmbientSceneData & { activeScenarioId?: string | null };
      ambientTrees?: AmbientTreeSlot[];
      groundStyle?: Record<number, ZoneGroundStyle>;
    },
    opts?: { skipLegacySave?: boolean },
  ): void {
    if (data.mapState) this.setMapViewState(data.mapState);
    if (data.layerOffsets) {
      this.layerOffsets = JSON.parse(JSON.stringify(data.layerOffsets));
    }
    if (data.activeMovableLayer) {
      this.activeMovableLayer = data.activeMovableLayer === 'grid' ? 'canvas' : data.activeMovableLayer;
    }
    if (data.sections?.length) {
      this.editableSections = data.sections.map((s) => ({
        ...s,
        colors: { ...s.colors },
        polygon: s.polygon.map((p) => ({ ...p })),
        education: s.education ? { ...s.education } : { summary: '', referenceImageUrl: '' },
      }));
      this.emitSectionsChanged();
    }
    if (data.spatialReferences?.length) {
      this.spatialReferences = data.spatialReferences.map((r) => ({ ...r }));
      this.emitSpatialReferencesChanged();
    }
    if (data.ambientScene) {
      this.applySceneSnapshot(data.ambientScene);
    }
    if (data.ambientTrees != null) {
      this.setAmbientTrees(data.ambientTrees);
    }
    if (data.groundStyle != null) {
      importGroundStyleSnapshot(data.groundStyle);
      this.groundPatternCache.clear();
      this.mapBackdropCache.clear();
    }
    if (!opts?.skipLegacySave) this.saveState();
    this.render();
    this.emitViewInfo();
  }

  private applySceneSnapshot(scene: AmbientSceneData & { activeScenarioId?: string | null }): void {
    this.ambientScenarioId = scene.activeScenarioId ?? null;
    if (!scene.activeScenarioId) {
      this.ambientScenarioTint = null;
      this.ambientSectionOpacityBoost = 0;
    }
    this.mapOptions.showSpatialReferences = scene.showSpatialReferences;
    this.mapOptions.showRainEffect = scene.showRainEffect;
    this.mapOptions.rainIntensity = scene.rainIntensity;
    this.mapOptions.rainSize = scene.rainSize;
    this.mapOptions.rainSectionIndex = scene.rainSectionIndex;
    this.mapOptions.showFogEffect = scene.showFogEffect;
    this.mapOptions.fogIntensity = scene.fogIntensity;
    this.mapOptions.fogSize = scene.fogSize;
    this.mapOptions.showMotesEffect = scene.showMotesEffect;
    this.mapOptions.motesIntensity = scene.motesIntensity;
    this.mapOptions.motesSize = scene.motesSize;
    this.mapOptions.showCloudShadows = scene.showCloudShadows;
    this.mapOptions.cloudShadowIntensity = scene.cloudShadowIntensity;
    this.mapOptions.cloudShadowSize = scene.cloudShadowSize;
    this.mapOptions.showLeavesEffect = scene.showLeavesEffect;
    this.mapOptions.leavesIntensity = scene.leavesIntensity;
    this.mapOptions.leavesSize = scene.leavesSize;
    this.mapOptions.showTreesEffect = scene.showTreesEffect;
    this.mapOptions.treesIntensity = scene.treesIntensity;
    this.mapOptions.treesSize = scene.treesSize;
    this.mapOptions.showLightningEffect = scene.showLightningEffect;
    this.mapOptions.showNightMistEffect = scene.showNightMistEffect;
    this.mapOptions.nightMistIntensity = scene.nightMistIntensity;
    this.mapOptions.ambientWindDeg = scene.ambientWindDeg;
    this.mapOptions.ambientWindStrength = scene.ambientWindStrength;
    this.mapOptions.rainWindDeg = scene.rainWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.fogWindDeg = scene.fogWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.motesWindDeg = scene.motesWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.cloudShadowWindDeg = scene.cloudShadowWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.leavesWindDeg = scene.leavesWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.treesWindDeg = scene.treesWindDeg ?? EFFECT_WIND_INHERIT;
    this.mapOptions.spatialAnimSpeed = scene.spatialAnimSpeed;

    this.rainEffect.setIntensity(scene.rainIntensity);
    this.rainEffect.setSizeMul(scene.rainSize);
    this.fogEffect.setIntensity(scene.fogIntensity);
    this.fogEffect.setSizeMul(scene.fogSize);
    this.motesEffect.setIntensity(scene.motesIntensity);
    this.motesEffect.setSizeMul(scene.motesSize);
    this.cloudShadowEffect.setIntensity(scene.cloudShadowIntensity);
    this.cloudShadowEffect.setSizeMul(scene.cloudShadowSize);
    this.leavesEffect.setIntensity(scene.leavesIntensity);
    this.leavesEffect.setSizeMul(scene.leavesSize);
    this.treesEffect.setIntensity(scene.treesIntensity);
    this.treesEffect.setSizeMul(scene.treesSize);
    this.nightMistEffect.setIntensity(scene.nightMistIntensity);
    this.lightningEffect.setEnabled(scene.showLightningEffect);
    this.lightningEffect.setRainIntensity(scene.rainIntensity);
    this.syncAmbientZoneCallbacks();
  }
}
