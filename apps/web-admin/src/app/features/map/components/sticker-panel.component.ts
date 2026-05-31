import {
  Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output,
  SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { StickerLayerService } from '../services/sticker-layer.service';
import {
  StickerDefinition,
  StickerInstance,
  StickerLayer
} from '../models/sticker.model';
import { TilesetConfig } from './tileset-panel.component';

/** Event fired by the panel to control the map from outside */
export type MapControlEvent =
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'rotateLeft' }
  | { type: 'rotateRight' }
  | { type: 'reset' }
  | { type: 'optionChange'; option: 'showSections' | 'showLabels' | 'showCanvasGrid' | 'showTilemap' | 'showBoundary' | 'showMarkers'; value: boolean }
  | { type: 'canvasGridCellSize'; cellW: number; cellH: number }
  | { type: 'canvasGridOpacity'; value: number }
  | { type: 'canvasGridColor'; value: string }
  | { type: 'canvasGridStyle'; value: 'solid' | 'dashed' | 'dotted' }
  | { type: 'canvasGridRotation'; value: number }
  | { type: 'centerMap' }
  | { type: 'toggleCoordPicker' }
  | { type: 'saveConfig' }
  | { type: 'loadConfig' }
  | { type: 'clearStickers' }
  | { type: 'clearPaintedTiles' }
  | { type: 'toggleEditorMode' }
  | { type: 'toggleFullscreen' }
  | { type: 'markerSize'; value: number }
  | { type: 'selectMovableLayer'; layer: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers' }
  | { type: 'loadTileset'; tileset: { name: string; thumbnailUrl: string; imageUrl: string; config: TilesetConfig } }
  | { type: 'refImage'; dataUrl: string | null }
  | { type: 'refImageOpacity'; value: number };

/** Current map view info emitted by MapControlComponent */
export interface MapViewInfo {
  lat: number;
  lng: number;
  zoom: number;
  rotDeg: number;
  showSections: boolean;
  showLabels: boolean;
  showCanvasGrid: boolean;
  showBoundary: boolean;
  showMarkers: boolean;
  canvasGridCellW: number;
  canvasGridCellH: number;
  canvasGridOpacity: number;
  canvasGridColor: string;
  canvasGridStyle: 'solid' | 'dashed' | 'dotted';
  canvasGridRotation: number;
}

/**
 * Unified Map Panel — single sidebar for ALL map controls.
 *
 *  Collapsible sections:
 *    1. Información — lat / lng / zoom / rotation
 *    2. Herramientas — center, GPS picker, save, load, clear
 *    3. Capas de mapa — grid, sections, labels, boundary toggles
 *    4. Cuadrícula — toggle, divisions, opacity
 *    5. Editor de tiles — toggle tile editor mode
 *    6. Stickers — palette, opacity, drag-and-drop
 *    7. Propiedades — selected sticker properties
 */
@Component({
  selector: 'app-sticker-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

      <!-- 1. CAPAS -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('layers')">
          <span class="section-chevron" [class.open]="openSections.layers">▸</span>
          <span class="section-title">Capas</span>
          <span class="section-badge">{{ allLayers.length }}</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.layers">
          <button class="tool-btn wide-btn" (click)="emitEvent('toggleFullscreen')" title="Pantalla completa">
            <span class="tool-icon">⛶</span><span>Pantalla completa</span>
          </button>
          <div class="tool-divider"></div>
          <!-- Selectable layers: click to move only that layer -->
          <button class="layer-mode-btn" [class.active]="activeMovableLayer === 'canvas'"
            (click)="selectMovableLayer('canvas')" title="Mover todo el lienzo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
            </svg>
            <span>Mover lienzo</span>
          </button>
          <div class="layer-row" [class.selected]="activeMovableLayer === 'grid'" (click)="selectMovableLayer('grid')">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showCanvasGrid"
              (click)="toggleOpt('showCanvasGrid'); $event.stopPropagation()" title="Mostrar/ocultar cuadrícula">
              <svg *ngIf="localOpts.showCanvasGrid" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="!localOpts.showCanvasGrid" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="layer-label">Cuadrícula</span>
          </div>
          <div class="layer-row" [class.selected]="activeMovableLayer === 'boundary'" (click)="selectMovableLayer('boundary')">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showBoundary"
              (click)="toggleOpt('showBoundary'); $event.stopPropagation()" title="Mostrar/ocultar contorno">
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
          <div class="layer-row" [class.selected]="activeMovableLayer === 'sections'" (click)="selectMovableLayer('sections')">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showSections"
              (click)="toggleOpt('showSections'); $event.stopPropagation()" title="Mostrar/ocultar secciones">
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
          <div class="layer-row" [class.selected]="activeMovableLayer === 'markers'" (click)="selectMovableLayer('markers')">
            <button class="vis-btn" [class.hidden-layer]="!localOpts.showMarkers"
              (click)="toggleOpt('showMarkers'); $event.stopPropagation()" title="Mostrar/ocultar marcadores">
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
          <!-- Marker size control -->
          <div class="param-row">
            <label>Marcadores</label>
            <input type="range" min="4" max="24" step="1" [ngModel]="localMarkerSize"
              (ngModelChange)="onMarkerSizeChange($event)">
            <span class="param-val">{{ localMarkerSize }}px</span>
          </div>
          <div class="tool-divider"></div>
          <!-- Sticker layers list -->
          <div class="layers-header">
            <span class="layers-title">Capas de stickers</span>
            <button class="layer-add-btn" (click)="addNewLayer()" title="Crear nueva capa">+</button>
          </div>
          <div class="layer-list">
            <div class="layer-item" *ngFor="let layer of allLayers"
              [class.active]="layer.id === activeLayerId"
              (click)="selectLayer(layer.id)">
              <button class="layer-vis-btn" [class.hidden-layer]="!layer.visible"
                (click)="toggleLayerVisibility(layer.id); $event.stopPropagation()"
                [title]="layer.visible ? 'Ocultar capa' : 'Mostrar capa'">
                <svg *ngIf="layer.visible" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg *ngIf="!layer.visible" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
              <span class="layer-item-name">{{ layer.name }}</span>
              <span class="layer-item-count">{{ layer.stickers.length }}</span>
              <button class="layer-del-btn" *ngIf="allLayers.length > 1"
                (click)="deleteLayer(layer.id); $event.stopPropagation()" title="Eliminar capa">✕</button>
            </div>
          </div>
          <!-- Active layer controls -->
          <div class="active-layer-controls" *ngIf="activeLayer">
            <div class="param-row">
              <label class="layer-ctrl-label">Opacidad</label>
              <input type="range" class="opacity-range" min="0" max="1" step="0.05"
                [ngModel]="activeLayer.opacity"
                (ngModelChange)="onLayerOpacityChange($event)">
              <span class="opacity-val">{{ (activeLayer.opacity * 100) | number:'1.0-0' }}%</span>
            </div>
            <button class="layer-ctrl-btn danger" (click)="onClearAllStickers()" title="Eliminar stickers de la capa activa">
              🗑️ Limpiar capa
            </button>
          </div>
        </div>
      </div>

      <!-- 2. HERRAMIENTAS -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('tools')">
          <span class="section-chevron" [class.open]="openSections.tools">▸</span>
          <span class="section-title">Herramientas</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.tools">
          <div class="tool-grid">
            <button class="tool-btn" (click)="emitEvent('centerMap')" title="Centrar mapa">
              <span class="tool-icon">⌖</span><span>Centro</span>
            </button>
            <button class="tool-btn" [class.active]="coordPickerActive" (click)="emitEvent('toggleCoordPicker')" title="Copiar coordenadas GPS">
              <span class="tool-icon">📍</span><span>GPS</span>
            </button>
            <button class="tool-btn" (click)="emit('zoomIn')" title="Acercar">
              <span class="tool-icon">🔍</span><span>Zoom +</span>
            </button>
            <button class="tool-btn" (click)="emit('zoomOut')" title="Alejar">
              <span class="tool-icon">🔎</span><span>Zoom −</span>
            </button>
            <button class="tool-btn" (click)="emit('rotateLeft')" title="Rotar izquierda">
              <span class="tool-icon">↺</span><span>Rotar ←</span>
            </button>
            <button class="tool-btn" (click)="emit('rotateRight')" title="Rotar derecha">
              <span class="tool-icon">↻</span><span>Rotar →</span>
            </button>
            <button class="tool-btn" (click)="emit('reset')" title="Restablecer vista">
              <span class="tool-icon">⟲</span><span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 3. EDITOR DE TILES -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('tileEditor')">
          <span class="section-chevron" [class.open]="openSections.tileEditor">▸</span>
          <span class="section-title">Editor de tiles</span>
          <button class="section-toggle-btn" [class.active]="tileEditorActive" (click)="emitEvent('toggleEditorMode'); $event.stopPropagation()" title="Activar/desactivar editor de tiles">
            {{ tileEditorActive ? 'ON' : 'OFF' }}
          </button>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.tileEditor">
          <div class="tile-shortcuts" *ngIf="tileEditorActive">
            <kbd>B</kbd> Pintar · <kbd>R</kbd> Rect · <kbd>L</kbd> Línea · <kbd>G</kbd> Balde · <kbd>E</kbd> Borrar
          </div>
          <div class="tile-actions" *ngIf="tileEditorActive">
            <button class="tool-btn danger-btn" (click)="emitEvent('clearPaintedTiles')" title="Borrar todos los tiles pintados">🗑️ Limpiar tiles</button>
          </div>
          <p class="section-hint" *ngIf="!tileEditorActive">
            Activa el editor para pintar tiles sobre la cuadrícula.
          </p>
        </div>
      </div>

      <!-- 5. CUADRÍCULA DE TILES -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('canvasGrid')">
          <span class="section-chevron" [class.open]="openSections.canvasGrid">▸</span>
          <span class="section-title">Cuadrícula de tiles</span>
          <button class="section-toggle-btn" [class.active]="localOpts.showCanvasGrid" (click)="toggleOpt('showCanvasGrid'); $event.stopPropagation()" title="Activar/desactivar cuadrícula">
            {{ localOpts.showCanvasGrid ? 'ON' : 'OFF' }}
          </button>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.canvasGrid">
          <div class="param-row">
            <label>Ancho celda</label>
            <input type="number" class="num-input" [min]="1" [max]="512" [step]="1" [ngModel]="localGridCellW"
              (ngModelChange)="onGridCellSizeChange($event, localGridCellH)">
            <span class="param-val">px</span>
          </div>
          <div class="param-row">
            <label>Alto celda</label>
            <input type="number" class="num-input" [min]="1" [max]="512" [step]="1" [ngModel]="localGridCellH"
              (ngModelChange)="onGridCellSizeChange(localGridCellW, $event)">
            <span class="param-val">px</span>
          </div>
          <div class="param-row">
            <label>Opacidad</label>
            <input type="range" [min]="0.02" [max]="1" [step]="0.01" [ngModel]="localGridOpacity"
              (ngModelChange)="onGridOpacityChange($event)">
            <span class="param-val">{{ (localGridOpacity * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="param-row">
            <label>Color</label>
            <input type="color" class="color-pick" [ngModel]="localGridColor"
              (ngModelChange)="onGridColorChange($event)">
            <span class="param-val color-hex">{{ localGridColor }}</span>
          </div>
          <div class="param-row">
            <label>Estilo</label>
            <select class="style-select" [ngModel]="localGridStyle" (ngModelChange)="onGridStyleChange($event)">
              <option value="solid">Sólido</option>
              <option value="dashed">Rayado</option>
              <option value="dotted">Puntos</option>
            </select>
          </div>
          <div class="param-row">
            <label>Rotación</label>
            <input type="range" [min]="-180" [max]="180" [step]="1" [ngModel]="localGridRotation"
              (ngModelChange)="onGridRotationChange($event)">
            <span class="param-val">{{ localGridRotation }}°</span>
          </div>

          <div class="sub-divider"></div>
          <div class="param-row">
            <label>Tilemap visible</label>
            <button class="section-toggle-btn" [class.active]="localOpts.showTilemap" (click)="toggleOpt('showTilemap')"
              title="Mostrar/ocultar capa de tiles pintados">
              {{ localOpts.showTilemap ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="sub-divider"></div>
          <div class="param-row">
            <label>Imagen de ref.</label>
            <button class="mini-btn" (click)="refImageInput.click()" title="Subir imagen de referencia">📂</button>
            <button class="mini-btn" *ngIf="refImageName" (click)="clearRefImage()" title="Quitar imagen">✕</button>
            <span class="param-val" style="max-width: 80px; overflow: hidden; text-overflow: ellipsis;">{{ refImageName || '—' }}</span>
            <input #refImageInput type="file" accept="image/*" hidden (change)="onRefImagePicked($event)">
          </div>
          <div class="param-row" *ngIf="refImageName">
            <label>Opac. ref.</label>
            <input type="range" [min]="0" [max]="1" [step]="0.01" [ngModel]="refImageOpacity"
              (ngModelChange)="onRefImageOpacityChange($event)">
            <span class="param-val">{{ (refImageOpacity * 100) | number:'1.0-0' }}%</span>
          </div>
        </div>
      </div>

      <!-- 6. STICKERS -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('stickers')">
          <span class="section-chevron" [class.open]="openSections.stickers">▸</span>
          <span class="section-title">Stickers</span>
          <span class="section-badge">{{ activeLayer?.stickers?.length ?? 0 }}</span>
          <button class="edit-mode-btn" [class.active]="isEditMode" (click)="toggleEditMode(); $event.stopPropagation()">
            {{ isEditMode ? '✏️ Editando' : 'Editar' }}
          </button>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.stickers">
          <!-- Search -->
          <div class="search-row">
            <input type="text" class="search-input" placeholder="Buscar sticker…"
              [(ngModel)]="searchTerm">
          </div>

          <!-- Palette grid -->
          <div class="sticker-grid">
            <div *ngFor="let s of filteredStickers" class="sticker-thumb"
              [class.selected]="selectedPaletteKey === s.key"
              (click)="onStickerSelect(s)"
              draggable="true"
              (dragstart)="onDragStart($event, s)"
              (dragend)="onDragEnd($event)">
              <img [src]="s.imagePath" [alt]="s.name">
              <span class="thumb-label">{{ s.name }}</span>
            </div>
          </div>

          <div class="placement-hint" *ngIf="selectedPaletteKey">
            Click en el mapa para colocar sticker
          </div>
        </div>
      </div>

      <!-- 7. TILESETS -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('tilesets')">
          <span class="section-chevron" [class.open]="openSections.tilesets">▸</span>
          <span class="section-title">Tilesets</span>
          <span class="section-badge">{{ savedTilesets.length }}</span>
        </div>
        <div class="section-content scrollable" *ngIf="openSections.tilesets">
          <div class="tileset-upload-row">
            <button class="tool-btn wide-btn" (click)="tilesetFileInput.click()" title="Subir imagen de tileset">
              <span class="tool-icon">📦</span><span>Subir tileset</span>
            </button>
            <input #tilesetFileInput type="file" accept="image/*" hidden (change)="onTilesetFileSelected($event)">
          </div>
          <div class="tileset-list" *ngIf="savedTilesets.length > 0">
            <div class="tileset-item" *ngFor="let ts of savedTilesets; let i = index"
              (click)="onTilesetClick(i)" [class.active]="activeTilesetIndex === i">
              <img [src]="ts.thumbnailUrl" class="tileset-thumb-img" [alt]="ts.name">
              <div class="tileset-meta">
                <span class="tileset-name">{{ ts.name }}</span>
                <span class="tileset-info">{{ ts.config.cols }}×{{ ts.config.rows }} · {{ ts.config.tileWidth }}×{{ ts.config.tileHeight }}px</span>
              </div>
              <button class="btn-danger-sm" (click)="removeTileset(i); $event.stopPropagation()" title="Eliminar">🗑️</button>
            </div>
          </div>
          <p class="section-hint" *ngIf="savedTilesets.length === 0">
            Sube imágenes de tileset para usarlas en el editor de tiles.
          </p>
        </div>
      </div>

      <!-- 8. PROPIEDADES (selected sticker) -->
      <div class="section" *ngIf="selectedSticker">
        <div class="section-header" (click)="toggleSection('properties')">
          <span class="section-chevron" [class.open]="openSections.properties">▸</span>
          <span class="section-title">Propiedades</span>
          <button class="btn-danger-sm" (click)="onRemoveSticker(); $event.stopPropagation()" title="Eliminar sticker">🗑️</button>
        </div>
        <div class="section-content" *ngIf="openSections.properties">
          <div class="prop-row">
            <label>Escala</label>
            <input type="range" min="0.1" max="5" step="0.1" [ngModel]="selectedSticker.scale"
              (ngModelChange)="onPropertyChange('scale', $event)">
            <span class="prop-value">{{ selectedSticker.scale | number:'1.1-1' }}</span>
          </div>
          <div class="prop-row">
            <label>Rotación</label>
            <input type="range" min="0" max="360" step="1" [ngModel]="selectedSticker.rotation"
              (ngModelChange)="onPropertyChange('rotation', $event)">
            <span class="prop-value">{{ selectedSticker.rotation | number:'1.0-0' }}°</span>
          </div>
          <div class="prop-row">
            <label>Lat</label>
            <input class="coord-input" type="number" step="0.000001" [ngModel]="selectedSticker.lat"
              (ngModelChange)="onPropertyChange('lat', $event)">
          </div>
          <div class="prop-row">
            <label>Lng</label>
            <input class="coord-input" type="number" step="0.000001" [ngModel]="selectedSticker.lng"
              (ngModelChange)="onPropertyChange('lng', $event)">
          </div>
        </div>
      </div>

      <!-- 8. INFORMACIÓN -->
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

      <!-- 9. CONFIGURACIÓN (last) -->
      <div class="section">
        <div class="section-header" (click)="toggleSection('config')">
          <span class="section-chevron" [class.open]="openSections.config">▸</span>
          <span class="section-title">Configuración</span>
        </div>
        <div class="section-content" *ngIf="openSections.config">
          <div class="tool-grid cols-2">
            <button class="tool-btn" (click)="emitEvent('saveConfig')" title="Guardar configuración de todas las capas">
              <span class="tool-icon">💾</span><span>Guardar</span>
            </button>
            <button class="tool-btn" (click)="emitEvent('loadConfig')" title="Cargar configuración guardada">
              <span class="tool-icon">📂</span><span>Cargar</span>
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
      --sp-accent: #7c4dff;
      --sp-active: rgba(124, 77, 255, 0.12);
      --sp-danger: #ef5350;
      --sp-section-bg: rgba(255,255,255,0.03);
      --sp-input-bg: rgba(255,255,255,0.05);
    }

    /* ── Light theme ───────── */
    .panel-body.light {
      --sp-bg: rgba(248, 248, 252, 0.97);
      --sp-border: rgba(0,0,0,0.1);
      --sp-text: #1a1a2a;
      --sp-text2: #666;
      --sp-accent: #5c2dce;
      --sp-active: rgba(92, 45, 206, 0.08);
      --sp-danger: #d32f2f;
      --sp-section-bg: rgba(0,0,0,0.025);
      --sp-input-bg: rgba(0,0,0,0.04);
    }
    :host-context(.light) .collapse-btn {
      --sp-bg: rgba(248, 248, 252, 0.97);
      --sp-border: rgba(0,0,0,0.1);
      --sp-text: #1a1a2a;
      --sp-accent: #5c2dce;
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
    .tool-icon { font-size: 16px; line-height: 1; }

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



    /* Tileset list */
    .tileset-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    .tileset-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px solid var(--sp-border);
      cursor: pointer;
      transition: all 0.15s;
    }
    .tileset-item:hover { background: var(--sp-active); border-color: var(--sp-accent); }
    .tileset-item.active { border-color: var(--sp-accent); background: var(--sp-active); }
    .tileset-thumb-img {
      width: 36px; height: 36px; object-fit: cover;
      border-radius: 4px; border: 1px solid var(--sp-border);
      flex-shrink: 0;
    }
    .tileset-meta {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 1px;
    }
    .tileset-name {
      font-size: 10px; font-weight: 600; color: var(--sp-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .tileset-info { font-size: 9px; color: var(--sp-text2); }
    .tileset-upload-row { margin-bottom: 4px; }
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

    /* Tile shortcuts */
    .tile-shortcuts {
      font-size: 9px; color: var(--sp-text2); margin-top: 4px; line-height: 1.7;
    }
    .tile-actions {
      margin-top: 6px;
    }
    .tile-actions .danger-btn {
      background: rgba(239,83,80,0.12); border-color: var(--sp-danger); color: var(--sp-danger);
    }
    .tile-actions .danger-btn:hover { background: rgba(239,83,80,0.25); }

    kbd {
      display: inline-block;
      padding: 1px 4px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 3px;
      font-size: 9px;
      font-family: monospace;
    }
  `]
})
export class StickerPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isDarkTheme = true;
  @Input() isAdmin = false;
  @Input() selectedSticker: StickerInstance | null = null;
  @Input() mapViewInfo: MapViewInfo | null = null;
  @Input() tileEditorActive = false;
  @Input() coordPickerActive = false;

  @Output() stickerSelected = new EventEmitter<string>();
  @Output() stickerChanged = new EventEmitter<StickerInstance>();
  @Output() stickerRemoved = new EventEmitter<string>();
  @Output() editModeChanged = new EventEmitter<boolean>();
  @Output() layersChanged = new EventEmitter<void>();
  @Output() mapControlEvent = new EventEmitter<MapControlEvent>();
  @Output() panelToggled = new EventEmitter<boolean>();

  private destroy$ = new Subject<void>();

  activeLayer: StickerLayer | null = null;
  allLayers: StickerLayer[] = [];
  activeLayerId: string | null = null;
  isEditMode = false;
  collapsed = true;

  catalog: StickerDefinition[] = [];
  searchTerm = '';
  selectedPaletteKey: string | null = null;

  /** Local mirror of map options */
  localOpts = { showSections: true, showLabels: true, showCanvasGrid: false, showTilemap: true, showBoundary: true, showMarkers: true };
  localGridCellW = 32;
  localGridCellH = 32;
  localGridOpacity = 0.15;
  localGridColor = '#ffffff';
  localGridStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  localGridRotation = 0;

  /** Reference image for tilemap background */
  refImageName = '';
  refImageOpacity = 0.5;

  /** Lock state for grid & boundary layers */
  activeMovableLayer: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers' = 'canvas';

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

  /** Saved tilesets for quick access */
  savedTilesets: { name: string; thumbnailUrl: string; imageUrl: string; config: TilesetConfig }[] = [];
  activeTilesetIndex = -1;

  /** Collapsible sections state — all collapsed by default */
  openSections = {
    layers: false,
    tools: false,
    info: false,
    tileEditor: false,
    canvasGrid: false,
    stickers: false,
    tilesets: false,
    properties: false,
    config: false,
  };

  get filteredStickers(): StickerDefinition[] {
    if (!this.searchTerm) return this.catalog;
    const term = this.searchTerm.toLowerCase();
    return this.catalog.filter(s =>
      s.name.toLowerCase().includes(term) || s.key.includes(term)
    );
  }

  constructor(
    private stickerService: StickerLayerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.catalog = this.stickerService.getAvailableStickers();
    this.stickerService.ensureSingleLayer();

    this.stickerService.layers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(layers => {
        this.allLayers = layers;
        this.activeLayer = this.stickerService.getActiveLayer() ?? null;
        this.layersChanged.emit();
        this.cdr.markForCheck();
      });

    this.stickerService.activeLayerId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        this.activeLayerId = id;
        this.activeLayer = this.stickerService.getActiveLayer() ?? null;
        this.cdr.markForCheck();
      });

    this.stickerService.editMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        this.isEditMode = mode;
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mapViewInfo'] && this.mapViewInfo) {
      this.localOpts = {
        showSections: this.mapViewInfo.showSections,
        showLabels: this.mapViewInfo.showLabels,
        showCanvasGrid: this.mapViewInfo.showCanvasGrid,
        showTilemap: (this.mapViewInfo as any).showTilemap ?? true,
        showBoundary: this.mapViewInfo.showBoundary,
        showMarkers: this.mapViewInfo.showMarkers,
      };
      this.localGridCellW = this.mapViewInfo.canvasGridCellW;
      this.localGridCellH = this.mapViewInfo.canvasGridCellH;
      this.localGridOpacity = this.mapViewInfo.canvasGridOpacity;
      if (this.mapViewInfo.canvasGridColor) this.localGridColor = this.mapViewInfo.canvasGridColor;
      if (this.mapViewInfo.canvasGridStyle) this.localGridStyle = this.mapViewInfo.canvasGridStyle;
      if (this.mapViewInfo.canvasGridRotation != null) this.localGridRotation = this.mapViewInfo.canvasGridRotation;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSection(key: keyof typeof this.openSections): void {
    this.openSections[key] = !this.openSections[key];
  }

  togglePanel(): void {
    this.collapsed = !this.collapsed;
    if (!this.collapsed) {
      if (!this.isEditMode) {
        this.stickerService.setEditMode(true);
        this.editModeChanged.emit(true);
      }
    } else {
      if (this.isEditMode) {
        this.stickerService.setEditMode(false);
        this.editModeChanged.emit(false);
        this.selectedPaletteKey = null;
      }
    }
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

  toggleEditMode(): void {
    const next = !this.isEditMode;
    this.stickerService.setEditMode(next);
    this.editModeChanged.emit(next);
    if (!next) this.selectedPaletteKey = null;
  }

  emit(type: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset'): void {
    this.mapControlEvent.emit({ type });
  }

  emitEvent(type: 'centerMap' | 'toggleCoordPicker' | 'saveConfig' | 'loadConfig' | 'clearStickers' | 'clearPaintedTiles' | 'toggleEditorMode' | 'toggleFullscreen'): void {
    this.mapControlEvent.emit({ type } as MapControlEvent);
  }

  toggleOpt(option: 'showSections' | 'showLabels' | 'showCanvasGrid' | 'showTilemap' | 'showBoundary' | 'showMarkers'): void {
    (this.localOpts as any)[option] = !(this.localOpts as any)[option];
    this.mapControlEvent.emit({ type: 'optionChange', option, value: (this.localOpts as any)[option] });
  }

  onGridCellSizeChange(cellW: number, cellH: number): void {
    this.localGridCellW = cellW;
    this.localGridCellH = cellH;
    this.mapControlEvent.emit({ type: 'canvasGridCellSize', cellW, cellH });
  }

  onGridOpacityChange(value: number): void {
    this.localGridOpacity = value;
    this.mapControlEvent.emit({ type: 'canvasGridOpacity', value });
  }

  onGridColorChange(value: string): void {
    this.localGridColor = value;
    this.mapControlEvent.emit({ type: 'canvasGridColor', value });
  }

  onGridStyleChange(value: 'solid' | 'dashed' | 'dotted'): void {
    this.localGridStyle = value;
    this.mapControlEvent.emit({ type: 'canvasGridStyle', value });
  }

  onGridRotationChange(value: number): void {
    this.localGridRotation = value;
    this.mapControlEvent.emit({ type: 'canvasGridRotation', value });
  }

  onRefImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.refImageName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.mapControlEvent.emit({ type: 'refImage', dataUrl: reader.result as string });
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearRefImage(): void {
    this.refImageName = '';
    this.mapControlEvent.emit({ type: 'refImage', dataUrl: null });
  }

  onRefImageOpacityChange(value: number): void {
    this.refImageOpacity = value;
    this.mapControlEvent.emit({ type: 'refImageOpacity', value });
  }

  onStickerSelect(sticker: StickerDefinition): void {
    if (this.selectedPaletteKey === sticker.key) {
      this.selectedPaletteKey = null;
      this.stickerSelected.emit('');
    } else {
      this.selectedPaletteKey = sticker.key;
      this.stickerSelected.emit(sticker.key);
    }
  }

  onDragStart(event: DragEvent, sticker: StickerDefinition): void {
    event.dataTransfer?.setData('text/plain', sticker.key);
    const img = (event.currentTarget as HTMLElement).querySelector('img');
    if (img && event.dataTransfer) {
      event.dataTransfer.setDragImage(img, 25, 25);
    }
  }

  onDragEnd(event: DragEvent): void {
    (event.target as HTMLElement)?.blur();
    this.selectedPaletteKey = null;
    this.cdr.markForCheck();
  }

  onPropertyChange(prop: 'scale' | 'rotation' | 'lat' | 'lng', value: number): void {
    if (!this.selectedSticker) return;
    const updated = { ...this.selectedSticker, [prop]: +value };
    this.stickerChanged.emit(updated);
  }

  onLayerOpacityChange(value: number): void {
    if (!this.activeLayer) return;
    this.stickerService.setLayerOpacity(this.activeLayer.id, +value);
    this.layersChanged.emit();
  }

  onClearAllStickers(): void {
    if (!this.activeLayer) return;
    if (confirm('¿Eliminar todos los stickers de la capa?')) {
      this.stickerService.clearAllStickers(this.activeLayer.id);
      this.layersChanged.emit();
    }
  }

  onRemoveSticker(): void {
    if (!this.selectedSticker) return;
    this.stickerRemoved.emit(this.selectedSticker.id);
  }

  clearPaletteSelection(): void {
    this.selectedPaletteKey = null;
  }

  // ── Movable layer selection ────────────────────────────
  selectMovableLayer(layer: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers'): void {
    this.activeMovableLayer = layer;
    this.mapControlEvent.emit({ type: 'selectMovableLayer', layer });
  }

  // ── Layer management ───────────────────────────────────
  selectLayer(layerId: string): void {
    this.stickerService.setActiveLayer(layerId);
  }

  addNewLayer(): void {
    const count = this.allLayers.length + 1;
    this.stickerService.createLayer(`Capa ${count}`);
    this.layersChanged.emit();
  }

  toggleLayerVisibility(layerId: string): void {
    this.stickerService.toggleLayerVisibility(layerId);
    this.layersChanged.emit();
  }

  deleteLayer(layerId: string): void {
    this.stickerService.deleteLayer(layerId);
    this.layersChanged.emit();
  }

  // ── Marker size ────────────────────────────────────────
  onMarkerSizeChange(size: number): void {
    this.localMarkerSize = size;
    this.mapControlEvent.emit({ type: 'markerSize', value: size } as MapControlEvent);
  }

  // ── Tileset management ─────────────────────────────────
  onTilesetFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) { input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const config: TilesetConfig = {
          imageUrl: url, tileWidth: 32, tileHeight: 32,
          offsetX: 0, offsetY: 0, separationX: 0, separationY: 0,
          cols: Math.max(1, Math.floor(img.naturalWidth / 32)),
          rows: Math.max(1, Math.floor(img.naturalHeight / 32)),
        };
        this.savedTilesets.push({
          name: file.name.replace(/\.[^.]+$/, ''),
          thumbnailUrl: url, imageUrl: url, config,
        });
        this.cdr.markForCheck();
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onTilesetClick(index: number): void {
    this.activeTilesetIndex = index;
    this.mapControlEvent.emit({ type: 'loadTileset', tileset: this.savedTilesets[index] } as MapControlEvent);
  }

  removeTileset(index: number): void {
    this.savedTilesets.splice(index, 1);
    if (this.activeTilesetIndex === index) this.activeTilesetIndex = -1;
    else if (this.activeTilesetIndex > index) this.activeTilesetIndex--;
    this.cdr.markForCheck();
  }
}
