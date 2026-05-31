import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter, Input,
  QueryList, ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TilesetConfig {
  imageUrl: string;
  tileWidth: number;
  tileHeight: number;
  offsetX: number;
  offsetY: number;
  separationX: number;
  separationY: number;
  cols: number;
  rows: number;
}

export interface TilesetSelection {
  tileIndex: number;
  col: number;
  row: number;
  config: TilesetConfig;
  /** Cropped tile as data-URL for preview */
  tileDataUrl: string;
  tabIndex: number;
  /** Multi-tile selection: array of {col, row, dataUrl} in row-major order */
  tiles?: { col: number; row: number; dataUrl: string }[];
  /** Dimensions of the multi-tile selection rectangle */
  selCols?: number;
  selRows?: number;
}

/** Godot-like paint tool modes */
export type TilePaintTool = 'paint' | 'rect' | 'bucket' | 'line' | 'eraser' | 'picker' | 'grab';

interface TilesetTab {
  name: string;
  image: HTMLImageElement;
  config: TilesetConfig;
  selectedTile: number | null;
  selectedCol: number;
  selectedRow: number;
  /** Multi-tile selection rectangle (inclusive) */
  selStartCol: number;
  selStartRow: number;
  selEndCol: number;
  selEndRow: number;
  canvasZoom: number;
}

@Component({
  selector: 'app-tileset-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tileset-panel" [class.expanded]="expanded" [class.dark]="isDarkTheme" [class.light]="!isDarkTheme"
      [style.max-height.px]="expanded ? panelHeight : 34">

      <!-- Resize handle (drag to resize vertically) -->
      <div class="resize-handle" *ngIf="expanded"
        (mousedown)="onResizeStart($event)"
        (touchstart)="onResizeTouchStart($event)">
        <div class="resize-grip"></div>
      </div>

      <!-- Toggle bar -->
      <div class="toggle-bar" (click)="toggle()">
        <span class="toggle-chevron">{{ expanded ? '▾' : '▴' }}</span>
        <span class="toggle-label">Tileset</span>
        <!-- Tool groups — always visible in toggle bar -->
        <div class="toolbar-inline" (click)="$event.stopPropagation()">
          <!-- Painting tools -->
          <span class="tool-group">
            <button class="tool-btn-mini" *ngFor="let t of toolGroupPaint" [class.active]="activePaintTool === t.id"
              (click)="setTool(t.id)" [title]="t.tip" [style.cursor]="t.cursor">{{ t.icon }}</button>
          </span>
          <span class="tool-sep"></span>
          <!-- Selection tools -->
          <span class="tool-group">
            <button class="tool-btn-mini" *ngFor="let t of toolGroupSelect" [class.active]="activePaintTool === t.id"
              (click)="setTool(t.id)" [title]="t.tip" [style.cursor]="t.cursor">{{ t.icon }}</button>
          </span>
          <span class="tool-sep"></span>
          <!-- Utility tools -->
          <span class="tool-group">
            <button class="tool-btn-mini" *ngFor="let t of toolGroupUtil" [class.active]="activePaintTool === t.id"
              (click)="setTool(t.id)" [title]="t.tip" [style.cursor]="t.cursor">{{ t.icon }}</button>
          </span>
        </div>
        <span class="toggle-info" *ngIf="activeTab">
          {{ activeTab.config.cols }}×{{ activeTab.config.rows }} · {{ activeTab.config.tileWidth }}×{{ activeTab.config.tileHeight }}px
        </span>
      </div>

      <div class="panel-content" *ngIf="expanded"
        [style.height.px]="panelHeight - 34 - 6"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)">

        <!-- Drop overlay -->
        <div class="drop-overlay" *ngIf="dragActive">
          <span>Soltar para agregar pestaña</span>
        </div>

        <!-- Tabs bar -->
        <div class="tabs-bar">
          <div class="tab" *ngFor="let tab of tabs; let i = index"
            [class.active]="activeTabIndex === i" (click)="switchTab(i)">
            <span class="tab-name">{{ tab.name }}</span>
            <button class="tab-close" (click)="closeTab(i); $event.stopPropagation()" title="Cerrar">✕</button>
          </div>
          <button class="tab-add" (click)="fileInput.click()" title="Agregar tileset">+</button>
          <input #fileInput type="file" accept="image/*" hidden (change)="onFileSelected($event)">
        </div>

        <!-- Upload zone (when no tabs) -->
        <div class="upload-zone" *ngIf="tabs.length === 0">
          <div class="upload-prompt">
            <span class="upload-icon">📦</span>
            <span>Arrastra una imagen de tileset aquí</span>
            <span class="upload-sub">o</span>
            <button class="upload-btn" (click)="fileInput.click()">Seleccionar archivo</button>
          </div>
        </div>

        <!-- Active tileset view -->
        <div class="tileset-view" *ngIf="activeTab">
          <div class="view-layout">

            <!-- Left: grid params -->
            <div class="params-col">
              <div class="param">
                <label>Ancho</label>
                <input type="number" min="4" max="512" [(ngModel)]="activeTab.config.tileWidth" (change)="onParamChange()">
              </div>
              <div class="param">
                <label>Alto</label>
                <input type="number" min="4" max="512" [(ngModel)]="activeTab.config.tileHeight" (change)="onParamChange()">
              </div>
              <div class="param">
                <label>Offset X</label>
                <input type="number" min="0" max="256" [(ngModel)]="activeTab.config.offsetX" (change)="onParamChange()">
              </div>
              <div class="param">
                <label>Offset Y</label>
                <input type="number" min="0" max="256" [(ngModel)]="activeTab.config.offsetY" (change)="onParamChange()">
              </div>
              <div class="param">
                <label>Sep. X</label>
                <input type="number" min="0" max="64" [(ngModel)]="activeTab.config.separationX" (change)="onParamChange()">
              </div>
              <div class="param">
                <label>Sep. Y</label>
                <input type="number" min="0" max="64" [(ngModel)]="activeTab.config.separationY" (change)="onParamChange()">
              </div>

              <!-- Selected tile preview -->
              <div class="tile-preview" *ngIf="activeTab.selectedTile !== null">
                <label>{{ selectionTileCount > 1 ? 'Selección (' + selectionCols + '×' + selectionRows + ')' : 'Tile seleccionado' }}</label>
                <div class="preview-box">
                  <canvas #tilePreviewCanvas width="64" height="64"></canvas>
                </div>
                <span class="preview-info">Col {{ activeTab.selectedCol }} · Fila {{ activeTab.selectedRow }}</span>
                <span class="preview-info" *ngIf="pickerOriginInfo">{{ pickerOriginInfo }}</span>
              </div>
            </div>

            <!-- Right: canvas -->
            <div class="canvas-col">
              <div class="canvas-wrapper" (wheel)="onWheel($event)">
                <canvas #tilesetCanvas
                  (mousedown)="onCanvasMouseDown($event)"
                  (mousemove)="onCanvasMouseMove($event)"
                  (mouseup)="onCanvasMouseUp($event)"
                  (mouseleave)="onCanvasMouseUp($event)">
                </canvas>
              </div>
              <div class="canvas-status">
                <span *ngIf="hoverCol >= 0">Col {{ hoverCol }}, Fila {{ hoverRow }}</span>
                <span class="status-right">{{ (activeTab.canvasZoom * 100) | number:'1.0-0' }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      bottom: 0; left: 0; right: 0;
      z-index: 50;
      pointer-events: none;
    }

    .tileset-panel {
      pointer-events: auto;
      backdrop-filter: blur(12px);
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 12px;
      transition: max-height 0.3s ease;
      max-height: 34px;
      overflow: hidden;
      position: relative;
    }
    .tileset-panel.expanded { max-height: none; }

    /* ── Resize handle ───────── */
    .resize-handle {
      position: absolute; top: 0; left: 0; right: 0; height: 6px;
      cursor: ns-resize; z-index: 5;
      display: flex; align-items: center; justify-content: center;
      background: transparent; transition: background 0.15s;
    }
    .resize-handle:hover, .resize-handle:active { background: rgba(124, 77, 255, 0.25); }
    .resize-grip {
      width: 40px; height: 3px; border-radius: 2px;
      background: var(--tp-text2, #888); opacity: 0.5;
      transition: opacity 0.15s;
    }
    .resize-handle:hover .resize-grip { opacity: 1; }

    /* ── Theme: dark ─────────── */
    .tileset-panel.dark {
      --tp-bg: rgba(12, 12, 20, 0.95);
      --tp-border: rgba(255,255,255,0.1);
      --tp-text: #e0e0e0;
      --tp-text2: #888;
      --tp-accent: #7c4dff;
      --tp-hover: rgba(255,255,255,0.04);
      --tp-input-bg: rgba(255,255,255,0.06);
      --tp-grid: rgba(255, 255, 0, 0.55);
      --tp-checker1: #1a1a2a;
      --tp-checker2: #222238;
    }

    /* ── Theme: light ────────── */
    .tileset-panel.light {
      --tp-bg: rgba(245, 245, 250, 0.97);
      --tp-border: rgba(0,0,0,0.12);
      --tp-text: #1a1a2a;
      --tp-text2: #666;
      --tp-accent: #5c2dce;
      --tp-hover: rgba(0,0,0,0.04);
      --tp-input-bg: rgba(0,0,0,0.04);
      --tp-grid: rgba(200, 120, 0, 0.6);
      --tp-checker1: #e0e0e0;
      --tp-checker2: #f0f0f0;
    }

    .tileset-panel { background: var(--tp-bg); border-top: 1px solid var(--tp-border); color: var(--tp-text); }

    .toggle-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; cursor: pointer; user-select: none;
      border-bottom: 1px solid var(--tp-border); transition: background 0.15s;
    }
    .toggle-bar:hover { background: var(--tp-hover); }
    .toggle-chevron { font-size: 10px; color: var(--tp-text2); }
    .toggle-label { font-weight: 600; font-size: 12px; }
    .toggle-info { color: var(--tp-text2); font-size: 11px; margin-left: 0; flex-shrink: 0; }

    /* Inline toolbar in toggle bar — always visible */
    .toolbar-inline {
      display: flex;
      gap: 2px;
      align-items: center;
      margin-left: auto;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .tool-group { display: flex; gap: 2px; }
    .tool-sep { width: 1px; height: 16px; background: var(--tp-border); margin: 0 3px; flex-shrink: 0; }
    .tool-btn-mini {
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid var(--tp-border);
      background: transparent;
      color: var(--tp-text2);
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
      transition: all 0.15s;
    }
    .tool-btn-mini:hover { border-color: var(--tp-accent); color: var(--tp-text); }
    .tool-btn-mini.active { border-color: var(--tp-accent); background: var(--tp-accent); color: #fff; }

    .panel-content { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }

    /* Drop overlay */
    .drop-overlay {
      position: absolute; inset: 0; z-index: 10;
      background: rgba(124, 77, 255, 0.12);
      border: 2px dashed var(--tp-accent);
      display: flex; align-items: center; justify-content: center;
      color: var(--tp-accent); font-weight: 600; font-size: 14px;
      pointer-events: none;
    }

    /* Tabs */
    .tabs-bar {
      display: flex; gap: 0; border-bottom: 1px solid var(--tp-border);
      background: rgba(0,0,0,0.1); min-height: 28px; overflow-x: auto;
    }
    .tab {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 10px; cursor: pointer; font-size: 11px;
      border-right: 1px solid var(--tp-border);
      color: var(--tp-text2); transition: all 0.15s; white-space: nowrap;
    }
    .tab:hover { background: var(--tp-hover); color: var(--tp-text); }
    .tab.active {
      background: var(--tp-bg); color: var(--tp-accent);
      font-weight: 600; border-bottom: 2px solid var(--tp-accent);
    }
    .tab-close {
      background: none; border: none; color: var(--tp-text2);
      cursor: pointer; font-size: 10px; padding: 0 2px;
      border-radius: 3px; transition: all 0.15s; line-height: 1;
    }
    .tab-close:hover { color: #ef5350; background: rgba(239,83,80,0.15); }
    .tab-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
    .tab-add {
      background: none; border: none; color: var(--tp-text2);
      cursor: pointer; font-size: 16px; padding: 2px 10px;
      transition: color 0.15s;
    }
    .tab-add:hover { color: var(--tp-accent); }

    /* Upload zone */
    .upload-zone {
      flex: 1; display: flex; align-items: center; justify-content: center;
      margin: 12px; border: 2px dashed var(--tp-border); border-radius: 10px;
    }
    .upload-prompt { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--tp-text2); font-size: 13px; }
    .upload-icon { font-size: 32px; }
    .upload-sub { font-size: 11px; }
    .upload-btn {
      padding: 6px 16px; background: var(--tp-accent); color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .upload-btn:hover { opacity: 0.85; }

    /* View layout */
    .tileset-view { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .view-layout { flex: 1; display: flex; min-height: 0; }

    /* Params column */
    .params-col {
      width: 140px; flex-shrink: 0; padding: 6px 8px;
      border-right: 1px solid var(--tp-border);
      overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
    }
    .params-col::-webkit-scrollbar { width: 3px; }
    .params-col::-webkit-scrollbar-thumb { background: var(--tp-border); border-radius: 2px; }

    .param { display: flex; flex-direction: column; gap: 1px; }
    .param label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--tp-text2); }
    .param input[type="number"] {
      width: 100%; padding: 3px 6px; box-sizing: border-box;
      background: var(--tp-input-bg); border: 1px solid var(--tp-border);
      border-radius: 4px; color: var(--tp-accent);
      font-family: monospace; font-size: 11px; outline: none;
    }
    .param input:focus { border-color: var(--tp-accent); }

    /* Tool selector */
    .tool-section { margin-top: 4px; }
    .tool-section > label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--tp-text2); margin-bottom: 3px; display: block; }
    .tool-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
    .tool-btn {
      padding: 4px; border-radius: 4px; border: 1px solid var(--tp-border);
      background: transparent; color: var(--tp-text2); cursor: pointer;
      font-size: 14px; line-height: 1; text-align: center; transition: all 0.15s;
    }
    .tool-btn:hover { border-color: var(--tp-accent); color: var(--tp-text); }
    .tool-btn.active { border-color: var(--tp-accent); background: var(--tp-accent); color: #fff; }

    /* Tile preview */
    .tile-preview { margin-top: 6px; }
    .tile-preview > label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--tp-text2); margin-bottom: 3px; display: block; }
    .preview-box {
      display: flex; align-items: center; justify-content: center;
      background: var(--tp-input-bg); border: 1px solid var(--tp-border); border-radius: 6px;
      padding: 4px; min-height: 68px;
    }
    .preview-box canvas { image-rendering: pixelated; }
    .preview-info { font-size: 10px; color: var(--tp-accent); font-family: monospace; margin-top: 2px; text-align: center; display: block; }

    /* Canvas column */
    .canvas-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .canvas-wrapper { flex: 1; overflow: auto; cursor: crosshair; min-height: 0; }
    .canvas-wrapper canvas { display: block; image-rendering: pixelated; }
    .canvas-status {
      display: flex; justify-content: space-between; align-items: center;
      padding: 3px 8px; font-size: 10px; font-family: monospace;
      color: var(--tp-text2); border-top: 1px solid var(--tp-border);
      background: rgba(0,0,0,0.05); min-height: 20px;
    }
    .status-right { color: var(--tp-accent); }
  `]
})
export class TilesetPanelComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tilesetCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tilePreviewCanvas') previewCanvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() isDarkTheme = true;
  @Output() tileSelected = new EventEmitter<TilesetSelection>();
  @Output() configChanged = new EventEmitter<TilesetConfig>();
  @Output() paintToolChanged = new EventEmitter<TilePaintTool>();

  expanded = false;
  dragActive = false;

  // ── Resize state ───────────────────────────────────────
  panelHeight = 400;
  private readonly MIN_PANEL_HEIGHT = 120;
  private readonly MAX_PANEL_HEIGHT = 800;
  private readonly COLLAPSE_THRESHOLD = 80;
  private isResizing = false;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private boundResizeMove: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private boundResizeEnd: (() => void) | null = null;

  // ── Tabs ───────────────────────────────────────────────
  tabs: TilesetTab[] = [];
  activeTabIndex = -1;
  get activeTab(): TilesetTab | null { return this.tabs[this.activeTabIndex] ?? null; }

  // ── Paint tools (separated into groups) ─────────────────
  activePaintTool: TilePaintTool = 'paint';
  toolGroupPaint: { id: TilePaintTool; icon: string; tip: string; cursor: string }[] = [
    { id: 'paint', icon: '🖌️', tip: 'Pintar (B) — colocar tile', cursor: 'crosshair' },
    { id: 'bucket', icon: '🪣', tip: 'Balde (G) — relleno por inundación', cursor: 'cell' },
    { id: 'eraser', icon: '🧹', tip: 'Borrador (E) — borrar tiles', cursor: 'not-allowed' },
  ];
  toolGroupSelect: { id: TilePaintTool; icon: string; tip: string; cursor: string }[] = [
    { id: 'rect', icon: '⬜', tip: 'Rectángulo (R) — rellenar área rectangular', cursor: 'crosshair' },
    { id: 'line', icon: '╲', tip: 'Línea (L) — trazar línea de tiles', cursor: 'crosshair' },
  ];
  toolGroupUtil: { id: TilePaintTool; icon: string; tip: string; cursor: string }[] = [
    { id: 'picker', icon: '💉', tip: 'Cuentagotas (I) — seleccionar tile del mapa', cursor: 'copy' },
    { id: 'grab', icon: '✋', tip: 'Mover (H) — arrastrar lienzo', cursor: 'grab' },
  ];

  /** Eyedropper origin info shown in preview */
  pickerOriginInfo = '';

  // ── Multi-tile selection state ─────────────────────────
  private isSelecting = false;
  get selectionCols(): number { const t = this.activeTab; return t ? Math.abs(t.selEndCol - t.selStartCol) + 1 : 1; }
  get selectionRows(): number { const t = this.activeTab; return t ? Math.abs(t.selEndRow - t.selStartRow) + 1 : 1; }
  get selectionTileCount(): number { return this.selectionCols * this.selectionRows; }

  // ── Canvas state ───────────────────────────────────────
  private ctx: CanvasRenderingContext2D | null = null;
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };
  hoverCol = -1;
  hoverRow = -1;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.onResizeEnd();
    this.tabs = [];
  }

  toggle(): void {
    this.expanded = !this.expanded;
    if (this.expanded) this.panelHeight = Math.max(this.panelHeight, this.MIN_PANEL_HEIGHT);
  }

  // ── Vertical resize (drag top edge) ────────────────────
  onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.startResize(e.clientY);
    this.boundResizeMove = (ev: MouseEvent | TouchEvent) => {
      const y = ev instanceof MouseEvent ? ev.clientY : ev.touches[0].clientY;
      this.onResizeMove(y);
    };
    this.boundResizeEnd = () => this.onResizeEnd();
    document.addEventListener('mousemove', this.boundResizeMove as any);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  onResizeTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    this.startResize(e.touches[0].clientY);
    this.boundResizeMove = (ev: MouseEvent | TouchEvent) => {
      const y = ev instanceof MouseEvent ? ev.clientY : ev.touches[0].clientY;
      this.onResizeMove(y);
    };
    this.boundResizeEnd = () => this.onResizeEnd();
    document.addEventListener('touchmove', this.boundResizeMove as any, { passive: false });
    document.addEventListener('touchend', this.boundResizeEnd);
  }

  private startResize(clientY: number): void {
    this.isResizing = true;
    this.resizeStartY = clientY;
    this.resizeStartHeight = this.panelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }

  private onResizeMove(clientY: number): void {
    if (!this.isResizing) return;
    // Dragging UP = panel grows (clientY decreases)
    const delta = this.resizeStartY - clientY;
    const newH = Math.max(this.MIN_PANEL_HEIGHT, Math.min(this.MAX_PANEL_HEIGHT, this.resizeStartHeight + delta));
    this.panelHeight = newH;
    this.cdr.markForCheck();
  }

  private onResizeEnd(): void {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Auto-collapse if dragged very small
    if (this.panelHeight < this.COLLAPSE_THRESHOLD) {
      this.expanded = false;
      this.panelHeight = 400;
    }
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
    this.cdr.markForCheck();
  }

  // ── Tab management ─────────────────────────────────────
  switchTab(index: number): void {
    if (index < 0 || index >= this.tabs.length) return;
    this.activeTabIndex = index;
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.initCanvas());
  }

  closeTab(index: number): void {
    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      this.activeTabIndex = -1;
    } else if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = this.tabs.length - 1;
    }
    this.cdr.markForCheck();
    if (this.activeTab) requestAnimationFrame(() => this.initCanvas());
  }

  private addTab(image: HTMLImageElement, name: string): void {
    const config: TilesetConfig = {
      imageUrl: image.src,
      tileWidth: 32, tileHeight: 32,
      offsetX: 0, offsetY: 0,
      separationX: 0, separationY: 0,
      cols: 0, rows: 0,
    };
    this.autoDetectTileSize(image, config);
    const tab: TilesetTab = {
      name, image, config,
      selectedTile: null, selectedCol: 0, selectedRow: 0,
      selStartCol: 0, selStartRow: 0, selEndCol: 0, selEndRow: 0,
      canvasZoom: 1,
    };
    this.recalcGrid(tab);
    this.tabs.push(tab);
    this.activeTabIndex = this.tabs.length - 1;
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.initCanvas());
  }

  /** Public: load a tileset from an image URL + optional config */
  loadTilesetFromUrl(imageUrl: string, name: string, config?: Partial<TilesetConfig>): void {
    const img = new Image();
    img.onload = () => {
      this.addTab(img, name);
      if (config) {
        const tab = this.tabs[this.tabs.length - 1];
        Object.assign(tab.config, config);
        this.recalcGrid(tab);
        this.cdr.markForCheck();
        requestAnimationFrame(() => this.initCanvas());
      }
    };
    img.src = imageUrl;
  }

  private autoDetectTileSize(img: HTMLImageElement, config: TilesetConfig): void {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    for (const s of [64, 48, 32, 16]) {
      if (w % s === 0 && h % s === 0) {
        config.tileWidth = s;
        config.tileHeight = s;
        return;
      }
    }
  }

  // ── Drag & drop ────────────────────────────────────────
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.dragActive = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = false;
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.loadImageFile(file);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.loadImageFile(file);
    }
    input.value = '';
  }

  private loadImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const baseName = file.name.replace(/\.[^.]+$/, '');
        this.addTab(img, baseName);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ── Grid calculations ──────────────────────────────────
  private recalcGrid(tab: TilesetTab = this.activeTab!): void {
    if (!tab) return;
    const { tileWidth, tileHeight, offsetX, offsetY, separationX, separationY } = tab.config;
    const w = tab.image.naturalWidth - offsetX;
    const h = tab.image.naturalHeight - offsetY;
    tab.config.cols = Math.max(1, Math.floor((w + separationX) / (tileWidth + separationX)));
    tab.config.rows = Math.max(1, Math.floor((h + separationY) / (tileHeight + separationY)));
    this.configChanged.emit({ ...tab.config });
  }

  onParamChange(): void {
    const tab = this.activeTab;
    if (!tab) return;
    tab.config.tileWidth = Math.max(4, tab.config.tileWidth);
    tab.config.tileHeight = Math.max(4, tab.config.tileHeight);
    tab.config.offsetX = Math.max(0, tab.config.offsetX);
    tab.config.offsetY = Math.max(0, tab.config.offsetY);
    tab.config.separationX = Math.max(0, tab.config.separationX);
    tab.config.separationY = Math.max(0, tab.config.separationY);
    this.recalcGrid(tab);
    this.drawCanvas();
    this.drawPreview();
  }

  setTool(tool: TilePaintTool): void {
    this.activePaintTool = tool;
    this.paintToolChanged.emit(tool);
  }

  // ── Canvas ─────────────────────────────────────────────
  private initCanvas(): void {
    const tab = this.activeTab;
    if (!this.canvasRef || !tab) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    this.drawCanvas();
    this.drawPreview();
  }

  private resizeCanvas(): void {
    const tab = this.activeTab;
    if (!this.canvasRef || !tab) return;
    const canvas = this.canvasRef.nativeElement;
    const z = tab.canvasZoom;
    const w = Math.ceil(tab.image.naturalWidth * z);
    const h = Math.ceil(tab.image.naturalHeight * z);
    canvas.width = Math.max(w, 100);
    canvas.height = Math.max(h, 100);
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  }

  private drawCanvas(): void {
    const ctx = this.ctx;
    const tab = this.activeTab;
    if (!ctx || !tab) return;

    const z = tab.canvasZoom;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Checkerboard background
    const ck = 8 * z;
    for (let y = 0; y < h; y += ck) {
      for (let x = 0; x < w; x += ck) {
        ctx.fillStyle = ((Math.floor(x / ck) + Math.floor(y / ck)) % 2 === 0)
          ? 'var(--tp-checker1)' === 'var(--tp-checker1)'
            ? (this.isDarkTheme ? '#1a1a2a' : '#e0e0e0')
            : '#1a1a2a'
          : (this.isDarkTheme ? '#222238' : '#f0f0f0');
        ctx.fillRect(x, y, ck, ck);
      }
    }

    // Image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tab.image, 0, 0, tab.image.naturalWidth * z, tab.image.naturalHeight * z);

    // Grid
    const { tileWidth, tileHeight, offsetX, offsetY, separationX, separationY, cols, rows } = tab.config;
    ctx.strokeStyle = this.isDarkTheme ? 'rgba(255, 255, 0, 0.55)' : 'rgba(200, 120, 0, 0.6)';
    ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (offsetX + c * (tileWidth + separationX)) * z;
        const y2 = (offsetY + r * (tileHeight + separationY)) * z;
        ctx.strokeRect(x + 0.5, y2 + 0.5, tileWidth * z, tileHeight * z);
      }
    }

    // Hover highlight
    if (this.hoverCol >= 0 && this.hoverRow >= 0 && this.hoverCol < cols && this.hoverRow < rows) {
      const hx = (offsetX + this.hoverCol * (tileWidth + separationX)) * z;
      const hy = (offsetY + this.hoverRow * (tileHeight + separationY)) * z;
      ctx.fillStyle = this.isDarkTheme ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(hx, hy, tileWidth * z, tileHeight * z);
    }

    // Selected — draw multi-tile selection rectangle
    if (tab.selectedTile !== null) {
      const sc1 = Math.min(tab.selStartCol, tab.selEndCol);
      const sr1 = Math.min(tab.selStartRow, tab.selEndRow);
      const sc2 = Math.max(tab.selStartCol, tab.selEndCol);
      const sr2 = Math.max(tab.selStartRow, tab.selEndRow);
      for (let sr = sr1; sr <= sr2; sr++) {
        for (let sc = sc1; sc <= sc2; sc++) {
          const sx = (offsetX + sc * (tileWidth + separationX)) * z;
          const sy = (offsetY + sr * (tileHeight + separationY)) * z;
          ctx.fillStyle = 'rgba(124, 77, 255, 0.18)';
          ctx.fillRect(sx, sy, tileWidth * z, tileHeight * z);
        }
      }
      // Border around the full selection
      const bx = (offsetX + sc1 * (tileWidth + separationX)) * z;
      const by = (offsetY + sr1 * (tileHeight + separationY)) * z;
      const bw = ((sc2 - sc1 + 1) * (tileWidth + separationX) - separationX) * z;
      const bh = ((sr2 - sr1 + 1) * (tileHeight + separationY) - separationY) * z;
      ctx.strokeStyle = 'rgba(124, 77, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    }
  }

  /** Draw the selected tile(s) as an isolated preview in the side panel */
  private drawPreview(): void {
    const tab = this.activeTab;
    if (!tab || tab.selectedTile === null || !this.previewCanvasRef) return;

    const pCanvas = this.previewCanvasRef.nativeElement;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;

    const { tileWidth, tileHeight, offsetX, offsetY, separationX, separationY } = tab.config;
    const sc1 = Math.min(tab.selStartCol, tab.selEndCol);
    const sr1 = Math.min(tab.selStartRow, tab.selEndRow);
    const sc2 = Math.max(tab.selStartCol, tab.selEndCol);
    const sr2 = Math.max(tab.selStartRow, tab.selEndRow);
    const selW = (sc2 - sc1 + 1) * tileWidth;
    const selH = (sr2 - sr1 + 1) * tileHeight;

    // Scale to fit 64×64 preview
    const scale = Math.min(64 / selW, 64 / selH, 4);
    const dw = selW * scale;
    const dh = selH * scale;
    pCanvas.width = 64;
    pCanvas.height = 64;

    pCtx.clearRect(0, 0, 64, 64);

    // Checkerboard
    const ck = 8;
    for (let y = 0; y < 64; y += ck) {
      for (let x = 0; x < 64; x += ck) {
        pCtx.fillStyle = ((Math.floor(x / ck) + Math.floor(y / ck)) % 2 === 0)
          ? (this.isDarkTheme ? '#1a1a2a' : '#e0e0e0')
          : (this.isDarkTheme ? '#222238' : '#f0f0f0');
        pCtx.fillRect(x, y, ck, ck);
      }
    }

    pCtx.imageSmoothingEnabled = false;
    // Draw each tile in the selection onto the preview
    for (let sr = sr1; sr <= sr2; sr++) {
      for (let sc = sc1; sc <= sc2; sc++) {
        const srcX = offsetX + sc * (tileWidth + separationX);
        const srcY = offsetY + sr * (tileHeight + separationY);
        const dx = (sc - sc1) * tileWidth * scale + (64 - dw) / 2;
        const dy = (sr - sr1) * tileHeight * scale + (64 - dh) / 2;
        pCtx.drawImage(tab.image, srcX, srcY, tileWidth, tileHeight, dx, dy, tileWidth * scale, tileHeight * scale);
      }
    }
  }

  /** Extract cropped tile data URL for a single tile at given col,row */
  private getTileDataUrlAt(tab: TilesetTab, col: number, row: number): string {
    const { tileWidth, tileHeight, offsetX, offsetY, separationX, separationY } = tab.config;
    const sx = offsetX + col * (tileWidth + separationX);
    const sy = offsetY + row * (tileHeight + separationY);
    const offscreen = document.createElement('canvas');
    offscreen.width = tileWidth;
    offscreen.height = tileHeight;
    const octx = offscreen.getContext('2d')!;
    octx.imageSmoothingEnabled = false;
    octx.drawImage(tab.image, sx, sy, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
    return offscreen.toDataURL('image/png');
  }

  /** Extract cropped tile data URL for the primary selected tile */
  private getTileDataUrl(tab: TilesetTab): string {
    return this.getTileDataUrlAt(tab, tab.selectedCol, tab.selectedRow);
  }

  /** Build the full multi-tile selection data */
  private getMultiTileSelection(tab: TilesetTab): { col: number; row: number; dataUrl: string }[] {
    const sc1 = Math.min(tab.selStartCol, tab.selEndCol);
    const sr1 = Math.min(tab.selStartRow, tab.selEndRow);
    const sc2 = Math.max(tab.selStartCol, tab.selEndCol);
    const sr2 = Math.max(tab.selStartRow, tab.selEndRow);
    const tiles: { col: number; row: number; dataUrl: string }[] = [];
    for (let r = sr1; r <= sr2; r++) {
      for (let c = sc1; c <= sc2; c++) {
        tiles.push({ col: c - sc1, row: r - sr1, dataUrl: this.getTileDataUrlAt(tab, c, r) });
      }
    }
    return tiles;
  }

  // ── Canvas interaction ─────────────────────────────────
  private getTileAt(e: MouseEvent): { col: number; row: number } | null {
    const tab = this.activeTab;
    if (!this.canvasRef || !tab) return null;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / tab.canvasZoom;
    const my = (e.clientY - rect.top) / tab.canvasZoom;

    const { tileWidth, tileHeight, offsetX, offsetY, separationX, separationY, cols, rows } = tab.config;
    const col = Math.floor((mx - offsetX) / (tileWidth + separationX));
    const row = Math.floor((my - offsetY) / (tileHeight + separationY));
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;

    const localX = mx - offsetX - col * (tileWidth + separationX);
    const localY = my - offsetY - row * (tileHeight + separationY);
    if (localX < 0 || localX >= tileWidth || localY < 0 || localY >= tileHeight) return null;

    return { col, row };
  }

  onCanvasMouseDown(e: MouseEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isPanning = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    const tab = this.activeTab;
    const tile = this.getTileAt(e);
    if (tile && tab) {
      // Start rectangle selection on tileset canvas
      tab.selStartCol = tile.col;
      tab.selStartRow = tile.row;
      tab.selEndCol = tile.col;
      tab.selEndRow = tile.row;
      tab.selectedCol = tile.col;
      tab.selectedRow = tile.row;
      tab.selectedTile = tile.row * tab.config.cols + tile.col;
      this.isSelecting = true;
      this.pickerOriginInfo = '';
      this.cdr.markForCheck();
      this.drawCanvas();
    }
  }

  onCanvasMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      const wrapper = this.canvasRef?.nativeElement?.parentElement;
      if (wrapper) { wrapper.scrollLeft -= dx; wrapper.scrollTop -= dy; }
      return;
    }

    // Extend rectangle selection while dragging
    if (this.isSelecting) {
      const tab = this.activeTab;
      const tile = this.getTileAt(e);
      if (tile && tab) {
        tab.selEndCol = tile.col;
        tab.selEndRow = tile.row;
        this.drawCanvas();
        this.cdr.markForCheck();
      }
      return;
    }

    const tile = this.getTileAt(e);
    const prevCol = this.hoverCol;
    const prevRow = this.hoverRow;
    if (tile) { this.hoverCol = tile.col; this.hoverRow = tile.row; }
    else { this.hoverCol = -1; this.hoverRow = -1; }
    if (this.hoverCol !== prevCol || this.hoverRow !== prevRow) this.drawCanvas();
  }

  onCanvasMouseUp(_e: MouseEvent): void {
    this.isPanning = false;
    if (this.isSelecting) {
      this.isSelecting = false;
      this.emitSelection();
    }
  }

  /** Emit the current selection (single or multi-tile) */
  private emitSelection(): void {
    const tab = this.activeTab;
    if (!tab || tab.selectedTile === null) return;
    requestAnimationFrame(() => this.drawPreview());
    const tiles = this.getMultiTileSelection(tab);
    this.tileSelected.emit({
      tileIndex: tab.selectedTile,
      col: tab.selectedCol,
      row: tab.selectedRow,
      config: { ...tab.config },
      tileDataUrl: this.getTileDataUrl(tab),
      tabIndex: this.activeTabIndex,
      tiles,
      selCols: this.selectionCols,
      selRows: this.selectionRows,
    });
  }

  /** Called by eyedropper: highlight a specific tile and show origin info */
  highlightPickerOrigin(col: number, row: number): void {
    const tab = this.activeTab;
    if (!tab) return;
    const { cols, rows } = tab.config;
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    tab.selectedCol = col;
    tab.selectedRow = row;
    tab.selStartCol = col;
    tab.selStartRow = row;
    tab.selEndCol = col;
    tab.selEndRow = row;
    tab.selectedTile = row * cols + col;
    this.pickerOriginInfo = `Origen: Col ${col} · Fila ${row} (Tile #${tab.selectedTile})`;
    this.cdr.markForCheck();
    this.drawCanvas();
    requestAnimationFrame(() => this.drawPreview());
  }

  /** Called from parent to sync tool when keyboard shortcut changes it */
  setActiveTool(tool: TilePaintTool): void {
    this.activePaintTool = tool;
    this.cdr.markForCheck();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const tab = this.activeTab;
    if (!tab) return;
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    tab.canvasZoom = Math.min(8, Math.max(0.25, tab.canvasZoom + delta));
    this.resizeCanvas();
    this.drawCanvas();
    this.cdr.markForCheck();
  }
}
