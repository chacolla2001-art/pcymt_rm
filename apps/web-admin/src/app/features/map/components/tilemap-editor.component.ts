import {
  Component, OnInit, OnDestroy,
  Inject, PLATFORM_ID, ChangeDetectorRef, Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { MapTileService } from '../services/map-tile.service';
import { StickerLayerService } from '../services/sticker-layer.service';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';
import {
  TilemapLayer,
  TilemapLayerData,
  TilesetDefinition,
  TileExportItem,
  TileManifest,
} from '../models/map-tile.model';
import { STICKER_CATALOG, StickerDefinition } from '../models/sticker.model';

/** Park bounds (WGS84) matching backend */
const PARK_BOUNDS = {
  minLat: -16.4921, maxLat: -16.4866,
  minLng: -68.1469, maxLng: -68.1446,
};

const TILE_SIZE = 512;

type EditorTool = 'select' | 'pan' | 'brush' | 'eraser' | 'fill' |
  'sticker' | 'text' | 'line' | 'polygon' | 'measure' | 'coordinate';

@Component({
  selector: 'app-tilemap-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatSliderModule, MatProgressBarModule, MatSnackBarModule,
  ],
  template: `
    <div class="editor-panel" [class.dark]="isDarkTheme">
      <!-- Compact toolbar (fits sidebar width) -->
      <div class="editor-toolbar">
        <div class="tool-grid">
          <button *ngFor="let tool of tools"
                  class="tool-btn"
                  [class.active]="activeTool === tool.id"
                  [matTooltip]="tool.tip + (tool.shortcut ? ' (' + tool.shortcut + ')' : '')"
                  matTooltipPosition="left"
                  (click)="setTool(tool.id)">
            <mat-icon>{{ tool.icon }}</mat-icon>
          </button>
        </div>
        <div class="toolbar-actions">
          <button mat-icon-button matTooltip="Deshacer (Ctrl+Z)" (click)="undo()"
                  [disabled]="undoStack.length === 0" class="action-btn">
            <mat-icon>undo</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Rehacer (Ctrl+Y)" (click)="redo()"
                  [disabled]="redoStack.length === 0" class="action-btn">
            <mat-icon>redo</mat-icon>
          </button>
          <span class="toolbar-spacer"></span>
          <button mat-icon-button matTooltip="Exportar (Ctrl+E)" (click)="exportTiles()"
                  class="action-btn">
            <mat-icon>file_download</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Publicar (Ctrl+Shift+P)" (click)="publishTiles()"
                  class="action-btn publish-btn">
            <mat-icon>cloud_upload</mat-icon>
          </button>
          <span *ngIf="currentManifest" class="version-badge">v{{ currentManifest.version }}</span>
          <span *ngIf="!currentManifest" class="version-badge unpublished">Sin publicar</span>
        </div>
      </div>

      <mat-progress-bar *ngIf="isPublishing" mode="indeterminate" color="accent"></mat-progress-bar>

      <!-- Scrollable sidebar content -->
      <div class="editor-content">

        <!-- Layers -->
        <div class="sidebar-section">
          <div class="section-header" (click)="toggleSection('layers')">
            <mat-icon class="section-chevron" [class.open]="openSections.layers">expand_more</mat-icon>
            <span>Capas</span>
            <span class="section-count">{{ layers.length }}</span>
            <button mat-icon-button matTooltip="Nueva capa" (click)="addLayer(); $event.stopPropagation()">
              <mat-icon>add</mat-icon>
            </button>
          </div>
          <div class="section-body" *ngIf="openSections.layers">
            <div *ngFor="let layer of layers"
                 class="layer-item"
                 [class.active]="activeLayerId === layer.id"
                 (click)="selectLayer(layer.id)">
              <button mat-icon-button (click)="toggleLayerVisibility(layer.id); $event.stopPropagation()">
                <mat-icon>{{ layer.visible ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              <span class="layer-name" [class.locked]="layer.locked">{{ layer.name }}</span>
              <button mat-icon-button (click)="toggleLayerLock(layer.id); $event.stopPropagation()">
                <mat-icon>{{ layer.locked ? 'lock' : 'lock_open' }}</mat-icon>
              </button>
              <button mat-icon-button (click)="removeLayer(layer.id); $event.stopPropagation()"
                      [disabled]="layers.length <= 1">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Sprites (Sprout Lands pack) -->
        <div class="sidebar-section">
          <div class="section-header" (click)="toggleSection('sprites')">
            <mat-icon class="section-chevron" [class.open]="openSections.sprites">expand_more</mat-icon>
            <span>Sprites</span>
            <span class="section-count">{{ spriteCatalog.length }}</span>
          </div>
          <div class="section-body" *ngIf="openSections.sprites">
            <div class="sprite-tabs">
              <button *ngFor="let cat of spriteCategories"
                      class="sprite-tab" [class.active]="activeSpriteCategory === cat.id"
                      (click)="activeSpriteCategory = cat.id">
                {{ cat.label }}
              </button>
            </div>
            <div class="sprite-grid">
              <div *ngFor="let sp of filteredSprites" class="sprite-item"
                   [class.active]="placingStickerKey === sp.key"
                   (click)="selectSprite(sp.key)"
                   [matTooltip]="sp.name">
                <img [src]="sp.imagePath" [alt]="sp.name">
              </div>
            </div>
          </div>
        </div>

        <!-- Tilesets (uploaded) -->
        <div class="sidebar-section">
          <div class="section-header" (click)="toggleSection('tilesets')">
            <mat-icon class="section-chevron" [class.open]="openSections.tilesets">expand_more</mat-icon>
            <span>Tilesets</span>
            <span class="section-count">{{ tilesets.length }}</span>
            <button mat-icon-button matTooltip="Subir tileset" (click)="tilesetInput.click(); $event.stopPropagation()">
              <mat-icon>upload</mat-icon>
            </button>
            <input #tilesetInput type="file" accept="image/png,image/jpeg,image/svg+xml"
                   (change)="onTilesetFileSelected($event)" hidden>
          </div>
          <div class="section-body" *ngIf="openSections.tilesets">
            <div *ngFor="let ts of tilesets" class="tileset-item"
                 [class.active]="activeTilesetKey === ts.key"
                 (click)="selectTileset(ts.key)">
              <img [src]="ts.imageUrl" [alt]="ts.name" class="tileset-thumb">
              <span>{{ ts.name }}</span>
            </div>
            <div *ngIf="tilesets.length === 0" class="empty-hint">
              Sube un tileset para pintar sobre el mapa
            </div>
          </div>
        </div>

        <!-- Stickers (park map stickers) -->
        <div class="sidebar-section">
          <div class="section-header" (click)="toggleSection('stickers')">
            <mat-icon class="section-chevron" [class.open]="openSections.stickers">expand_more</mat-icon>
            <span>Stickers</span>
            <span class="section-count">{{ stickerCatalog.length }}</span>
            <button mat-icon-button matTooltip="Subir sticker" (click)="stickerInput.click(); $event.stopPropagation()">
              <mat-icon>upload</mat-icon>
            </button>
            <input #stickerInput type="file" accept="image/png,image/svg+xml"
                   (change)="onStickerFileSelected($event)" hidden>
          </div>
          <div class="section-body" *ngIf="openSections.stickers">
            <div class="sticker-grid">
              <div *ngFor="let s of stickerCatalog" class="sticker-item"
                   [class.active]="placingStickerKey === s.key"
                   (click)="selectSticker(s.key)"
                   [matTooltip]="s.name">
                <img [src]="s.imagePath" [alt]="s.name">
              </div>
            </div>
          </div>
        </div>

        <!-- Properties (visible when item selected) -->
        <div class="sidebar-section" *ngIf="selectedItem">
          <div class="section-header">
            <mat-icon class="section-chevron open">expand_more</mat-icon>
            <span>Propiedades</span>
            <button mat-icon-button matTooltip="Eliminar item" (click)="deleteSelectedItem()" class="del-btn">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <div class="section-body">
            <div class="props-grid">
              <label>Lat</label>
              <input type="number" [(ngModel)]="selectedItem.lat" step="0.0001" (change)="onPropertyChanged()">
              <label>Lng</label>
              <input type="number" [(ngModel)]="selectedItem.lng" step="0.0001" (change)="onPropertyChanged()">
              <label>Escala</label>
              <input type="number" [(ngModel)]="selectedItem.scale" step="0.1" min="0.1" max="10" (change)="onPropertyChanged()">
              <label>Rot°</label>
              <input type="number" [(ngModel)]="selectedItem.rotation" step="5" min="0" max="360" (change)="onPropertyChanged()">
              <label>Opac.</label>
              <input type="number" [(ngModel)]="selectedItem.opacity" step="0.1" min="0" max="1" (change)="onPropertyChanged()">
            </div>
          </div>
        </div>
      </div>

      <!-- Status bar -->
      <div class="editor-status">
        <span>{{ cursorLat.toFixed(4) }}, {{ cursorLng.toFixed(4) }}</span>
        <span class="status-sep">·</span>
        <span>{{ layers.length }}L · {{ totalItems }}items</span>
        <span class="status-right" [class.saved]="!hasUnsavedChanges">
          {{ hasUnsavedChanges ? '● Sin guardar' : '✓ Guardado' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .editor-panel {
      display: flex; flex-direction: column; height: 100%;
      background: #1a1a2e; color: #ccc; font-size: 12px;
      overflow: hidden; border-left: 1px solid #2d2d5e;
    }

    /* ── Toolbar ── */
    .editor-toolbar {
      padding: 6px; background: #0f0f1e; border-bottom: 1px solid #2d2d5e; flex-shrink: 0;
    }
    .tool-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; margin-bottom: 4px;
    }
    .tool-btn {
      display: flex; align-items: center; justify-content: center;
      width: 100%; aspect-ratio: 1; border: none; border-radius: 6px;
      background: transparent; color: #999; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .tool-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tool-btn:hover { background: rgba(255,255,255,0.08); color: #ddd; }
    .tool-btn.active { background: rgba(124,131,255,0.25); color: #a5aaff; }
    .toolbar-actions { display: flex; align-items: center; gap: 2px; }
    .action-btn { transform: scale(0.8); color: #888; }
    .action-btn:disabled { opacity: 0.3; }
    .publish-btn { color: #34C759 !important; }
    .toolbar-spacer { flex: 1; }
    .version-badge {
      font-size: 9px; padding: 2px 6px; border-radius: 8px;
      background: rgba(52,199,89,0.15); color: #34C759; white-space: nowrap;
    }
    .version-badge.unpublished { background: rgba(255,149,0,0.15); color: #FF9500; }

    /* ── Scrollable content ── */
    .editor-content { flex: 1; overflow-y: auto; }

    /* ── Collapsible sections ── */
    .sidebar-section { border-bottom: 1px solid #2d2d5e; }
    .section-header {
      display: flex; align-items: center; gap: 4px; padding: 6px 8px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #7c83ff; cursor: pointer; user-select: none;
    }
    .section-header:hover { background: rgba(255,255,255,0.03); }
    .section-header button { transform: scale(0.65); margin-left: auto; }
    .section-chevron {
      font-size: 18px; width: 18px; height: 18px;
      transition: transform 0.2s; transform: rotate(-90deg);
    }
    .section-chevron.open { transform: rotate(0deg); }
    .section-count {
      font-size: 9px; font-weight: 400; color: #666;
      background: rgba(255,255,255,0.06); border-radius: 8px; padding: 1px 6px;
    }
    .section-body { padding: 4px 8px 8px; }

    /* ── Layers ── */
    .layer-item {
      display: flex; align-items: center; gap: 1px;
      padding: 2px; border-radius: 4px; cursor: pointer;
    }
    .layer-item:hover { background: rgba(255,255,255,0.05); }
    .layer-item.active { background: rgba(124,131,255,0.12); }
    .layer-item button { transform: scale(0.55); flex-shrink: 0; }
    .layer-name {
      flex: 1; font-size: 11px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .layer-name.locked { opacity: 0.4; font-style: italic; }

    /* ── Sprites ── */
    .sprite-tabs { display: flex; gap: 2px; margin-bottom: 6px; flex-wrap: wrap; }
    .sprite-tab {
      font-size: 10px; padding: 3px 8px; border-radius: 10px;
      border: 1px solid #2d2d5e; background: transparent;
      color: #888; cursor: pointer; transition: all 0.15s;
    }
    .sprite-tab:hover { border-color: #7c83ff; color: #aaa; }
    .sprite-tab.active { background: rgba(124,131,255,0.2); border-color: #7c83ff; color: #a5aaff; }
    .sprite-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
      max-height: 200px; overflow-y: auto;
    }
    .sprite-item {
      aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
      cursor: pointer; border-radius: 4px; border: 1px solid transparent;
      background: rgba(255,255,255,0.02); image-rendering: pixelated;
    }
    .sprite-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(124,131,255,0.3); }
    .sprite-item.active { border-color: #7c83ff; background: rgba(124,131,255,0.15); }
    .sprite-item img { width: 90%; height: 90%; object-fit: contain; image-rendering: pixelated; }

    /* ── Tilesets ── */
    .tileset-item {
      display: flex; align-items: center; gap: 6px; padding: 4px;
      border-radius: 4px; cursor: pointer;
    }
    .tileset-item:hover { background: rgba(255,255,255,0.05); }
    .tileset-item.active { background: rgba(124,131,255,0.15); border: 1px solid #7c83ff; }
    .tileset-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 4px; image-rendering: pixelated; }
    .empty-hint { font-size: 10px; color: #555; padding: 8px; text-align: center; }

    /* ── Stickers ── */
    .sticker-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
      max-height: 160px; overflow-y: auto;
    }
    .sticker-item {
      aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
      cursor: pointer; border-radius: 4px; border: 1px solid transparent;
    }
    .sticker-item:hover { background: rgba(255,255,255,0.05); }
    .sticker-item.active { border-color: #7c83ff; background: rgba(124,131,255,0.12); }
    .sticker-item img { width: 80%; height: 80%; object-fit: contain; }

    /* ── Properties ── */
    .props-grid {
      display: grid; grid-template-columns: 42px 1fr; gap: 3px 6px;
      align-items: center; font-size: 11px;
    }
    .props-grid label { color: #888; font-size: 10px; text-align: right; }
    .props-grid input {
      background: #13132a; border: 1px solid #2d2d5e; color: #a5aaff;
      border-radius: 4px; padding: 3px 6px; font-size: 11px;
      width: 100%; box-sizing: border-box;
    }
    .props-grid input:focus { border-color: #7c83ff; outline: none; }
    .del-btn { color: #ef5350 !important; }

    /* ── Status bar ── */
    .editor-status {
      display: flex; align-items: center; gap: 8px; padding: 3px 8px;
      background: #0f0f1e; border-top: 1px solid #2d2d5e;
      font-size: 10px; color: #555; flex-shrink: 0;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }
    .status-sep { color: #333; }
    .status-right { margin-left: auto; font-family: inherit; color: #FF9500; }
    .status-right.saved { color: #34C759; }

    /* ── Light theme overrides ── */
    .editor-panel:not(.dark) { background: #f5f2ee; color: #333; border-left-color: #d0ccc4; }
    .editor-panel:not(.dark) .editor-toolbar { background: #e8e4de; border-bottom-color: #d0ccc4; }
    .editor-panel:not(.dark) .tool-btn { color: #888; }
    .editor-panel:not(.dark) .tool-btn:hover { background: rgba(0,0,0,0.06); color: #555; }
    .editor-panel:not(.dark) .tool-btn.active { background: rgba(51,85,204,0.15); color: #3355cc; }
    .editor-panel:not(.dark) .sidebar-section { border-bottom-color: #d0ccc4; }
    .editor-panel:not(.dark) .section-header { color: #3355cc; }
    .editor-panel:not(.dark) .section-header:hover { background: rgba(0,0,0,0.03); }
    .editor-panel:not(.dark) .layer-item:hover { background: rgba(0,0,0,0.04); }
    .editor-panel:not(.dark) .layer-item.active { background: rgba(51,85,204,0.1); }
    .editor-panel:not(.dark) .sprite-tab { border-color: #d0ccc4; color: #777; }
    .editor-panel:not(.dark) .sprite-tab.active { background: rgba(51,85,204,0.12); border-color: #3355cc; color: #3355cc; }
    .editor-panel:not(.dark) .sprite-item { background: rgba(0,0,0,0.02); }
    .editor-panel:not(.dark) .sprite-item:hover { background: rgba(0,0,0,0.05); }
    .editor-panel:not(.dark) .sprite-item.active { border-color: #3355cc; background: rgba(51,85,204,0.1); }
    .editor-panel:not(.dark) .tileset-item:hover { background: rgba(0,0,0,0.04); }
    .editor-panel:not(.dark) .tileset-item.active { background: rgba(51,85,204,0.12); border-color: #3355cc; }
    .editor-panel:not(.dark) .sticker-item:hover { background: rgba(0,0,0,0.04); }
    .editor-panel:not(.dark) .sticker-item.active { border-color: #3355cc; background: rgba(51,85,204,0.08); }
    .editor-panel:not(.dark) .props-grid input { background: #fff; border-color: #d0ccc4; color: #333; }
    .editor-panel:not(.dark) .props-grid input:focus { border-color: #3355cc; }
    .editor-panel:not(.dark) .editor-status { background: #e8e4de; border-top-color: #d0ccc4; color: #999; }
    .editor-panel:not(.dark) .section-count { background: rgba(0,0,0,0.06); color: #999; }
    .editor-panel:not(.dark) .empty-hint { color: #aaa; }
  `],
})
export class TilemapEditorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  // Loaded images cache (for export canvas)
  private imageCache = new Map<string, HTMLImageElement>();

  // Tools — only functional ones, using Material Icons
  readonly tools: { id: EditorTool; icon: string; tip: string; shortcut?: string }[] = [
    { id: 'select',     icon: 'near_me',         tip: 'Seleccionar',      shortcut: 'V' },
    { id: 'pan',        icon: 'pan_tool',         tip: 'Mover mapa',      shortcut: 'Space' },
    { id: 'sticker',    icon: 'push_pin',         tip: 'Colocar sprite',  shortcut: 'S' },
    { id: 'eraser',     icon: 'backspace',        tip: 'Borrador',        shortcut: 'E' },
    { id: 'coordinate', icon: 'my_location',      tip: 'Copiar coordenada', shortcut: 'C' },
  ];
  activeTool: EditorTool = 'select';

  // View state (driven by map canvas via @Input)
  @Input() viewScale = 1.5;
  @Input() cursorLat = 0;
  @Input() cursorLng = 0;

  // Layers
  layers: TilemapLayer[] = [];
  activeLayerId = '';

  // Tilesets
  tilesets: TilesetDefinition[] = [];
  activeTilesetKey = '';

  // Stickers
  stickerCatalog: StickerDefinition[] = STICKER_CATALOG;
  placingStickerKey: string | null = null;

  // Sprite catalog (Sprout Lands pack)
  readonly spriteCategories = [
    { id: 'all', label: 'Todos' },
    { id: 'tileset', label: 'Tiles' },
    { id: 'object', label: 'Objetos' },
    { id: 'character', label: 'Personajes' },
  ];
  activeSpriteCategory = 'all';
  readonly spriteCatalog: StickerDefinition[] = [
    // Tilesets
    { key: 'spr_grass', name: 'Pasto', imagePath: 'assets/map-sprites/Grass.png', category: 'tileset' },
    { key: 'spr_water', name: 'Agua', imagePath: 'assets/map-sprites/Water.png', category: 'tileset' },
    { key: 'spr_dirt', name: 'Tierra', imagePath: 'assets/map-sprites/Tilled_Dirt.png', category: 'tileset' },
    { key: 'spr_dirt_v2', name: 'Tierra v2', imagePath: 'assets/map-sprites/Tilled_Dirt_v2.png', category: 'tileset' },
    { key: 'spr_dirt_wide', name: 'Tierra ancha', imagePath: 'assets/map-sprites/Tilled_Dirt_Wide.png', category: 'tileset' },
    { key: 'spr_hills', name: 'Colinas', imagePath: 'assets/map-sprites/Hills.png', category: 'tileset' },
    { key: 'spr_fences', name: 'Cercas', imagePath: 'assets/map-sprites/Fences.png', category: 'tileset' },
    { key: 'spr_doors', name: 'Puertas', imagePath: 'assets/map-sprites/Doors.png', category: 'tileset' },
    { key: 'spr_house', name: 'Casa', imagePath: 'assets/map-sprites/Wooden_House.png', category: 'tileset' },
    { key: 'spr_roof', name: 'Techo', imagePath: 'assets/map-sprites/Wooden_House_Roof_Tilset.png', category: 'tileset' },
    { key: 'spr_walls', name: 'Paredes', imagePath: 'assets/map-sprites/Wooden_House_Walls_Tilset.png', category: 'tileset' },
    // Objects
    { key: 'spr_plants', name: 'Plantas', imagePath: 'assets/map-sprites/obj_Basic_Plants.png', category: 'object' },
    { key: 'spr_grass_biom', name: 'Bioma pasto', imagePath: 'assets/map-sprites/obj_Basic_Grass_Biom_things.png', category: 'object' },
    { key: 'spr_furniture', name: 'Muebles', imagePath: 'assets/map-sprites/obj_Basic_Furniture.png', category: 'object' },
    { key: 'spr_tools', name: 'Herramientas', imagePath: 'assets/map-sprites/obj_Basic_tools_and_meterials.png', category: 'object' },
    { key: 'spr_paths', name: 'Caminos', imagePath: 'assets/map-sprites/obj_Paths.png', category: 'object' },
    { key: 'spr_bridge', name: 'Puente', imagePath: 'assets/map-sprites/obj_Wood_Bridge.png', category: 'object' },
    { key: 'spr_chest', name: 'Cofre', imagePath: 'assets/map-sprites/obj_Chest.png', category: 'object' },
    { key: 'spr_chicken_house', name: 'Gallinero', imagePath: 'assets/map-sprites/obj_Free_Chicken_House.png', category: 'object' },
    { key: 'spr_milk', name: 'Leche', imagePath: 'assets/map-sprites/obj_Simple_Milk_and_grass_item.png', category: 'object' },
    { key: 'spr_egg', name: 'Huevo', imagePath: 'assets/map-sprites/obj_Egg_item.png', category: 'object' },
    // Characters
    { key: 'spr_char', name: 'Personaje', imagePath: 'assets/map-sprites/char_Basic_Charakter_Spritesheet.png', category: 'character' },
    { key: 'spr_char_actions', name: 'Acciones', imagePath: 'assets/map-sprites/char_Basic_Charakter_Actions.png', category: 'character' },
    { key: 'spr_chicken', name: 'Gallina', imagePath: 'assets/map-sprites/char_Free_Chicken_Sprites.png', category: 'character' },
    { key: 'spr_cow', name: 'Vaca', imagePath: 'assets/map-sprites/char_Free_Cow_Sprites.png', category: 'character' },
    { key: 'spr_egg_nest', name: 'Nido', imagePath: 'assets/map-sprites/char_Egg_And_Nest.png', category: 'character' },
    { key: 'spr_char_tools', name: 'Herram. personaje', imagePath: 'assets/map-sprites/char_Tools.png', category: 'character' },
  ];

  get filteredSprites(): StickerDefinition[] {
    if (this.activeSpriteCategory === 'all') return this.spriteCatalog;
    return this.spriteCatalog.filter(s => s.category === this.activeSpriteCategory);
  }

  // Collapsible sections state
  openSections: { layers: boolean; sprites: boolean; tilesets: boolean; stickers: boolean; [k: string]: boolean } = {
    layers: true,
    sprites: true,
    tilesets: false,
    stickers: false,
  };

  // Selection
  selectedItem: TilemapLayerData | null = null;

  // State
  @Input() isDarkTheme = true;
  @Output() layersChanged = new EventEmitter<TilemapLayer[]>();
  @Output() toolOrStickerChanged = new EventEmitter<{tool: string; stickerKey: string | null}>();
  isPublishing = false;
  hasUnsavedChanges = false;
  currentManifest: TileManifest | null = null;

  // Undo/Redo
  undoStack: string[] = [];
  redoStack: string[] = [];
  private maxUndoLevels = 100;

  // Geo interaction state (updated by parent via handleGeoXxx())
  private isDraggingItem = false;
  private lastGeoLat = 0;
  private lastGeoLng = 0;

  get totalItems(): number {
    return this.layers.reduce((sum, l) => sum + l.data.length, 0);
  }

  constructor(
    private mapTileService: MapTileService,
    private stickerService: StickerLayerService,
    private themeService: ThemeManagerService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Fallback: sync own isDarkTheme if not driven by parent input
    this.themeService.themeChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => { this.isDarkTheme = t === 'dark'; });

    // Default layer
    this.addLayer('Fondo');

    // Load current manifest
    this.mapTileService.getManifest()
      .pipe(takeUntil(this.destroy$))
      .subscribe(m => { this.currentManifest = m; });

    // Keyboard shortcuts
    if (this.isBrowser) {
      window.addEventListener('keydown', this.onKeyDown);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isBrowser) {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  // No canvas owned by this component — rendering happens in MapControlComponent.

  // ── Geo interactions (called by MapContainerComponent) ──────

  /**
   * Called when the park map canvas is clicked while editor mode is active.
   * Routes the click to the appropriate tool action.
   */
  handleGeoClick(lat: number, lng: number): void {
    if (this.activeTool === 'sticker' && this.placingStickerKey) {
      this.placeSticker(lat, lng);
    } else if (this.activeTool === 'coordinate') {
      if (this.isBrowser) {
        const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        navigator.clipboard.writeText(text);
        this.snackBar.open(`Copiado: ${text}`, 'OK', { duration: 2000 });
      }
    } else if (this.activeTool === 'select') {
      this.selectedItem = this.hitTest(lat, lng);
      this.isDraggingItem = !!this.selectedItem;
      this.lastGeoLat = lat;
      this.lastGeoLng = lng;
      this.cdr.detectChanges();
      // Emit so MapControlComponent redraws selection handles
      this.layersChanged.emit(this.layers);
    } else if (this.activeTool === 'eraser') {
      const hit = this.hitTest(lat, lng);
      if (hit) {
        this.selectedItem = hit;
        this.deleteSelectedItem();
      }
    }
  }

  /**
   * Called on every mouse move over the park map canvas while editor mode is active.
   * Handles item dragging via geo-space deltas.
   */
  handleGeoMouseMove(lat: number, lng: number): void {
    if (this.isDraggingItem && this.activeTool === 'select' && this.selectedItem) {
      this.selectedItem.lat += lat - this.lastGeoLat;
      this.selectedItem.lng += lng - this.lastGeoLng;
      this.hasUnsavedChanges = true;
      this.layersChanged.emit(this.layers);
    }
    this.lastGeoLat = lat;
    this.lastGeoLng = lng;
  }

  /** Called when the mouse button is released over the park map canvas. */
  handleGeoMouseUp(): void {
    if (this.isDraggingItem && this.selectedItem) {
      this.pushUndo();
      this.layersChanged.emit(this.layers);
    }
    this.isDraggingItem = false;
  }

  // ── Tool actions ──────────────────────────────────────────

  private hitTest(lat: number, lng: number): TilemapLayerData | null {
    // Search from top layer to bottom, last item first
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (!layer.visible || layer.locked) continue;
      for (let j = layer.data.length - 1; j >= 0; j--) {
        const item = layer.data[j];
        const hitRadius = 0.0003 * item.scale;
        if (Math.abs(item.lat - lat) < hitRadius && Math.abs(item.lng - lng) < hitRadius) {
          return item;
        }
      }
    }
    return null;
  }

  setTool(tool: EditorTool): void {
    this.activeTool = tool;
    if (tool !== 'sticker') this.placingStickerKey = null;
    if (tool !== 'select') this.selectedItem = null;
    this.toolOrStickerChanged.emit({ tool, stickerKey: this.placingStickerKey });
  }

  toggleSection(name: string): void {
    this.openSections[name] = !this.openSections[name];
  }

  selectSprite(key: string): void {
    this.placingStickerKey = key;
    this.activeTool = 'sticker';
    this.loadStickerImage(key);
    this.toolOrStickerChanged.emit({ tool: 'sticker', stickerKey: key });
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;

    const key = event.key.toLowerCase();

    // Shortcuts
    if (event.ctrlKey && event.shiftKey && key === 'p') {
      event.preventDefault();
      this.publishTiles();
      return;
    }
    if (event.ctrlKey && key === 'z') { event.preventDefault(); this.undo(); return; }
    if (event.ctrlKey && key === 'y') { event.preventDefault(); this.redo(); return; }
    if (event.ctrlKey && key === 'e') { event.preventDefault(); this.exportTiles(); return; }

    // Tool shortcuts
    const toolMap: Record<string, EditorTool> = {
      v: 'select', h: 'pan', s: 'sticker', e: 'eraser', c: 'coordinate',
    };
    if (toolMap[key]) {
      this.setTool(toolMap[key]);
      this.cdr.detectChanges();
    }

    // Delete selected
    if ((key === 'delete' || key === 'backspace') && this.selectedItem) {
      this.deleteSelectedItem();
    }
  };

  // ── Layer management ──────────────────────────────────────

  addLayer(name?: string): void {
    const layerName = name || `Capa ${this.layers.length + 1}`;
    const layer: TilemapLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: layerName,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'sticker',
      data: [],
    };
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  selectLayer(id: string): void {
    this.activeLayerId = id;
  }

  toggleLayerVisibility(id: string): void {
    const layer = this.layers.find(l => l.id === id);
    if (layer) {
      layer.visible = !layer.visible;
      this.layersChanged.emit(this.layers);
    }
  }

  toggleLayerLock(id: string): void {
    const layer = this.layers.find(l => l.id === id);
    if (layer) layer.locked = !layer.locked;
  }

  removeLayer(id: string): void {
    if (this.layers.length <= 1) return;
    this.pushUndo();
    this.layers = this.layers.filter(l => l.id !== id);
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[0].id;
    }
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  // ── Sticker placement ─────────────────────────────────────

  selectSticker(key: string): void {
    this.placingStickerKey = key;
    this.activeTool = 'sticker';
    this.loadStickerImage(key);
    this.toolOrStickerChanged.emit({ tool: 'sticker', stickerKey: key });
  }

  private placeSticker(lat: number, lng: number): void {
    if (!this.placingStickerKey) return;
    const layer = this.layers.find(l => l.id === this.activeLayerId);
    if (!layer || layer.locked) return;

    this.pushUndo();
    const item: TilemapLayerData = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'sticker',
      lat, lng,
      scale: 1, rotation: 0, opacity: 1,
      stickerKey: this.placingStickerKey,
    };
    layer.data.push(item);
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  private loadStickerImage(key: string): void {
    if (this.imageCache.has(key)) return;
    const def = this.stickerCatalog.find(s => s.key === key)
             || this.spriteCatalog.find(s => s.key === key);
    if (!def) return;
    const img = new Image();
    img.src = def.imagePath;
    img.onload = () => this.imageCache.set(key, img);
    this.imageCache.set(key, img); // Set immediately so we don't load twice
  }

  // ── Tileset upload ────────────────────────────────────────

  onTilesetFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.mapTileService.uploadTileset(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const ts: TilesetDefinition = {
            key: result.filename,
            name: file.name,
            imageUrl: result.url,
            tileWidth: 64, tileHeight: 64,
            cols: 4, rows: 4,
          };
          this.tilesets.push(ts);
          this.snackBar.open('Tileset subido correctamente', 'OK', { duration: 3000 });
        },
        error: () => this.snackBar.open('Error al subir tileset', 'OK', { duration: 3000 }),
      });

    input.value = '';
  }

  selectTileset(key: string): void {
    this.activeTilesetKey = key;
    this.activeTool = 'brush';
  }

  // ── Custom sticker upload ─────────────────────────────────

  onStickerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.mapTileService.uploadSticker(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const newSticker: StickerDefinition = {
            key: result.filename,
            name: file.name.replace(/\.[^.]+$/, ''),
            imagePath: result.url,
          };
          this.stickerCatalog = [...this.stickerCatalog, newSticker];
          this.snackBar.open('Sticker subido correctamente', 'OK', { duration: 3000 });
        },
        error: () => this.snackBar.open('Error al subir sticker', 'OK', { duration: 3000 }),
      });

    input.value = '';
  }

  // ── Properties ────────────────────────────────────────────

  onPropertyChanged(): void {
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  // ── Delete ────────────────────────────────────────────────

  deleteSelectedItem(): void {
    if (!this.selectedItem) return;
    this.pushUndo();
    for (const layer of this.layers) {
      const idx = layer.data.findIndex(d => d.id === this.selectedItem!.id);
      if (idx >= 0) {
        layer.data.splice(idx, 1);
        break;
      }
    }
    this.selectedItem = null;
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  // ── Undo/Redo ─────────────────────────────────────────────

  private pushUndo(): void {
    this.undoStack.push(JSON.stringify(this.layers));
    if (this.undoStack.length > this.maxUndoLevels) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.layers));
    const prev = this.undoStack.pop()!;
    this.layers = JSON.parse(prev);
    this.selectedItem = null;
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.layers));
    const next = this.redoStack.pop()!;
    this.layers = JSON.parse(next);
    this.selectedItem = null;
    this.hasUnsavedChanges = true;
    this.layersChanged.emit(this.layers);
  }

  // ── Export & Publish ──────────────────────────────────────

  exportTiles(): void {
    const exportCanvas = this.createExportCanvas();
    if (!exportCanvas) return;

    const tiles = this.mapTileService.exportCanvasToTiles(exportCanvas, TILE_SIZE, 2);
    this.snackBar.open(`Exportados ${tiles.length} tiles (${this.formatBytes(tiles.reduce((s, t) => s + t.blob.size, 0))})`, 'OK', { duration: 5000 });

    // Also trigger download of z0 as preview
    const z0 = tiles.find(t => t.zoomLevel === 0);
    if (z0) {
      const url = URL.createObjectURL(z0.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'map-preview.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  publishTiles(): void {
    if (this.isPublishing) return;
    this.isPublishing = true;

    const exportCanvas = this.createExportCanvas();
    if (!exportCanvas) {
      this.isPublishing = false;
      return;
    }

    const tiles = this.mapTileService.exportCanvasToTiles(exportCanvas, TILE_SIZE, 2);

    // Build overlays from layers
    const overlays: Record<string, unknown> = {};

    // Zone polygons layer
    const zoneLayer = this.layers.find(l => l.name.toLowerCase().includes('zona'));
    if (zoneLayer) {
      overlays['zones'] = {
        zones: zoneLayer.data.filter(d => d.type === 'polygon').map(d => ({
          name: d.text || 'Zona',
          color: d.fillColor || d.color || '#7c83ff',
          points: d.points || [],
        })),
      };
    }

    // Stickers that aren't baked into tiles
    const stickerItems = this.layers.flatMap(l => l.data.filter(d => d.type === 'sticker'));
    if (stickerItems.length > 0) {
      overlays['stickers'] = {
        stickers: stickerItems.map(s => ({
          key: s.stickerKey,
          lat: s.lat, lng: s.lng,
          scale: s.scale, rotation: s.rotation, opacity: s.opacity,
        })),
      };
    }

    // POIs
    const poiLayer = this.layers.find(l => l.name.toLowerCase().includes('poi'));
    if (poiLayer) {
      overlays['pois'] = {
        pois: poiLayer.data.filter(d => d.type === 'text').map(d => ({
          name: d.text || '',
          lat: d.lat, lng: d.lng,
        })),
      };
    }

    this.mapTileService.publish(tiles, overlays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (manifest) => {
          this.currentManifest = manifest;
          this.hasUnsavedChanges = false;
          this.isPublishing = false;
          this.snackBar.open(
            `✅ Mapa publicado v${manifest.version} (${tiles.length} tiles)`,
            'OK',
            { duration: 5000 },
          );
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isPublishing = false;
          this.snackBar.open('Error al publicar: ' + (err.message || 'Error desconocido'), 'OK', { duration: 5000 });
          this.cdr.detectChanges();
        },
      });
  }

  private createExportCanvas(): HTMLCanvasElement | null {
    if (!this.isBrowser) return null;

    // Create high-res canvas for export (2048x2048 = z2 at full quality)
    const size = TILE_SIZE * 4; // z2 = 4x4 grid
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = this.isDarkTheme ? '#13132a' : '#f0ede4';
    ctx.fillRect(0, 0, size, size);

    // Scale to fit park bounds in canvas
    const scaleX = size / (PARK_BOUNDS.maxLng - PARK_BOUNDS.minLng);
    const scaleY = size / (PARK_BOUNDS.maxLat - PARK_BOUNDS.minLat);
    const scale = Math.min(scaleX, scaleY) * 0.9;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, -scale); // Flip Y for GPS

    const centerLat = (PARK_BOUNDS.minLat + PARK_BOUNDS.maxLat) / 2;
    const centerLng = (PARK_BOUNDS.minLng + PARK_BOUNDS.maxLng) / 2;
    ctx.translate(-centerLng, -centerLat);

    // Render all visible layers
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (const item of layer.data) {
        this.drawExportItem(ctx, item);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    return canvas;
  }

  private drawExportItem(ctx: CanvasRenderingContext2D, item: TilemapLayerData): void {
    ctx.save();
    ctx.translate(item.lng, item.lat);
    ctx.globalAlpha *= item.opacity;

    const pixelSize = 0.0003 * item.scale; // In GPS coords space

    if (item.type === 'sticker' && item.stickerKey) {
      const img = this.imageCache.get(item.stickerKey);
      if (img?.complete) {
        ctx.scale(1, -1); // Flip back for image
        ctx.drawImage(img, -pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize);
      }
    } else if (item.type === 'tile') {
      ctx.fillStyle = item.color || '#2E7D32';
      ctx.fillRect(-pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize);
    } else if (item.type === 'polygon' && item.points) {
      ctx.beginPath();
      item.points.forEach((p, i) => {
        const px = p.lng - item.lng;
        const py = p.lat - item.lat;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
      if (item.fillColor) {
        ctx.fillStyle = item.fillColor;
        ctx.fill();
      }
      if (item.color) {
        ctx.strokeStyle = item.color;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
