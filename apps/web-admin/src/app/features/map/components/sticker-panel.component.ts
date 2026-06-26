import {
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { WIND_DIRECTION_PRESETS, EFFECT_WIND_INHERIT, type AmbientEffectWindKey } from '../utils/map-ambient-wind';
import { BACKDROP_TREE_SECTION, TREE_ECO_LABELS, TREE_VARIANT_LABELS, type AmbientTreeSlot } from '../data/ambient-tree-slots';
import type { ParkSectionRecord } from '../data/park-geometry';
import type { SpatialReference, SpatialReferenceCategory, SpatialReferenceMarkerStyle } from '../data/spatial-reference';
import { SPATIAL_REFERENCE_MARKER_STYLES, spatialReferenceSummary } from '../data/spatial-reference';
import { resolveSectionFillOpacities } from '../utils/section-color.util';
import { PARK_MAP_VIS } from '../utils/map-park-visual-scale';

/** Event fired by the panel to control the map from outside */
export type MapControlEvent =
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'rotateLeft' }
  | { type: 'rotateRight' }
  | { type: 'reset' }
  | { type: 'optionChange'; option: 'showSections' | 'showLabels' | 'showBoundary' | 'showMarkers' | 'showGroundTextures'; value: boolean }
  | { type: 'groundTilePxChange'; value: number }
  | { type: 'setTreePlaceVariant'; variant: 0 | 1 | 2 }
  | { type: 'setTreePlaceStyleSection'; section: number }
  | { type: 'selectAmbientTree'; index: number | null }
  | { type: 'updateAmbientTree'; index: number; patch: Partial<AmbientTreeSlot> }
  | { type: 'centerMap' }
  | { type: 'toggleCoordPicker' }
  | { type: 'saveConfig' }
  | { type: 'loadConfig' }
  | { type: 'markerSize'; value: number }
  | { type: 'toggleSectionEditor' }
  | { type: 'setSectionEditorIndex'; index: number }
  | { type: 'setSectionEditorVertex'; vertexIndex: number | null }
  | { type: 'setSectionEditorAddVertex'; enabled: boolean }
  | { type: 'updateSectionVertex'; sectionIndex: number; vertexIndex: number; lat: number; lng: number }
  | { type: 'deleteSectionVertex'; sectionIndex: number; vertexIndex: number }
  | { type: 'exportSectionsJson' }
  | { type: 'resetSections' }
  | { type: 'updateSectionColor'; sectionIndex: number; hex: string }
  | { type: 'updateSectionFillOpacity'; sectionIndex: number; which: 'dark' | 'light'; opacity: number }
  | { type: 'sceneOptionChange'; option: 'showRainEffect' | 'showFogEffect' | 'showMotesEffect' | 'showCloudShadows' | 'showLeavesEffect' | 'showTreesEffect' | 'showLightningEffect' | 'showNightMistEffect'; value: boolean }
  | { type: 'spatialRefsOptionChange'; value: boolean }
  | { type: 'rainIntensityChange'; value: number }
  | { type: 'rainSizeChange'; value: number }
  | { type: 'fogIntensityChange'; value: number }
  | { type: 'fogSizeChange'; value: number }
  | { type: 'motesIntensityChange'; value: number }
  | { type: 'motesSizeChange'; value: number }
  | { type: 'cloudShadowIntensityChange'; value: number }
  | { type: 'cloudShadowSizeChange'; value: number }
  | { type: 'leavesIntensityChange'; value: number }
  | { type: 'leavesSizeChange'; value: number }
  | { type: 'treesIntensityChange'; value: number }
  | { type: 'treesSizeChange'; value: number }
  | { type: 'nightMistIntensityChange'; value: number }
  | { type: 'ambientWindDirectionChange'; deg: number }
  | { type: 'ambientWindStrengthChange'; value: number }
  | { type: 'effectWindDirectionChange'; effect: AmbientEffectWindKey; deg: number }
  | { type: 'rainSectionChange'; sectionIndex: number }
  | { type: 'applyAmbientScenario'; scenarioId: string }
  | { type: 'toggleTreeEditor' }
  | { type: 'setTreeEditorSection'; index: number }
  | { type: 'setTreePlaceActive'; active: boolean }
  | { type: 'removeAmbientTree'; index: number }
  | { type: 'exportAmbientTrees' }
  | { type: 'spatialAnimSpeedChange'; value: number }
  | { type: 'selectSpatialReferenceIndex'; index: number }
  | { type: 'updateSpatialReference'; index: number; patch: Partial<SpatialReference> }
  | { type: 'setSpatialReferencePlaceIndex'; index: number }
  | { type: 'exportSpatialReferencesJson' };

/** Current map view info emitted by MapControlComponent */
export interface MapViewInfo {
  lat: number;
  lng: number;
  zoom: number;
  rotDeg: number;
  showSections: boolean;
  showLabels: boolean;
  showGroundTextures: boolean;
  groundTilePx: number;
  showBoundary: boolean;
  showMarkers: boolean;
}

/**
 * Unified Map Panel — single sidebar for ALL map controls.
 */
@Component({
  selector: 'app-sticker-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Collapse / expand toggle — overlaid on map -->
    <button class="collapse-btn" [class.collapsed]="collapsed" (click)="togglePanel()"
      [title]="collapsed ? 'Abrir panel del mapa' : 'Cerrar panel'"
      [style.left.px]="collapsed ? 0 : panelWidth">>
      <svg *ngIf="collapsed" class="collapse-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
      <svg *ngIf="!collapsed" class="collapse-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <div class="panel-body" *ngIf="!collapsed" [class.dark]="isDarkTheme" [class.light]="!isDarkTheme"
      [style.width.px]="panelWidth">

      <!-- Resize handle on right edge -->
      <div class="resize-handle-right"
        (mousedown)="onResizeStart($event)"
        (touchstart)="onResizeTouchStart($event)">
        <div class="resize-grip-v"></div>
      </div>

      <!-- Vista -->
      <div class="panel-group-label">Vista</div>

      <!-- Información -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('info')">
          <span class="section-chevron" [class.open]="openSections.info">▸</span>
          <span class="section-title">Información</span>
        </div>
        <div class="section-content" *ngIf="openSections.info">
          <div class="info-grid" *ngIf="mapViewInfo">
            <div class="info-item"><span class="info-label">Lat</span><span class="info-val">{{ mapViewInfo.lat | number:'1.6-6' }}</span></div>
            <div class="info-item"><span class="info-label">Lng</span><span class="info-val">{{ mapViewInfo.lng | number:'1.6-6' }}</span></div>
            <div class="info-item"><span class="info-label">Zoom</span><span class="info-val">{{ mapViewInfo.zoom | number:'1.1-1' }}×</span></div>
            <div class="info-item"><span class="info-label">Rot</span><span class="info-val">{{ mapViewInfo.rotDeg | number:'1.0-0' }}°</span></div>
          </div>
        </div>
      </div>

      <!-- Capas -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('layers')">
          <span class="section-chevron" [class.open]="openSections.layers">▸</span>
          <span class="section-title">Capas</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.layers">
          <div class="layer-row">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showBoundary"
              (click)="toggleOpt('showBoundary')" title="Mostrar/ocultar contorno">
              <svg *ngIf="localOpts.showBoundary" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="!localOpts.showBoundary" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="layer-label">Contorno</span>
          </div>
          <div class="layer-row">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showSections"
              (click)="toggleOpt('showSections')" title="Mostrar/ocultar secciones">
              <svg *ngIf="localOpts.showSections" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="!localOpts.showSections" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="layer-label">Secciones</span>
          </div>
          <div class="layer-row">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showGroundTextures"
              (click)="toggleOpt('showGroundTextures')" title="Texturas del suelo por ecosistema">
              <svg *ngIf="localOpts.showGroundTextures" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="!localOpts.showGroundTextures" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="layer-label">Texturas suelo</span>
          </div>
          <div class="param-row" *ngIf="localOpts.showGroundTextures">
            <label>Grano textura</label>
            <input type="range" [min]="groundTileMin" [max]="groundTileMax" step="1" [ngModel]="localGroundTilePx"
              (ngModelChange)="onGroundTilePxChange($event)">
            <span class="param-val">{{ localGroundTilePx }}px</span>
          </div>
          <div class="layer-row">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showMarkers"
              (click)="toggleOpt('showMarkers')" title="Mostrar/ocultar marcadores">
              <svg *ngIf="localOpts.showMarkers" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="!localOpts.showMarkers" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="layer-label">Marcadores</span>
          </div>
          <div class="tool-divider"></div>
          <div class="param-row">
            <label>Marcadores</label>
            <input type="range" min="4" max="24" step="1" [ngModel]="localMarkerSize"
              (ngModelChange)="onMarkerSizeChange($event)">
            <span class="param-val">{{ localMarkerSize }}px</span>
          </div>
        </div>
      </div>

      <!-- REFERENCIAS ESPACIALES -->
      <div class="section section-editor-block">
        <div class="section-header" (click)="toggleSection('spatialRefs')">
          <span class="section-chevron" [class.open]="openSections.spatialRefs">▸</span>
          <span class="section-title">Referencias espaciales</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.spatialRefs">
          <p class="section-hint" *ngIf="isAdmin">
            Puntos de escena con ficha propia. PNG o <code>spriteSheet</code> para animación por frames.
          </p>

          <div class="param-row">
            <label>Mostrar en mapa</label>
            <button type="button" class="section-toggle-btn" [class.active]="spatialRefsOpts.showSpatialReferences"
              (click)="toggleSpatialRefs()">
              {{ spatialRefsOpts.showSpatialReferences ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="search-row" *ngIf="isAdmin">
            <input type="text" class="search-input" placeholder="Buscar referencia…"
              [(ngModel)]="spatialRefSearchTerm">
          </div>

          <div class="param-row" *ngIf="isAdmin">
            <label>Animación</label>
            <input type="range" class="opacity-slider" min="20" max="200" step="5"
              [ngModel]="spatialRefsOpts.spatialAnimPercent"
              (ngModelChange)="onSpatialAnimSpeedChange($event)">
            <span class="opacity-val">{{ spatialRefsOpts.spatialAnimPercent }}%</span>
          </div>

          <div class="spatial-ref-list" *ngIf="filteredSpatialReferences.length">
            <div class="spatial-ref-item" *ngFor="let item of filteredSpatialReferences"
              [class.placing]="isAdmin && spatialPlaceIndex === item.index"
              [class.selected]="isAdmin && activeSpatialRefIndex === item.index"
              (click)="isAdmin && selectSpatialRef(item.index)">
              <div class="spatial-ref-head">
                <strong>{{ item.ref.name }}</strong>
                <span class="spatial-ref-cat">{{ item.ref.category }}</span>
              </div>
              <div class="spatial-ref-coords">{{ item.ref.lat | number:'1.5-5' }}, {{ item.ref.lng | number:'1.5-5' }}</div>
              <button type="button" class="tool-btn" *ngIf="isAdmin" [class.active]="spatialPlaceIndex === item.index"
                (click)="toggleSpatialPlace(item.index); $event.stopPropagation()">
                <span class="tool-icon">📍</span><span>{{ spatialPlaceIndex === item.index ? 'Click mapa…' : 'Ubicar' }}</span>
              </button>
            </div>
          </div>

          <ng-container *ngIf="isAdmin && activeSpatialRef as ref">
            <div class="param-row">
              <label>Estilo marcador</label>
              <div class="marker-style-row">
                <button type="button" class="marker-style-btn" *ngFor="let st of markerStyles"
                  [class.active]="(ref.markerStyle || 'circle') === st"
                  (click)="onMarkerStyleChange(st)">{{ markerStyleLabel(st) }}</button>
              </div>
            </div>

            <div class="param-row">
              <label>Tamaño (px)</label>
              <input type="range" class="opacity-slider" min="32" max="80" step="2"
                [ngModel]="ref.displaySize || 48"
                (ngModelChange)="onSpatialRefPatch({ displaySize: +$event })">
              <span class="opacity-val">{{ ref.displaySize || 48 }}</span>
            </div>

            <div class="param-row">
              <label>Visible</label>
              <button type="button" class="section-toggle-btn" [class.active]="ref.visible"
                (click)="onSpatialRefPatch({ visible: !ref.visible })">
                {{ ref.visible ? 'ON' : 'OFF' }}
              </button>
            </div>

            <label class="section-edu-label">Ficha — información</label>
            <textarea class="spatial-ref-textarea" rows="4" maxlength="800"
              [ngModel]="spatialRefSummary(ref)"
              (ngModelChange)="onSpatialRefSummaryChange($event)"
              placeholder="Texto de la ficha al pulsar el marcador…"></textarea>
          </ng-container>

          <div class="tool-grid cols-2" *ngIf="isAdmin">
            <button class="tool-btn" (click)="exportSpatialReferences()" title="Descargar spatial-references.json">
              <span class="tool-icon">⬇</span><span>Exportar JSON</span>
            </button>
          </div>
        </div>
      </div>


      <!-- Edición -->
      <div class="panel-group-label" *ngIf="isAdmin">Edición</div>

      <div class="section section-editor-block" *ngIf="isAdmin">
        <div class="section-header" (click)="toggleSection('sectionEditor')">
          <span class="section-chevron" [class.open]="openSections.sectionEditor">▸</span>
          <span class="section-title">Editor de secciones</span>
          <button class="section-toggle-btn" [class.active]="sectionEditorActive"
            (click)="toggleSectionEditor(); $event.stopPropagation()"
            title="Editar polígonos Tierras Altas / Medias / Bajas">
            {{ sectionEditorActive ? 'ON' : 'OFF' }}
          </button>
        </div>
        <div class="section-content scrollable section-editor-content" *ngIf="openSections.sectionEditor">
          <p class="section-hint" *ngIf="!sectionEditorActive">
            Activa el editor para mover vértices en el mapa y ajustar las 3 zonas del parque.
          </p>
          <ng-container *ngIf="sectionEditorActive">
            <div class="section-pick-grid">
              <button type="button" class="section-pick-btn"
                *ngFor="let s of editableSections; let i = index"
                [class.active]="i === activeSectionIndex"
                [style.borderColor]="i === activeSectionIndex ? s.chartColor : null"
                (click)="onSectionIndexChange(i)">
                <span class="section-pick-swatch" [style.background]="s.chartColor"></span>
                <span class="section-pick-label">{{ s.name }}</span>
              </button>
            </div>
            <div class="param-row" *ngIf="activeSection as sec">
              <label>Color zona</label>
              <input type="color" class="color-pick" [ngModel]="sec.chartColor"
                (ngModelChange)="onSectionColorChange($event)">
              <span class="param-val color-hex">{{ sec.chartColor }}</span>
            </div>
            <div class="param-row" *ngIf="activeSection as sec">
              <label>Relleno mapa (oscuro)</label>
              <input type="range" class="opacity-slider" min="0" max="100" step="1"
                [ngModel]="sectionFillOpacityPercent(sec, 'dark')"
                (ngModelChange)="onSectionFillOpacityChange('dark', $event)">
              <span class="opacity-val">{{ sectionFillOpacityPercent(sec, 'dark') }}%</span>
            </div>
            <div class="param-row" *ngIf="activeSection as sec">
              <label>Relleno mapa (claro)</label>
              <input type="range" class="opacity-slider" min="0" max="100" step="1"
                [ngModel]="sectionFillOpacityPercent(sec, 'light')"
                (ngModelChange)="onSectionFillOpacityChange('light', $event)">
              <span class="opacity-val">{{ sectionFillOpacityPercent(sec, 'light') }}%</span>
            </div>
            <div class="section-editor-actions">
              <button class="tool-btn" [class.active]="addVertexMode" (click)="toggleAddVertexMode()"
                title="Click en el mapa para añadir vértice">
                <span class="tool-icon">＋</span><span>Añadir</span>
              </button>
              <button class="tool-btn danger" (click)="deleteSelectedVertex()"
                [disabled]="selectedVertexIndex === null || activePolygon.length <= 3"
                title="Eliminar vértice seleccionado (Del)">
                <span class="tool-icon">✕</span><span>Borrar</span>
              </button>
            </div>
            <div class="vertices-header">
              <span>Vértices ({{ activePolygon.length }})</span>
              <span class="vertices-hint">8 decimales WGS84</span>
            </div>
            <div class="vertex-list">
              <div class="vertex-item" *ngFor="let v of activePolygon; let vi = index"
                [class.selected]="vi === selectedVertexIndex"
                (click)="selectVertex(vi)">
                <span class="vertex-index">#{{ vi + 1 }}</span>
                <div class="vertex-coords">
                  <label>lat</label>
                  <input class="coord-input" type="number" step="0.00000001"
                    [ngModel]="v.lat" (ngModelChange)="onVertexFieldChange(vi, 'lat', $event)"
                    (click)="$event.stopPropagation()">
                  <label>lng</label>
                  <input class="coord-input" type="number" step="0.00000001"
                    [ngModel]="v.lng" (ngModelChange)="onVertexFieldChange(vi, 'lng', $event)"
                    (click)="$event.stopPropagation()">
                </div>
              </div>
            </div>
            <div class="tool-divider"></div>
            <div class="tool-grid cols-2">
              <button class="tool-btn" (click)="exportSections()" title="Descargar park-sections.json">
                <span class="tool-icon">⬇</span><span>Exportar</span>
              </button>
              <button class="tool-btn danger" (click)="resetSections()" title="Restaurar polígonos del repo">
                <span class="tool-icon">⟲</span><span>Restaurar</span>
              </button>
            </div>
          </ng-container>
        </div>
      </div>

      <div class="section section-editor-block" *ngIf="isAdmin">
        <div class="section-header" (click)="toggleSection('treeEditor')">
          <span class="section-chevron" [class.open]="openSections.treeEditor">▸</span>
          <span class="section-title">Árboles</span>
          <button class="section-toggle-btn" [class.active]="treeEditorActive"
            (click)="toggleTreeEditor(); $event.stopPropagation()"
            title="Colocar árboles en el parque y en el fondo del mapa">
            {{ treeEditorActive ? 'ON' : 'OFF' }}
          </button>
        </div>
        <div class="section-content scrollable section-editor-content" *ngIf="openSections.treeEditor">
          <p class="section-hint" *ngIf="!treeEditorActive">
            Pulsa <strong>ON</strong> para editar árboles en el mapa. No afecta otros modos del panel.
          </p>
          <ng-container *ngIf="treeEditorActive">
            <p class="section-hint compact">Los árboles se muestran en el mapa al activar el editor (o en Escena ambiental → Árboles).</p>
            <div class="section-pick-grid">
              <button type="button" class="section-pick-btn backdrop-zone"
                [class.active]="treeEditorSectionIndex === backdropTreeSection"
                (click)="onTreeEditorSectionChange(backdropTreeSection)">
                <span class="section-pick-swatch backdrop-swatch"></span>
                <span class="section-pick-label">Fondo del mapa</span>
                <span class="section-badge">{{ treeCountForZone(backdropTreeSection) }}</span>
              </button>
              <button type="button" class="section-pick-btn"
                *ngFor="let s of editableSections; let i = index"
                [class.active]="i === treeEditorSectionIndex"
                [style.borderColor]="i === treeEditorSectionIndex ? s.chartColor : null"
                (click)="onTreeEditorSectionChange(i)">
                <span class="section-pick-swatch" [style.background]="s.chartColor"></span>
                <span class="section-pick-label">{{ s.name }}</span>
                <span class="section-badge">{{ treeCountForZone(i) }}</span>
              </button>
            </div>

            <p class="section-hint compact" *ngIf="treeEditorSectionIndex === backdropTreeSection">
              Coloca árboles <strong>fuera</strong> del contorno del parque, sobre el marco gris/verde.
            </p>
            <p class="section-hint compact" *ngIf="treeEditorSectionIndex !== backdropTreeSection">
              Coloca árboles <strong>dentro</strong> de la zona seleccionada.
            </p>
            <p class="section-hint compact warn" *ngIf="treePlacementHint">{{ treePlacementHint }}</p>

            <div class="param-row column" *ngIf="treeEditorSectionIndex === backdropTreeSection">
              <label>Ecosistema visual</label>
              <div class="variant-pick-grid">
                <button type="button" class="variant-pick-btn" *ngFor="let eco of treeEcoLabels; let i = index"
                  [class.active]="treePlaceStyleSection === i"
                  (click)="onTreePlaceStyleSection(i)">{{ eco }}</button>
              </div>
            </div>

            <div class="param-row column">
              <label>Silueta</label>
              <div class="variant-pick-grid cols-3">
                <button type="button" class="variant-pick-btn" *ngFor="let label of treeVariantLabels; let i = index"
                  [class.active]="treePlaceVariant === i"
                  (click)="onTreePlaceVariant(i)">{{ label }}</button>
              </div>
            </div>

            <div class="section-editor-actions">
              <button class="tool-btn" [class.active]="treePlaceActive" (click)="toggleTreePlaceActive()"
                title="Pausa o reanuda la colocación con click en el mapa (puedes colocar varios seguidos)">
                <span class="tool-icon">🌳</span>
                <span>{{ treePlaceActive ? 'Colocando… (pausar)' : 'Modo colocar' }}</span>
              </button>
              <button class="tool-btn" (click)="exportAmbientTrees()" title="Descargar ambient-trees.json">
                <span class="tool-icon">⬇</span><span>Exportar JSON</span>
              </button>
            </div>

            <ng-container *ngIf="selectedTree as sel">
              <div class="sub-divider"></div>
              <p class="ambient-subtitle">Árbol seleccionado</p>
              <div class="param-row">
                <label>Tamaño</label>
                <input type="range" min="50" max="200" step="1"
                  [ngModel]="selectedTreeScalePercent"
                  (ngModelChange)="onSelectedTreeScaleChange($event)">
                <span class="param-val">{{ selectedTreeScalePercent }}%</span>
              </div>
              <div class="section-editor-actions">
                <button class="tool-btn danger" (click)="removeSelectedTree()">
                  <span class="tool-icon">✕</span><span>Eliminar</span>
                </button>
              </div>
            </ng-container>

            <div class="vertices-header">
              <span>Lista en zona ({{ treesInSelectedZone.length }})</span>
            </div>
            <div class="vertex-list" *ngIf="treesInSelectedZone.length; else noTreesInZone">
              <div class="vertex-item tree-list-item" *ngFor="let item of treesInSelectedZone"
                [class.selected]="item.index === selectedTreeIndex"
                (click)="onSelectAmbientTree(item.index)">
                <span class="vertex-index">#{{ item.index + 1 }}</span>
                <div class="vertex-coords">
                  <span class="spatial-ref-coords">{{ item.tree.lat | number:'1.5-5' }}, {{ item.tree.lng | number:'1.5-5' }}</span>
                  <span class="tree-meta">{{ treeVariantLabels[item.tree.variant] }} · {{ item.tree.scale | number:'1.2-2' }}×</span>
                </div>
                <button type="button" class="mini-btn danger" (click)="removeAmbientTree(item.index); $event.stopPropagation()" title="Eliminar">✕</button>
              </div>
            </div>
            <ng-template #noTreesInZone>
              <p class="section-hint compact">Sin árboles aquí. Con «Colocando…» activo, haz click en el mapa. Click en un marcador para editarlo.</p>
            </ng-template>
          </ng-container>
        </div>
      </div>

      <div class="section section-editor-block" *ngIf="isAdmin">
        <div class="section-header" (click)="toggleSection('scene')">
          <span class="section-chevron" [class.open]="openSections.scene">▸</span>
          <span class="section-title">Escena ambiental</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.scene">
          <p class="section-hint">Efectos en el plano del mapa (rotan con la vista).</p>

          <div class="param-row">
            <label>Lluvia en el mapa</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showRainEffect"
              (click)="toggleRainEffect()">{{ sceneOpts.showRainEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <ng-container *ngIf="sceneOpts.showRainEffect">
            <div class="param-row">
              <label>Intensidad lluvia</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.rainIntensityPercent"
                (ngModelChange)="onRainIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.rainIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño gotas</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.rainSizePercent"
                (ngModelChange)="onRainSizeChange($event)">
              <span class="param-val">{{ sceneOpts.rainSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'rain', windDeg: sceneOpts.rainWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Niebla en mapa</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showFogEffect"
              (click)="toggleFogEffect()">{{ sceneOpts.showFogEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <ng-container *ngIf="sceneOpts.showFogEffect">
            <div class="param-row">
              <label>Intensidad niebla</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.fogIntensityPercent"
                (ngModelChange)="onFogIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.fogIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño niebla</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.fogSizePercent"
                (ngModelChange)="onFogSizeChange($event)">
              <span class="param-val">{{ sceneOpts.fogSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'fog', windDeg: sceneOpts.fogWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Polen / luz</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showMotesEffect"
              (click)="toggleMotesEffect()">{{ sceneOpts.showMotesEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <ng-container *ngIf="sceneOpts.showMotesEffect">
            <div class="param-row">
              <label>Intensidad partículas</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.motesIntensityPercent"
                (ngModelChange)="onMotesIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.motesIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño partículas</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.motesSizePercent"
                (ngModelChange)="onMotesSizeChange($event)">
              <span class="param-val">{{ sceneOpts.motesSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'motes', windDeg: sceneOpts.motesWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Sombras nubes</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showCloudShadows"
              (click)="toggleCloudShadows()">{{ sceneOpts.showCloudShadows ? 'ON' : 'OFF' }}</button>
          </div>
          <ng-container *ngIf="sceneOpts.showCloudShadows">
            <div class="param-row">
              <label>Intensidad sombras</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.cloudShadowIntensityPercent"
                (ngModelChange)="onCloudShadowIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.cloudShadowIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño sombras</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.cloudShadowSizePercent"
                (ngModelChange)="onCloudShadowSizeChange($event)">
              <span class="param-val">{{ sceneOpts.cloudShadowSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'cloudShadows', windDeg: sceneOpts.cloudShadowWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Hojas</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showLeavesEffect"
              (click)="toggleLeavesEffect()">{{ sceneOpts.showLeavesEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <ng-container *ngIf="sceneOpts.showLeavesEffect">
            <div class="param-row">
              <label>Intensidad hojas</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.leavesIntensityPercent"
                (ngModelChange)="onLeavesIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.leavesIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño hojas</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.leavesSizePercent"
                (ngModelChange)="onLeavesSizeChange($event)">
              <span class="param-val">{{ sceneOpts.leavesSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'leaves', windDeg: sceneOpts.leavesWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Árboles</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showTreesEffect"
              (click)="toggleTreesEffect()">{{ sceneOpts.showTreesEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <p class="section-hint compact">Editor en Edición → Árboles. El switch ON de aquí solo controla si se dibujan en el mapa.</p>
          <ng-container *ngIf="sceneOpts.showTreesEffect">
            <div class="param-row">
              <label>Densidad</label>
              <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.treesIntensityPercent"
                (ngModelChange)="onTreesIntensityChange($event)">
              <span class="param-val">{{ sceneOpts.treesIntensityPercent }}%</span>
            </div>
            <div class="param-row">
              <label>Tamaño</label>
              <input type="range" min="8" max="200" step="1" [ngModel]="sceneOpts.treesSizePercent"
                (ngModelChange)="onTreesSizeChange($event)">
              <span class="param-val">{{ sceneOpts.treesSizePercent }}%</span>
            </div>
            <ng-container *ngTemplateOutlet="effectWindRow; context: { effect: 'trees', windDeg: sceneOpts.treesWindDeg }"></ng-container>
          </ng-container>

          <div class="param-row">
            <label>Relámpago</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showLightningEffect"
              (click)="toggleLightningEffect()">{{ sceneOpts.showLightningEffect ? 'ON' : 'OFF' }}</button>
          </div>

          <div class="param-row">
            <label>Bruma nocturna</label>
            <button type="button" class="section-toggle-btn" [class.active]="sceneOpts.showNightMistEffect"
              (click)="toggleNightMistEffect()">{{ sceneOpts.showNightMistEffect ? 'ON' : 'OFF' }}</button>
          </div>
          <div class="param-row" *ngIf="sceneOpts.showNightMistEffect">
            <label>Intensidad bruma</label>
            <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.nightMistIntensityPercent"
              (ngModelChange)="onNightMistIntensityChange($event)">
            <span class="param-val">{{ sceneOpts.nightMistIntensityPercent }}%</span>
          </div>

          <div class="sub-divider"></div>
          <p class="ambient-subtitle">Viento global</p>
          <p class="section-hint compact">G en cada efecto = hereda esta orientación.</p>
          <div class="param-row column">
            <div class="wind-compass-grid">
              <button type="button" class="wind-dir-btn" *ngFor="let w of windPresets"
                [class.active]="sceneOpts.ambientWindDeg === w.deg"
                (click)="onAmbientWindDirection(w.deg)">{{ w.label }}</button>
            </div>
          </div>
          <div class="param-row">
            <label>Fuerza viento</label>
            <input type="range" min="0" max="100" step="1" [ngModel]="sceneOpts.ambientWindStrengthPercent"
              (ngModelChange)="onAmbientWindStrengthChange($event)">
            <span class="param-val">{{ sceneOpts.ambientWindStrengthPercent }}%</span>
          </div>

          <div class="sub-divider"></div>
          <p class="ambient-subtitle">Zona ambiental</p>
          <p class="section-hint compact">Limita lluvia, niebla, partículas, hojas y sombras a una sección.</p>
          <div class="section-pick-grid">
            <button type="button" class="section-pick-btn"
              [class.active]="sceneOpts.rainSectionIndex === -1"
              (click)="onRainSectionChange(-1)">
              <span class="section-pick-label">Todo el parque</span>
            </button>
            <button type="button" class="section-pick-btn"
              *ngFor="let s of editableSections; let i = index"
              [class.active]="sceneOpts.rainSectionIndex === i"
              [style.borderColor]="sceneOpts.rainSectionIndex === i ? s.chartColor : null"
              (click)="onRainSectionChange(i)">
              <span class="section-pick-swatch" [style.background]="s.chartColor"></span>
              <span class="section-pick-label">{{ s.name }}</span>
            </button>
          </div>

          <ng-template #effectWindRow let-effect="effect" let-windDeg="windDeg">
            <div class="param-row column effect-wind-row">
              <label>Orientación</label>
              <div class="wind-compass-grid effect-wind">
                <button type="button" class="wind-dir-btn inherit" [class.active]="windDeg < 0"
                  (click)="onEffectWindDirection(effect, effectWindInherit)" title="Usar viento global">G</button>
                <button type="button" class="wind-dir-btn" *ngFor="let w of windPresets"
                  [class.active]="windDeg === w.deg"
                  (click)="onEffectWindDirection(effect, w.deg)">{{ w.label }}</button>
              </div>
            </div>
          </ng-template>
        </div>
      </div>

      <!-- Sistema -->
      <div class="panel-group-label" *ngIf="isAdmin">Sistema</div>

      <div class="section" *ngIf="isAdmin">
        <div class="section-header" (click)="toggleSection('config')">
          <span class="section-chevron" [class.open]="openSections.config">▸</span>
          <span class="section-title">Configuración</span>
        </div>
        <div class="section-content" *ngIf="openSections.config">
          <p class="section-card-hint">{{ 'map.sessionAutoRestore' | translate }}</p>
          <p class="section-card-hint" *ngIf="sessionSavedAt">
            {{ 'map.sessionLastSaved' | translate }}: {{ formatSessionTime(sessionSavedAt) }}
          </p>
          <div class="tool-grid cols-2 config-server-actions">
            <button class="tool-btn" (click)="emitEvent('saveConfig')" [title]="'map.saveLayersHint' | translate">
              <mat-icon class="tool-icon" aria-hidden="true">cloud_upload</mat-icon><span>{{ 'map.saveShort' | translate }}</span>
            </button>
            <button class="tool-btn" (click)="emitEvent('loadConfig')" [title]="'map.loadConfigHint' | translate">
              <mat-icon class="tool-icon" aria-hidden="true">cloud_download</mat-icon><span>{{ 'map.loadShort' | translate }}</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
      height: 100%;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      z-index: 20;
    }

    /* ── Dark theme ────────── */
    .panel-body.dark, .collapse-btn {
      --sp-bg: rgba(12, 12, 20, 0.92);
      --sp-border: rgba(255,255,255,0.1);
      --sp-text: #e0e0e0;
      --sp-text2: #888;
      --sp-accent: var(--sys-primary);
      --sp-active: color-mix(in srgb, var(--sys-primary) 12%, transparent);
      --sp-danger: var(--sys-error);
      --sp-section-bg: rgba(255,255,255,0.03);
      --sp-input-bg: rgba(255,255,255,0.05);
    }

    /* ── Light theme ───────── */
    .panel-body.light {
      --sp-bg: rgba(248, 248, 252, 0.97);
      --sp-border: rgba(0,0,0,0.1);
      --sp-text: #1a1a2a;
      --sp-text2: #666;
      --sp-accent: var(--sys-primary);
      --sp-active: color-mix(in srgb, var(--sys-primary) 8%, transparent);
      --sp-danger: var(--sys-error);
      --sp-section-bg: rgba(0,0,0,0.025);
      --sp-input-bg: rgba(0,0,0,0.04);
    }
    :host-context(.light) .collapse-btn {
      --sp-bg: rgba(248, 248, 252, 0.97);
      --sp-border: rgba(0,0,0,0.1);
      --sp-text: #1a1a2a;
      --sp-accent: var(--sys-primary);
      --sp-active: rgba(92, 45, 206, 0.08);
    }

    /* Collapse button — overlaid on map */
    .collapse-btn {
      position: absolute;
      top: 10px;
      left: 0;
      z-index: 25;
      width: 36px;
      height: 36px;
      border-radius: 0 8px 8px 0;
      border: 1.5px solid var(--sp-border);
      border-left: none;
      background: var(--sp-bg);
      color: var(--sp-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      backdrop-filter: blur(12px);
    }
    /* collapse-btn left is set via [style.left.px] binding */
    .collapse-btn.collapsed {
      border-radius: 0 8px 8px 0;
    }
    .collapse-btn:hover {
      background: var(--sp-active);
      border-color: var(--sp-accent);
    }
    .collapse-svg { color: var(--sp-text); }

    /* Panel body */
    .panel-body {
      position: relative;
      min-width: 200px;
      max-width: 500px;
      height: 100%;
      background: var(--sp-bg);
      border-right: 1px solid var(--sp-border);
      backdrop-filter: blur(16px);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 0;
      scrollbar-width: thin;
      scrollbar-color: var(--sp-accent) rgba(255,255,255,0.05);
    }

    .panel-body::-webkit-scrollbar { width: 7px; }
    .panel-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
    .panel-body::-webkit-scrollbar-thumb { background: var(--sp-accent); border-radius: 4px; min-height: 30px; }
    .panel-body::-webkit-scrollbar-thumb:hover { background: rgba(124,77,255,0.9); }

    /* ── Resize handle (right edge) ─── */
    .resize-handle-right {
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: 6px;
      cursor: ew-resize;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      transition: background 0.15s;
    }
    .resize-handle-right:hover, .resize-handle-right:active {
      background: rgba(124, 77, 255, 0.25);
    }
    .resize-grip-v {
      width: 3px; height: 40px; border-radius: 2px;
      background: var(--sp-text2, #888); opacity: 0.4;
      transition: opacity 0.15s;
    }
    .resize-handle-right:hover .resize-grip-v { opacity: 1; }

    /* Scrollable section content */
    .section-content.scrollable {
      max-height: 35vh;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: var(--sp-accent) transparent;
    }
    .section-content.scrollable::-webkit-scrollbar { width: 5px; }
    .section-content.scrollable::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 3px; }
    .section-content.scrollable::-webkit-scrollbar-thumb { background: var(--sp-accent); border-radius: 3px; min-height: 20px; }
    .section-content.scrollable::-webkit-scrollbar-thumb:hover { background: rgba(124,77,255,0.8); }

    /* Section (collapsible) */
    .section {
      border-radius: 8px;
      overflow: visible;
      background: var(--sp-section-bg);
      border: 1px solid transparent;
      transition: border-color 0.15s;
      flex-shrink: 0;
      margin-bottom: 1px;
    }
    .section:hover { border-color: rgba(255,255,255,0.05); }

    .section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .section-header:hover {
      background: rgba(255,255,255,0.04);
    }

    .section-chevron {
      font-size: 10px;
      color: var(--sp-text2);
      transition: transform 0.2s;
      display: inline-block;
    }
    .section-chevron.open { transform: rotate(90deg); }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--sp-text);
      letter-spacing: 0.3px;
      flex: 1;
    }

    .section-badge {
      font-size: 10px;
      color: var(--sp-accent);
      background: var(--sp-active);
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
    }

    .section-toggle-btn {
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-weight: 600;
      transition: all 0.15s;
    }
    .section-toggle-btn.active {
      background: var(--sp-accent);
      border-color: var(--sp-accent);
      color: #fff;
    }

    .section-content {
      padding: 4px 10px 8px;
    }

    .section-hint {
      font-size: 10px;
      color: var(--sp-text2);
      margin: 0;
      line-height: 1.4;
    }

    /* Info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding: 2px 4px;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
    }
    .info-label { color: var(--sp-text2); }
    .info-val { color: var(--sp-accent); font-family: monospace; font-size: 10px; }

    /* Tool grid */
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }

    .tool-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 4px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-size: 9px;
      font-weight: 500;
      transition: all 0.15s;
    }
    .tool-btn:hover {
      border-color: var(--sp-accent);
      color: var(--sp-text);
      background: var(--sp-active);
    }
    .tool-btn.active {
      border-color: var(--sp-accent);
      background: var(--sp-accent);
      color: #fff;
    }
    .tool-btn.danger { border-color: rgba(239,83,80,0.3); color: var(--sp-danger); }
    .tool-btn.danger:hover { background: rgba(239,83,80,0.12); border-color: var(--sp-danger); }
    .tool-icon { font-size: 16px; line-height: 1; width: 16px; height: 16px; }

    .tool-divider {
      height: 1px;
      background: var(--sp-border);
      margin: 4px 0;
    }

    /* Wide button (full width) */
    .wide-btn {
      flex-direction: row !important;
      gap: 6px !important;
      width: 100%;
      justify-content: center;
    }

    /* 2-column tool grid */
    .tool-grid.cols-2 {
      grid-template-columns: 1fr 1fr;
    }

    /* Layer mode button (Mover lienzo) */
    .layer-mode-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 5px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      transition: all 0.15s;
    }
    .layer-mode-btn:hover { border-color: var(--sp-accent); color: var(--sp-text); }
    .layer-mode-btn.active {
      background: var(--sp-active);
      border-color: var(--sp-accent);
      color: var(--sp-accent);
    }

    /* Layer row */
    .layer-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      font-size: 11px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
    }
    .layer-row:hover { background: rgba(255,255,255,0.04); border-color: var(--sp-border); }
    .layer-row.selected {
      background: var(--sp-active);
      border-color: var(--sp-accent);
    }
    .layer-row.selected .layer-label { color: var(--sp-accent); }
    .layer-label { color: var(--sp-text); font-size: 10px; font-weight: 600; min-width: 45px; }
    .layer-count { color: var(--sp-accent); font-size: 10px; min-width: 16px; text-align: center; background: var(--sp-active); padding: 1px 5px; border-radius: 8px; font-weight: 600; }
    .opacity-range { flex: 1; height: 4px; accent-color: var(--sp-accent); }
    .opacity-val { min-width: 30px; text-align: right; color: var(--sp-text2); font-size: 10px; }

    /* Layer list styles */
    .layers-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .layers-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--sp-text2);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .layer-add-btn {
      width: 22px; height: 22px;
      border-radius: 4px;
      border: 1px dashed var(--sp-border);
      background: transparent;
      color: var(--sp-accent);
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .layer-add-btn:hover { border-color: var(--sp-accent); background: var(--sp-active); }

    .layer-list {
      display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px;
    }
    .layer-item {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 6px; border-radius: 5px;
      border: 1px solid transparent;
      cursor: pointer; transition: all 0.15s;
      font-size: 10px;
    }
    .layer-item:hover { background: rgba(255,255,255,0.04); border-color: var(--sp-border); }
    .layer-item.active {
      background: var(--sp-active);
      border-color: var(--sp-accent);
    }
    .layer-vis-btn {
      background: none; border: none; cursor: pointer;
      color: var(--sp-text2); padding: 1px; display: flex;
      align-items: center; transition: color 0.15s;
    }
    .layer-vis-btn:hover { color: var(--sp-text); }
    .layer-vis-btn.hidden-layer { opacity: 0.4; }
    .layer-item-name {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; color: var(--sp-text); font-weight: 500;
    }
    .layer-item.active .layer-item-name { color: var(--sp-accent); font-weight: 600; }
    .layer-item-count {
      font-size: 9px; color: var(--sp-text2); background: rgba(255,255,255,0.06);
      padding: 1px 5px; border-radius: 6px; min-width: 16px; text-align: center;
    }
    .layer-del-btn {
      background: none; border: none; cursor: pointer;
      color: var(--sp-text2); font-size: 10px; padding: 1px 3px;
      opacity: 0; transition: all 0.15s;
    }
    .layer-item:hover .layer-del-btn { opacity: 0.6; }
    .layer-del-btn:hover { color: var(--sp-danger) !important; opacity: 1 !important; }

    .active-layer-controls {
      padding: 4px 0;
      border-top: 1px solid var(--sp-border);
      margin-top: 4px;
    }
    .layer-ctrl-label { color: var(--sp-accent) !important; font-weight: 600 !important; }
    .layer-ctrl-btn {
      width: 100%; padding: 4px 8px; border-radius: 5px;
      border: 1px solid var(--sp-border); background: transparent;
      color: var(--sp-text2); font-size: 10px; cursor: pointer;
      margin-top: 4px; transition: all 0.15s;
    }
    .layer-ctrl-btn.danger {
      border-color: rgba(239,83,80,0.3); color: var(--sp-danger);
    }
    .layer-ctrl-btn.danger:hover {
      background: rgba(239,83,80,0.12); border-color: var(--sp-danger);
    }

    /* Visibility (eye) button */
    .vis-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      color: var(--sp-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 0.9;
      transition: opacity 0.15s;
    }
    .vis-btn:hover { opacity: 1; }
    .vis-btn.hidden-layer { color: var(--sp-text2); opacity: 0.4; }
    .vis-btn.hidden-layer:hover { opacity: 0.7; }

    .toggle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }

    .toggle-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-size: 10px;
      transition: all 0.15s;
    }
    .toggle-btn:hover { border-color: var(--sp-accent); color: var(--sp-text); }
    .toggle-btn.active {
      border-color: var(--sp-accent);
      background: var(--sp-active);
      color: var(--sp-accent);
      font-weight: 600;
    }
    .toggle-icon { font-size: 12px; }

    /* Param rows (grid config) */
    .param-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 5px;
    }
    .param-row.column {
      flex-direction: column;
      align-items: stretch;
    }
    .param-row.column label {
      width: auto;
    }
    .ambient-subtitle {
      margin: 8px 0 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--sp-text2);
    }
    .section-hint.compact {
      margin: 0 0 6px;
      font-size: 9px;
      line-height: 1.35;
    }
    .scenario-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-bottom: 10px;
    }
    .scenario-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: var(--sp-surface2);
      color: var(--sp-text);
      cursor: pointer;
      font-size: 10px;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .scenario-btn:hover {
      border-color: var(--sp-accent);
      background: var(--sp-surface);
    }
    .scenario-btn.active {
      border-color: var(--sp-accent);
      background: color-mix(in srgb, var(--sp-accent) 18%, var(--sp-surface2));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--sp-accent) 35%, transparent);
    }
    .scenario-emoji {
      font-size: 14px;
      line-height: 1;
      flex-shrink: 0;
    }
    .scenario-label {
      line-height: 1.2;
      font-weight: 600;
    }
    .wind-compass-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      width: 100%;
    }
    .wind-dir-btn {
      padding: 5px 0;
      font-size: 10px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: var(--sp-section-bg);
      color: var(--sp-text2);
      cursor: pointer;
    }
    .wind-dir-btn:hover { border-color: var(--sp-accent); }
    .wind-dir-btn.active {
      background: var(--sp-accent);
      color: #fff;
      border-color: var(--sp-accent);
    }
    .wind-dir-btn.inherit {
      font-size: 9px;
    }
    .effect-wind-row label {
      width: auto;
      margin-bottom: 4px;
    }
    .wind-compass-grid.effect-wind {
      grid-template-columns: repeat(3, 1fr);
    }
    .backdrop-tree-select {
      flex: 1;
      min-width: 0;
      font-size: 10px;
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: var(--sp-section-bg);
      color: var(--sp-text);
    }
    .section-pick-btn.backdrop-zone .backdrop-swatch {
      background: linear-gradient(135deg, #8a9a84 40%, #5c6850 100%);
    }
    .variant-pick-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      width: 100%;
    }
    .variant-pick-grid.cols-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .variant-pick-btn {
      padding: 5px 4px;
      font-size: 9px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: var(--sp-section-bg);
      color: var(--sp-text2);
      cursor: pointer;
    }
    .variant-pick-btn.active {
      background: var(--sp-accent);
      color: #fff;
      border-color: var(--sp-accent);
    }
    .section-hint.warn {
      color: #e65100;
    }
    .tree-list-item {
      cursor: pointer;
    }
    .tree-list-item.selected {
      outline: 1px solid var(--sp-accent);
      border-radius: 6px;
    }
    .tree-meta {
      display: block;
      font-size: 9px;
      color: var(--sp-text2);
      margin-top: 2px;
    }
    .param-row label {
      width: 60px;
      font-size: 10px;
      color: var(--sp-text2);
      flex-shrink: 0;
    }
    .param-row input[type="range"] {
      flex: 1;
      accent-color: var(--sp-accent);
      height: 4px;
    }
    .param-val {
      width: 36px;
      text-align: right;
      font-size: 10px;
      font-family: monospace;
      color: var(--sp-accent);
    }

    .sub-divider {
      height: 1px;
      background: var(--sp-border);
      margin: 6px 0;
    }
    .mini-btn {
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-size: 11px;
      line-height: 1;
    }
    .mini-btn:hover { border-color: var(--sp-accent); color: var(--sp-text); }
    .mini-btn.danger { color: var(--sp-danger); border-color: rgba(239,83,80,0.35); }

    /* Edit mode button */
    .edit-mode-btn {
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid var(--sp-border);
      background: transparent;
      color: var(--sp-text2);
      cursor: pointer;
      font-size: 9px;
      font-weight: 500;
      transition: all 0.15s;
    }
    .edit-mode-btn.active {
      border-color: var(--sp-accent);
      background: var(--sp-active);
      color: var(--sp-accent);
    }

    .btn-danger-sm {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      opacity: 0.55;
      transition: opacity 0.15s;
      color: var(--sp-danger);
      padding: 2px;
      flex-shrink: 0;
    }
    .btn-danger-sm:hover { opacity: 1; }

    /* Search */
    .search-row { margin: 4px 0; }
    .search-input {
      width: 100%;
      box-sizing: border-box;
      background: transparent;
      border: 1px solid var(--sp-border);
      border-radius: 4px;
      color: var(--sp-text);
      padding: 4px 8px;
      font-size: 11px;
      outline: none;
    }
    .search-input:focus { border-color: var(--sp-accent); }

    /* Sticker grid */
    .sticker-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      max-height: 180px;
      overflow-y: auto;
      padding: 2px 0;
    }

    .sticker-thumb {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border: 2px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .sticker-thumb:hover { background: var(--sp-active); }
    .sticker-thumb.selected { border-color: var(--sp-accent); background: var(--sp-active); }
    .sticker-thumb img { width: 40px; height: 40px; object-fit: contain; pointer-events: none; }
    .thumb-label {
      font-size: 8px; text-align: center; color: var(--sp-text2);
      max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .placement-hint {
      text-align: center;
      padding: 4px;
      background: rgba(124, 77, 255, 0.1);
      border: 1px dashed var(--sp-accent);
      border-radius: 6px;
      font-size: 10px;
      color: var(--sp-accent);
      margin-top: 4px;
    }

    /* Properties */
    .prop-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 5px;
    }
    .prop-row label { width: 52px; font-size: 10px; color: var(--sp-text2); flex-shrink: 0; }
    .prop-row input[type="range"] { flex: 1; accent-color: var(--sp-accent); height: 4px; }
    .prop-value { width: 38px; text-align: right; font-size: 10px; font-family: monospace; color: var(--sp-accent); }
    .coord-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--sp-border);
      border-radius: 4px;
      color: var(--sp-accent);
      padding: 3px 6px;
      font-size: 10px;
      font-family: monospace;
      outline: none;
      min-width: 0;
    }
    .coord-input:focus { border-color: var(--sp-accent); }

    /* Color picker */
    .color-pick {
      width: 28px; height: 22px; border: 1px solid var(--sp-border);
      border-radius: 4px; background: transparent; cursor: pointer; padding: 0;
    }
    .color-pick::-webkit-color-swatch-wrapper { padding: 1px; }
    .color-pick::-webkit-color-swatch { border-radius: 2px; border: none; }
    .color-hex { font-family: monospace; font-size: 9px; width: auto; }

    /* Style select */
    .style-select {
      flex: 1; background: var(--sp-input-bg); border: 1px solid var(--sp-border);
      border-radius: 4px; color: var(--sp-text); padding: 2px 4px;
      font-size: 10px; outline: none; cursor: pointer;
    }
    .style-select:focus { border-color: var(--sp-accent); }

    /* Numeric input for cell size */
    .num-input {
      width: 52px; background: var(--sp-input-bg); border: 1px solid var(--sp-border);
      border-radius: 4px; color: var(--sp-text); padding: 2px 4px;
      font-size: 10px; text-align: center; outline: none;
    }
    .num-input:focus { border-color: var(--sp-accent); }

    kbd {
      display: inline-block;
      padding: 1px 4px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 3px;
      font-size: 9px;
      font-family: monospace;
    }

    .section-editor-block .section-editor-content {
      max-height: 50vh;
    }

    .section-editor-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin: 6px 0;
    }

    .vertices-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 600;
      color: var(--sp-text2);
      margin: 4px 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .vertices-hint {
      font-weight: 400;
      text-transform: none;
      font-size: 9px;
    }

    .vertex-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 240px;
      overflow-y: auto;
    }

    .vertex-item {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      padding: 6px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }

    .vertex-item:hover {
      border-color: rgba(255, 152, 0, 0.5);
    }

    .vertex-item.selected {
      border-color: #ff9800;
      background: rgba(255, 152, 0, 0.12);
    }

    .vertex-index {
      font-size: 10px;
      font-weight: 700;
      color: #ff9800;
      min-width: 22px;
      padding-top: 4px;
    }

    .vertex-coords {
      flex: 1;
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 4px 6px;
      align-items: center;
    }

    .vertex-coords label {
      font-size: 9px;
      color: var(--sp-text2);
    }

    .section-pick-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }

    .section-pick-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 2px solid var(--sp-border);
      background: var(--sp-input-bg);
      color: var(--sp-text);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      text-align: left;
      transition: all 0.15s;
    }

    .section-pick-btn:hover {
      border-color: rgba(255, 152, 0, 0.55);
      background: rgba(255, 152, 0, 0.08);
    }

    .section-pick-btn.active {
      background: rgba(255, 152, 0, 0.14);
      box-shadow: 0 0 0 1px rgba(255, 152, 0, 0.25);
    }

    .spatial-ref-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 8px 0 10px;
    }

    .spatial-ref-item {
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--sp-border);
      background: var(--sp-input-bg);
    }

    .spatial-ref-item.placing {
      border-color: #ff9800;
      box-shadow: 0 0 0 1px rgba(255, 152, 0, 0.35);
    }

    .spatial-ref-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
    }

    .spatial-ref-cat {
      color: var(--sp-text2);
      font-size: 10px;
      text-transform: uppercase;
    }

    .spatial-ref-coords {
      font-size: 10px;
      color: var(--sp-text2);
      margin: 4px 0 6px;
      font-family: monospace;
    }

    .spatial-ref-item.selected {
      border-color: #42a5f5;
      box-shadow: 0 0 0 1px rgba(66, 165, 245, 0.35);
    }

    .spatial-ref-textarea {
      width: 100%;
      min-height: 72px;
      margin: 6px 0 10px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--sp-border);
      background: var(--sp-input-bg);
      color: var(--sp-text);
      font-size: 11px;
      resize: vertical;
      box-sizing: border-box;
    }

    .marker-style-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .marker-style-btn {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      background: var(--sp-input-bg);
      color: var(--sp-text);
      font-size: 10px;
      cursor: pointer;
    }

    .marker-style-btn.active {
      border-color: #42a5f5;
      background: rgba(66, 165, 245, 0.15);
    }

    .section-edu-label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--sp-text2);
      margin: 8px 0 4px;
    }

    .section-pick-swatch {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }

    .section-pick-label {
      flex: 1;
    }

    .section-card-hint {
      margin: 4px 0 8px;
    }

    .panel-group-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--sp-text2);
      padding: 10px 12px 4px;
    }

    .config-server-actions { margin-top: 4px; }
  `]
})
export class StickerPanelComponent implements OnChanges {
  readonly windPresets = WIND_DIRECTION_PRESETS;
  readonly effectWindInherit = EFFECT_WIND_INHERIT;
  readonly backdropTreeSection = BACKDROP_TREE_SECTION;
  readonly treeVariantLabels = TREE_VARIANT_LABELS;
  readonly treeEcoLabels = TREE_ECO_LABELS;
  @Input() isDarkTheme = true;
  @Input() isAdmin = false;
  @Input() mapViewInfo: MapViewInfo | null = null;
  @Input() coordPickerActive = false;
  @Input() editableSections: ParkSectionRecord[] = [];
  @Input() sectionEditorActive = false;
  @Input() activeSectionIndex = 0;
  @Input() selectedVertexIndex: number | null = null;
  @Input() addVertexMode = false;
  @Input() treeEditorActive = false;
  @Input() treePlaceActive = false;
  @Input() treeEditorSectionIndex = 0;
  @Input() selectedTreeIndex: number | null = null;
  @Input() treePlaceVariant: 0 | 1 | 2 = 0;
  @Input() treePlaceStyleSection = 1;
  @Input() treePlacementHint = '';
  @Input() ambientTrees: AmbientTreeSlot[] = [];
  @Input() spatialReferences: SpatialReference[] = [];
  @Input() spatialPlaceIndex = -1;
  @Input() activeSpatialRefIndex = 0;
  @Input() sessionSavedAt: string | null = null;
  @Input() sceneOpts = {
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
    rainWindDeg: EFFECT_WIND_INHERIT,
    fogWindDeg: EFFECT_WIND_INHERIT,
    motesWindDeg: EFFECT_WIND_INHERIT,
    cloudShadowWindDeg: EFFECT_WIND_INHERIT,
    leavesWindDeg: EFFECT_WIND_INHERIT,
    treesWindDeg: EFFECT_WIND_INHERIT,
  };
  @Input() spatialRefsOpts = {
    showSpatialReferences: true,
    spatialAnimPercent: 100,
  };

  readonly markerStyles = SPATIAL_REFERENCE_MARKER_STYLES;
  readonly spatialRefSummary = spatialReferenceSummary;

  @Output() mapControlEvent = new EventEmitter<MapControlEvent>();
  @Output() panelToggled = new EventEmitter<boolean>();

  collapsed = false;

  /** Local mirror of map options */
  localOpts = { showSections: true, showLabels: true, showBoundary: true, showMarkers: true, showGroundTextures: true };

  /** Resize state */
  panelWidth = 280;
  private readonly MIN_PANEL_WIDTH = 200;
  private readonly MAX_PANEL_WIDTH = 500;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundResizeMove: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private boundResizeEnd: (() => void) | null = null;

  /** Marker dot size (px) */
  localMarkerSize = 10;
  localGroundTilePx: number = PARK_MAP_VIS.groundTilePx;
  readonly groundTileMin = PARK_MAP_VIS.groundTileMin;
  readonly groundTileMax = PARK_MAP_VIS.groundTileMax;

  /** Collapsible sections state */
  openSections = {
    layers: true,
    sectionEditor: false,
    treeEditor: false,
    scene: false,
    spatialRefs: false,
    info: true,
    config: false,
  };

  spatialRefSearchTerm = '';

  get filteredSpatialReferences(): Array<{ ref: SpatialReference; index: number }> {
    const term = this.spatialRefSearchTerm.toLowerCase().trim();
    return this.spatialReferences
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) =>
        !term
        || ref.name.toLowerCase().includes(term)
        || ref.category.toLowerCase().includes(term)
      );
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mapViewInfo'] && this.mapViewInfo) {
      this.localOpts = {
        showSections: this.mapViewInfo.showSections,
        showLabels: this.mapViewInfo.showLabels,
        showGroundTextures: this.mapViewInfo.showGroundTextures ?? true,
        showBoundary: this.mapViewInfo.showBoundary,
        showMarkers: this.mapViewInfo.showMarkers,
      };
      this.localGroundTilePx = this.mapViewInfo.groundTilePx ?? PARK_MAP_VIS.groundTilePx;
      this.cdr.markForCheck();
    }
  }

  toggleSection(key: keyof typeof this.openSections): void {
    this.openSections[key] = !this.openSections[key];
  }

  togglePanel(): void {
    this.collapsed = !this.collapsed;
    this.panelToggled.emit(this.collapsed);
  }

  // ── Panel resize ──────────────────────────────────────────
  onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.startResize(e.clientX);
    this.boundResizeMove = (ev: MouseEvent | TouchEvent) => {
      const x = ev instanceof MouseEvent ? ev.clientX : ev.touches[0].clientX;
      this.onResizeMove(x);
    };
    this.boundResizeEnd = () => this.onResizeEnd();
    document.addEventListener('mousemove', this.boundResizeMove as any);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  onResizeTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    this.startResize(e.touches[0].clientX);
    this.boundResizeMove = (ev: MouseEvent | TouchEvent) => {
      const x = ev instanceof MouseEvent ? ev.clientX : ev.touches[0].clientX;
      this.onResizeMove(x);
    };
    this.boundResizeEnd = () => this.onResizeEnd();
    document.addEventListener('touchmove', this.boundResizeMove as any, { passive: false });
    document.addEventListener('touchend', this.boundResizeEnd);
  }

  private startResize(clientX: number): void {
    this.isResizing = true;
    this.resizeStartX = clientX;
    this.resizeStartWidth = this.panelWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  private onResizeMove(clientX: number): void {
    if (!this.isResizing) return;
    const delta = clientX - this.resizeStartX;
    this.panelWidth = Math.max(this.MIN_PANEL_WIDTH, Math.min(this.MAX_PANEL_WIDTH, this.resizeStartWidth + delta));
    this.cdr.markForCheck();
  }

  private onResizeEnd(): void {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (this.boundResizeMove) {
      document.removeEventListener('mousemove', this.boundResizeMove as any);
      document.removeEventListener('touchmove', this.boundResizeMove as any);
      this.boundResizeMove = null;
    }
    if (this.boundResizeEnd) {
      document.removeEventListener('mouseup', this.boundResizeEnd);
      document.removeEventListener('touchend', this.boundResizeEnd);
      this.boundResizeEnd = null;
    }
    this.panelToggled.emit(this.collapsed); // trigger canvas resize
    this.cdr.markForCheck();
  }

  get activePolygon(): Array<{ lat: number; lng: number }> {
    return this.editableSections[this.activeSectionIndex]?.polygon ?? [];
  }

  get activeSection() {
    return this.editableSections[this.activeSectionIndex] ?? null;
  }

  get treesInSelectedZone(): Array<{ tree: AmbientTreeSlot; index: number }> {
    return this.ambientTrees
      .map((tree, index) => ({ tree, index }))
      .filter(({ tree }) => tree.section === this.treeEditorSectionIndex);
  }

  get selectedTree(): AmbientTreeSlot | null {
    if (this.selectedTreeIndex === null) return null;
    return this.ambientTrees[this.selectedTreeIndex] ?? null;
  }

  get selectedTreeScalePercent(): number {
    return Math.round((this.selectedTree?.scale ?? 1) * 100);
  }

  treeCountForZone(sectionIndex: number): number {
    return this.ambientTrees.filter((t) => t.section === sectionIndex).length;
  }

  toggleSectionEditor(): void {
    this.openSections.sectionEditor = true;
    this.mapControlEvent.emit({ type: 'toggleSectionEditor' });
  }

  onSectionIndexChange(index: number): void {
    this.mapControlEvent.emit({ type: 'setSectionEditorIndex', index });
  }

  onSectionColorChange(hex: string): void {
    this.mapControlEvent.emit({
      type: 'updateSectionColor',
      sectionIndex: this.activeSectionIndex,
      hex,
    });
  }

  sectionFillOpacityPercent(sec: ParkSectionRecord, which: 'dark' | 'light'): number {
    const ops = resolveSectionFillOpacities(sec);
    return Math.round((which === 'dark' ? ops.dark : ops.light) * 100);
  }

  onSectionFillOpacityChange(which: 'dark' | 'light', percent: number): void {
    this.mapControlEvent.emit({
      type: 'updateSectionFillOpacity',
      sectionIndex: this.activeSectionIndex,
      which,
      opacity: Math.min(100, Math.max(0, Number(percent) || 0)) / 100,
    });
  }

  get activeSpatialRef(): SpatialReference | null {
    return this.spatialReferences[this.activeSpatialRefIndex] ?? null;
  }

  markerStyleLabel(st: SpatialReferenceMarkerStyle): string {
    const labels: Record<SpatialReferenceMarkerStyle, string> = {
      circle: '○ Círculo',
      pin: '▼ Pin',
      square: '□ Cuadrado',
      marker: '📍 Marcador',
    };
    return labels[st];
  }

  applyAmbientScenario(id: string): void {
    this.mapControlEvent.emit({ type: 'applyAmbientScenario', scenarioId: id });
    this.cdr.markForCheck();
  }

  toggleTreeEditor(): void {
    this.openSections.treeEditor = true;
    this.mapControlEvent.emit({ type: 'toggleTreeEditor' });
  }

  onTreeEditorSectionChange(index: number): void {
    this.mapControlEvent.emit({ type: 'setTreeEditorSection', index });
  }

  onTreePlaceVariant(variant: number): void {
    this.mapControlEvent.emit({ type: 'setTreePlaceVariant', variant: variant as 0 | 1 | 2 });
  }

  onTreePlaceStyleSection(section: number): void {
    this.mapControlEvent.emit({ type: 'setTreePlaceStyleSection', section });
  }

  onSelectAmbientTree(index: number): void {
    this.mapControlEvent.emit({ type: 'selectAmbientTree', index });
  }

  removeSelectedTree(): void {
    if (this.selectedTreeIndex === null) return;
    this.removeAmbientTree(this.selectedTreeIndex);
  }

  onSelectedTreeScaleChange(percent: number): void {
    if (this.selectedTreeIndex === null) return;
    this.mapControlEvent.emit({
      type: 'updateAmbientTree',
      index: this.selectedTreeIndex,
      patch: { scale: Math.min(2, Math.max(0.5, (Number(percent) || 100) / 100)) },
    });
  }

  toggleTreePlaceActive(): void {
    this.mapControlEvent.emit({ type: 'setTreePlaceActive', active: !this.treePlaceActive });
  }

  removeAmbientTree(index: number): void {
    this.mapControlEvent.emit({ type: 'removeAmbientTree', index });
  }

  exportAmbientTrees(): void {
    this.mapControlEvent.emit({ type: 'exportAmbientTrees' });
  }

  toggleRainEffect(): void {
    const next = !this.sceneOpts.showRainEffect;
    this.sceneOpts.showRainEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showRainEffect', value: next });
    this.cdr.markForCheck();
  }

  toggleSpatialRefs(): void {
    const next = !this.spatialRefsOpts.showSpatialReferences;
    this.spatialRefsOpts.showSpatialReferences = next;
    this.mapControlEvent.emit({ type: 'spatialRefsOptionChange', value: next });
    this.cdr.markForCheck();
  }

  onRainIntensityChange(percent: number): void {
    this.sceneOpts.rainIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({
      type: 'rainIntensityChange',
      value: this.sceneOpts.rainIntensityPercent / 100,
    });
    this.cdr.markForCheck();
  }

  onRainSizeChange(percent: number): void {
    this.sceneOpts.rainSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({
      type: 'rainSizeChange',
      value: this.sceneOpts.rainSizePercent / 100,
    });
    this.cdr.markForCheck();
  }

  toggleFogEffect(): void {
    const next = !this.sceneOpts.showFogEffect;
    this.sceneOpts.showFogEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showFogEffect', value: next });
    this.cdr.markForCheck();
  }

  onFogIntensityChange(percent: number): void {
    this.sceneOpts.fogIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'fogIntensityChange', value: this.sceneOpts.fogIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onFogSizeChange(percent: number): void {
    this.sceneOpts.fogSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({ type: 'fogSizeChange', value: this.sceneOpts.fogSizePercent / 100 });
    this.cdr.markForCheck();
  }

  toggleMotesEffect(): void {
    const next = !this.sceneOpts.showMotesEffect;
    this.sceneOpts.showMotesEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showMotesEffect', value: next });
    this.cdr.markForCheck();
  }

  onMotesIntensityChange(percent: number): void {
    this.sceneOpts.motesIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'motesIntensityChange', value: this.sceneOpts.motesIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onMotesSizeChange(percent: number): void {
    this.sceneOpts.motesSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({ type: 'motesSizeChange', value: this.sceneOpts.motesSizePercent / 100 });
    this.cdr.markForCheck();
  }

  toggleCloudShadows(): void {
    const next = !this.sceneOpts.showCloudShadows;
    this.sceneOpts.showCloudShadows = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showCloudShadows', value: next });
    this.cdr.markForCheck();
  }

  onCloudShadowIntensityChange(percent: number): void {
    this.sceneOpts.cloudShadowIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'cloudShadowIntensityChange', value: this.sceneOpts.cloudShadowIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onCloudShadowSizeChange(percent: number): void {
    this.sceneOpts.cloudShadowSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({ type: 'cloudShadowSizeChange', value: this.sceneOpts.cloudShadowSizePercent / 100 });
    this.cdr.markForCheck();
  }

  toggleLeavesEffect(): void {
    const next = !this.sceneOpts.showLeavesEffect;
    this.sceneOpts.showLeavesEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showLeavesEffect', value: next });
    this.cdr.markForCheck();
  }

  onLeavesIntensityChange(percent: number): void {
    this.sceneOpts.leavesIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'leavesIntensityChange', value: this.sceneOpts.leavesIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onLeavesSizeChange(percent: number): void {
    this.sceneOpts.leavesSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({ type: 'leavesSizeChange', value: this.sceneOpts.leavesSizePercent / 100 });
    this.cdr.markForCheck();
  }

  toggleTreesEffect(): void {
    const next = !this.sceneOpts.showTreesEffect;
    this.sceneOpts.showTreesEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showTreesEffect', value: next });
    this.cdr.markForCheck();
  }

  onTreesIntensityChange(percent: number): void {
    this.sceneOpts.treesIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'treesIntensityChange', value: this.sceneOpts.treesIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onTreesSizeChange(percent: number): void {
    this.sceneOpts.treesSizePercent = Math.min(200, Math.max(8, Number(percent) || 100));
    this.mapControlEvent.emit({ type: 'treesSizeChange', value: this.sceneOpts.treesSizePercent / 100 });
    this.cdr.markForCheck();
  }

  toggleLightningEffect(): void {
    const next = !this.sceneOpts.showLightningEffect;
    this.sceneOpts.showLightningEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showLightningEffect', value: next });
    this.cdr.markForCheck();
  }

  toggleNightMistEffect(): void {
    const next = !this.sceneOpts.showNightMistEffect;
    this.sceneOpts.showNightMistEffect = next;
    this.mapControlEvent.emit({ type: 'sceneOptionChange', option: 'showNightMistEffect', value: next });
    this.cdr.markForCheck();
  }

  onNightMistIntensityChange(percent: number): void {
    this.sceneOpts.nightMistIntensityPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'nightMistIntensityChange', value: this.sceneOpts.nightMistIntensityPercent / 100 });
    this.cdr.markForCheck();
  }

  onAmbientWindDirection(deg: number): void {
    this.sceneOpts.ambientWindDeg = deg;
    this.mapControlEvent.emit({ type: 'ambientWindDirectionChange', deg });
    this.cdr.markForCheck();
  }

  onAmbientWindStrengthChange(percent: number): void {
    this.sceneOpts.ambientWindStrengthPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    this.mapControlEvent.emit({ type: 'ambientWindStrengthChange', value: this.sceneOpts.ambientWindStrengthPercent / 100 });
    this.cdr.markForCheck();
  }

  onRainSectionChange(index: number): void {
    if (this.sceneOpts.rainSectionIndex === index) return;
    this.sceneOpts.rainSectionIndex = index;
    this.mapControlEvent.emit({ type: 'rainSectionChange', sectionIndex: index });
    this.cdr.markForCheck();
  }

  onSpatialAnimSpeedChange(percent: number): void {
    this.spatialRefsOpts.spatialAnimPercent = Math.min(200, Math.max(20, Number(percent) || 100));
    this.mapControlEvent.emit({
      type: 'spatialAnimSpeedChange',
      value: this.spatialRefsOpts.spatialAnimPercent / 100,
    });
    this.cdr.markForCheck();
  }

  selectSpatialRef(index: number): void {
    this.mapControlEvent.emit({ type: 'selectSpatialReferenceIndex', index });
    this.cdr.markForCheck();
  }

  onMarkerStyleChange(style: SpatialReferenceMarkerStyle): void {
    this.onSpatialRefPatch({ markerStyle: style });
  }

  onSpatialRefPatch(patch: Partial<SpatialReference>): void {
    this.mapControlEvent.emit({
      type: 'updateSpatialReference',
      index: this.activeSpatialRefIndex,
      patch,
    });
    this.cdr.markForCheck();
  }

  onSpatialRefSummaryChange(text: string): void {
    const ref = this.activeSpatialRef;
    if (!ref) return;
    this.onSpatialRefPatch({
      summary: text,
      education: { ...ref.education, summary: text, referenceImageUrl: ref.education?.referenceImageUrl },
    });
  }

  toggleSpatialPlace(index: number): void {
    const next = this.spatialPlaceIndex === index ? -1 : index;
    this.mapControlEvent.emit({ type: 'setSpatialReferencePlaceIndex', index: next });
    this.cdr.markForCheck();
  }

  exportSpatialReferences(): void {
    this.mapControlEvent.emit({ type: 'exportSpatialReferencesJson' });
  }

  selectVertex(vertexIndex: number): void {
    this.mapControlEvent.emit({ type: 'setSectionEditorVertex', vertexIndex });
  }

  toggleAddVertexMode(): void {
    this.mapControlEvent.emit({ type: 'setSectionEditorAddVertex', enabled: !this.addVertexMode });
  }

  deleteSelectedVertex(): void {
    if (this.selectedVertexIndex === null) return;
    this.mapControlEvent.emit({
      type: 'deleteSectionVertex',
      sectionIndex: this.activeSectionIndex,
      vertexIndex: this.selectedVertexIndex,
    });
  }

  onVertexFieldChange(vertexIndex: number, field: 'lat' | 'lng', value: number): void {
    const v = this.activePolygon[vertexIndex];
    if (!v || Number.isNaN(value)) return;
    this.mapControlEvent.emit({
      type: 'updateSectionVertex',
      sectionIndex: this.activeSectionIndex,
      vertexIndex,
      lat: field === 'lat' ? value : v.lat,
      lng: field === 'lng' ? value : v.lng,
    });
  }

  exportSections(): void {
    this.mapControlEvent.emit({ type: 'exportSectionsJson' });
  }

  resetSections(): void {
    if (confirm('¿Restaurar los polígonos originales del repositorio? Se perderán los cambios no exportados.')) {
      this.mapControlEvent.emit({ type: 'resetSections' });
    }
  }

  emitEvent(type: 'centerMap' | 'toggleCoordPicker' | 'saveConfig' | 'loadConfig'): void {
    this.mapControlEvent.emit({ type } as MapControlEvent);
  }

  formatSessionTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  toggleOpt(option: 'showSections' | 'showLabels' | 'showBoundary' | 'showMarkers' | 'showGroundTextures'): void {
    (this.localOpts as any)[option] = !(this.localOpts as any)[option];
    this.mapControlEvent.emit({ type: 'optionChange', option, value: (this.localOpts as any)[option] });
  }

  // ── Marker size ────────────────────────────────────────
  onMarkerSizeChange(size: number): void {
    this.localMarkerSize = size;
    this.mapControlEvent.emit({ type: 'markerSize', value: size } as MapControlEvent);
  }

  onGroundTilePxChange(px: number): void {
    this.localGroundTilePx = px;
    this.mapControlEvent.emit({ type: 'groundTilePxChange', value: px });
  }

  onEffectWindDirection(effect: AmbientEffectWindKey, deg: number): void {
    switch (effect) {
      case 'rain': this.sceneOpts.rainWindDeg = deg; break;
      case 'fog': this.sceneOpts.fogWindDeg = deg; break;
      case 'motes': this.sceneOpts.motesWindDeg = deg; break;
      case 'cloudShadows': this.sceneOpts.cloudShadowWindDeg = deg; break;
      case 'leaves': this.sceneOpts.leavesWindDeg = deg; break;
      case 'trees': this.sceneOpts.treesWindDeg = deg; break;
    }
    this.mapControlEvent.emit({ type: 'effectWindDirectionChange', effect, deg });
  }
}
