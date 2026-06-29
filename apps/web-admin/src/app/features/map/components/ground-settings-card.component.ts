import {
  Component, EventEmitter, Input, OnChanges, Output, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PARK_MAP_VIS, groundElementSizeFrac } from '../utils/map-park-visual-scale';
import {
  GROUND_ELEMENT_LABELS,
  GROUND_ELEMENT_TYPES,
  GROUND_PARK_LAYER_KEYS,
  GROUND_ZONE_KEYS,
  GROUND_ZONE_LABELS,
  type GroundElementType,
  type ZoneGroundStyle,
} from '../utils/draw-ground-texture';
import {
  DEFAULT_GROUND_MAP_SETTINGS,
  type GroundMapSettings,
} from '../utils/ground-preset';
import type { MapControlEvent } from './sticker-panel.component';

@Component({
  selector: 'app-ground-settings-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ground-card-backdrop" *ngIf="visible" (mousedown)="onBackdropClick($event)"></div>
    <div class="ground-settings-card"
      *ngIf="visible"
      [class.light-theme]="!isDarkTheme"
      [style.transform]="'translate(' + posX + 'px,' + posY + 'px)'"
      (mousedown)="$event.stopPropagation()"
      (click)="$event.stopPropagation()">
      <div class="ground-card-header" (mousedown)="onDragStart($event)">
        <span class="ground-card-title">Configuración del suelo</span>
        <button type="button" class="ground-card-close" (click)="close()" title="Cerrar">✕</button>
      </div>

      <div class="ground-card-body">
        <div class="param-row">
          <label title="Tamaño base de los elementos dibujados (piedras, hierba…)">Tamaño base</label>
          <input type="range" [min]="groundTileMin" [max]="groundTileMax" step="0.25"
            [ngModel]="localGroundTilePx" (ngModelChange)="onGroundTilePxChange($event)">
          <span class="param-val">{{ localGroundTilePx }}px</span>
          <button type="button" class="mini-btn" title="Tamaño automático según escala y calidad"
            (click)="onGroundAutoTilePx()">Auto</button>
        </div>
        <div class="param-row">
          <label>Tamaño general</label>
          <input type="range" [min]="groundScalePercentMin" [max]="groundScalePercentMax" step="5"
            [ngModel]="localGroundSettings.scalePercent"
            (ngModelChange)="onGroundScaleChange($event)">
          <span class="param-val">{{ localGroundSettings.scalePercent }}%</span>
        </div>
        <div class="param-row">
          <label title="Reduce el número de texturas para mejorar el rendimiento">Calidad</label>
          <input type="range" min="25" max="100" step="5"
            [ngModel]="localGroundSettings.qualityPercent"
            (ngModelChange)="onGroundQualityChange($event)">
          <span class="param-val">{{ localGroundSettings.qualityPercent }}%</span>
        </div>
        <p class="section-hint">Calidad baja = menos piedras/plantas = más fluido. El tamaño de cada elemento no cambia.</p>
        <button type="button" class="tool-btn danger full-width"
          title="Quita piedras, hierba, macro y ecotono de TODAS las capas (zonas, base parque, fondo)"
          (click)="clearAllGroundLayers()">∅ Vaciar todo el piso</button>

        <ng-container *ngIf="isAdmin">
          <div class="sub-divider"></div>
          <p class="block-title">Elementos por zona</p>
          <p class="section-hint">Cada elemento (piedras, hierba, paja…) se dibuja como vector. Ajusta densidad y tamaño mín/máx, o quítalo.</p>
          <div class="param-row">
            <label>Zona</label>
            <select class="el-select"
              [ngModel]="groundStyleEditSelectValue"
              (ngModelChange)="onGroundStyleTargetChange($event)">
              <option value="park">Todo el parque (sin fondo)</option>
              <option *ngFor="let z of groundZoneKeys" [value]="z">{{ groundZoneLabels[z] }}</option>
            </select>
          </div>
          <p class="section-hint" *ngIf="groundStyleEditTarget === 'park'">
            Aplica a las 3 zonas y a la base del parque. No afecta al fondo exterior.
          </p>
          <p class="section-hint" *ngIf="groundStyleEditTarget === -1">
            Capa bajo las zonas: solo se ve en caminos y bordes no cubiertos por Tierras Altas/Medias/Bajas.
          </p>
          <ng-container *ngIf="groundStyleEditZone as zone">
            <p class="section-hint">Ecotono — suaviza el salto con las zonas vecinas.</p>
            <div class="param-row">
              <label>Difuminado borde</label>
              <input type="range" min="0" max="48" step="1"
                [ngModel]="groundEdgeBlend(zone)"
                (ngModelChange)="onGroundEdgeBlendChange($event)">
              <span class="param-val">{{ groundEdgeBlend(zone) }}px</span>
            </div>
            <div class="param-row">
              <label>Fuerza difum.</label>
              <input type="range" min="0" max="100" step="1"
                [ngModel]="groundEdgeAlphaPercent(zone)"
                (ngModelChange)="onGroundEdgeAlphaChange($event)">
              <span class="param-val">{{ groundEdgeAlphaPercent(zone) }}%</span>
            </div>
            <div class="sub-divider"></div>
            <div class="ground-el-block" *ngFor="let el of zone.elements; let i = index">
              <div class="param-row">
                <label class="el-label">{{ groundElementLabel(el.type) }}</label>
                <button type="button" class="el-remove-btn" title="Quitar elemento"
                  (click)="removeGroundElement(i)">×</button>
              </div>
              <div class="param-row indent">
                <label>Densidad</label>
                <input type="range" min="0" max="120" step="1"
                  [ngModel]="groundDensityPercent(el.density)"
                  (ngModelChange)="onGroundElementDensityChange(i, $event)">
                <span class="param-val">{{ groundDensityPercent(el.density) }}%</span>
              </div>
              <div class="param-row indent">
                <label>Tamaño mín</label>
                <input type="range" [min]="groundElementSizePctMin" [max]="groundElementSizePctMax" step="1"
                  [ngModel]="groundElementSizeMinPercent(el)"
                  (ngModelChange)="onGroundElementSizeMinChange(i, $event)">
                <span class="param-val">{{ groundElementSizeMinPercent(el) }}%</span>
              </div>
              <div class="param-row indent">
                <label>Tamaño máx</label>
                <input type="range" [min]="groundElementSizePctMin" [max]="groundElementSizePctMax" step="1"
                  [ngModel]="groundElementSizeMaxPercent(el)"
                  (ngModelChange)="onGroundElementSizeMaxChange(i, $event)">
                <span class="param-val">{{ groundElementSizeMaxPercent(el) }}%</span>
              </div>
            </div>
            <div class="param-row add-el-row">
              <select class="el-select" [(ngModel)]="groundAddType">
                <option *ngFor="let t of groundElementTypes" [value]="t">{{ groundElementLabel(t) }}</option>
              </select>
              <button type="button" class="tool-btn" (click)="addGroundElement()">+ elemento</button>
            </div>
            <div class="sub-divider"></div>
            <div class="param-row">
              <label>Variac. macro</label>
              <input type="range" min="0" max="200" step="1"
                [ngModel]="groundMacroDensityPercent(zone)"
                (ngModelChange)="onGroundMacroDensityChange($event)">
              <span class="param-val">{{ groundMacroDensityPercent(zone) }}%</span>
            </div>
            <div class="param-row">
              <label>Opac. macro</label>
              <input type="range" min="0" max="100" step="1"
                [ngModel]="groundMacroAlphaPercent(zone)"
                (ngModelChange)="onGroundMacroAlphaChange($event)">
              <span class="param-val">{{ groundMacroAlphaPercent(zone) }}%</span>
            </div>
            <button type="button" class="tool-btn full-width"
              *ngIf="groundStyleEditTarget !== 'park'"
              title="Copia estos elementos (y macro/ecotono) a TODAS las zonas, base y fondo"
              (click)="applyGroundStyleToAllZones()">⇊ Aplicar a todas las zonas</button>
            <div class="tool-grid">
              <button type="button" class="tool-btn" (click)="resetGroundStyleZone()">
                {{ groundStyleEditTarget === 'park' ? 'Restaurar parque' : 'Restaurar zona' }}
              </button>
              <button type="button" class="tool-btn danger" (click)="resetGroundStyleAll()">Restaurar todo</button>
            </div>
          </ng-container>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .ground-card-backdrop {
      position: absolute;
      inset: 0;
      z-index: 18;
      background: transparent;
    }

    .ground-settings-card {
      --card-bg: rgba(0, 0, 0, 0.82);
      --card-border: #444;
      --card-text: #fff;
      --card-text2: #888;
      --card-accent: #7c4dff;
      --card-input: rgba(255, 255, 255, 0.06);

      position: absolute;
      top: 56px;
      left: 16px;
      z-index: 20;
      width: min(360px, calc(100% - 32px));
      max-height: calc(100% - 72px);
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(10px);
      pointer-events: auto;
      font-family: sans-serif;
    }

    .ground-settings-card.light-theme {
      --card-bg: rgba(255, 255, 255, 0.94);
      --card-border: #ccc;
      --card-text: #212121;
      --card-text2: #666;
      --card-accent: #5e35b1;
      --card-input: rgba(0, 0, 0, 0.04);
    }

    .ground-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--card-border);
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }
    .ground-card-header:active { cursor: grabbing; }

    .ground-card-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--card-text);
    }

    .ground-card-close {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--card-text2);
      cursor: pointer;
      font-size: 14px;
    }
    .ground-card-close:hover {
      background: var(--card-input);
      color: var(--card-text);
    }

    .ground-card-body {
      overflow-y: auto;
      padding: 10px 12px 14px;
      flex: 1;
      min-height: 0;
    }
    .ground-card-body::-webkit-scrollbar { width: 6px; }
    .ground-card-body::-webkit-scrollbar-thumb {
      background: var(--card-accent);
      border-radius: 3px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .param-row label {
      width: 72px;
      font-size: 11px;
      color: var(--card-text2);
      flex-shrink: 0;
    }
    .param-row label.el-label { font-weight: 600; color: var(--card-text); flex: 1; width: auto; }
    .param-row input[type="range"] {
      flex: 1;
      accent-color: var(--card-accent);
      height: 4px;
    }
    .param-val {
      width: 40px;
      text-align: right;
      font-size: 10px;
      font-family: monospace;
      color: var(--card-accent);
      flex-shrink: 0;
    }
    .param-row.indent { padding-left: 10px; }

    .section-hint {
      font-size: 10px;
      color: var(--card-text2);
      line-height: 1.35;
      margin: 0 0 8px;
    }
    .block-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--card-text);
      margin: 0 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sub-divider {
      height: 1px;
      background: var(--card-border);
      margin: 10px 0;
    }

    .mini-btn, .tool-btn {
      border: 1px solid var(--card-border);
      border-radius: 6px;
      background: var(--card-input);
      color: var(--card-text);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      white-space: nowrap;
    }
    .tool-btn:hover, .mini-btn:hover { border-color: var(--card-accent); }
    .tool-btn.danger { color: #ef5350; }
    .tool-btn.danger:hover { border-color: #ef5350; background: rgba(239, 83, 80, 0.12); }
    .full-width { width: 100%; margin-top: 4px; margin-bottom: 6px; }

    .tool-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }

    .el-select {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--card-border);
      background: var(--card-input);
      color: var(--card-text);
      font-size: 11px;
    }

    .ground-el-block { margin-bottom: 6px; }
    .add-el-row { gap: 6px; }

    .el-remove-btn {
      width: 22px;
      height: 22px;
      line-height: 18px;
      border-radius: 4px;
      border: 1px solid var(--card-border);
      background: transparent;
      color: var(--card-text2);
      cursor: pointer;
      flex-shrink: 0;
    }
    .el-remove-btn:hover { color: #e5484d; border-color: #e5484d; }
  `],
})
export class GroundSettingsCardComponent implements OnChanges {
  @Input() visible = false;
  @Input() isAdmin = false;
  @Input() isDarkTheme = true;
  @Input() groundStyle: Record<number, ZoneGroundStyle> = {};
  @Input() groundSettings: GroundMapSettings | null = null;
  @Input() groundTilePx: number = PARK_MAP_VIS.groundTilePx;

  @Output() closed = new EventEmitter<void>();
  @Output() mapControlEvent = new EventEmitter<MapControlEvent>();

  localGroundTilePx: number = PARK_MAP_VIS.groundTilePx;
  localGroundSettings: GroundMapSettings = { ...DEFAULT_GROUND_MAP_SETTINGS };

  readonly groundTileMin = PARK_MAP_VIS.groundTileMin;
  readonly groundTileMax = PARK_MAP_VIS.groundTileMax;
  readonly groundElementSizePctMin = PARK_MAP_VIS.groundElementSizePctMin;
  readonly groundElementSizePctMax = PARK_MAP_VIS.groundElementSizePctMax;
  readonly groundScalePercentMin = PARK_MAP_VIS.groundScalePercentMin;
  readonly groundScalePercentMax = PARK_MAP_VIS.groundScalePercentMax;
  readonly groundZoneKeys = GROUND_ZONE_KEYS;
  readonly groundZoneLabels = GROUND_ZONE_LABELS;
  readonly groundElementTypes = GROUND_ELEMENT_TYPES;
  groundStyleEditTarget: number | 'park' = 'park';
  groundAddType: GroundElementType = 'stone';

  posX = 0;
  posY = 0;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private boundMove: ((e: MouseEvent) => void) | null = null;
  private boundUp: (() => void) | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groundSettings'] && this.groundSettings) {
      this.localGroundSettings = { ...this.groundSettings };
    }
    if (changes['groundTilePx']) {
      this.localGroundTilePx = this.groundTilePx ?? PARK_MAP_VIS.groundTilePx;
    }
    if (changes['groundStyle']) {
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  onDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.ground-card-close')) return;
    event.preventDefault();
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginX = this.posX;
    this.dragOriginY = this.posY;
    this.boundMove = (e: MouseEvent) => this.onDragMove(e);
    this.boundUp = () => this.onDragEnd();
    document.addEventListener('mousemove', this.boundMove);
    document.addEventListener('mouseup', this.boundUp);
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.dragging) return;
    this.posX = this.dragOriginX + (event.clientX - this.dragStartX);
    this.posY = this.dragOriginY + (event.clientY - this.dragStartY);
    this.cdr.markForCheck();
  }

  private onDragEnd(): void {
    this.dragging = false;
    if (this.boundMove) document.removeEventListener('mousemove', this.boundMove);
    if (this.boundUp) document.removeEventListener('mouseup', this.boundUp);
    this.boundMove = null;
    this.boundUp = null;
  }

  onGroundTilePxChange(px: number): void {
    this.localGroundTilePx = px;
    this.mapControlEvent.emit({ type: 'groundTilePxChange', value: px });
  }

  onGroundAutoTilePx(): void {
    this.mapControlEvent.emit({ type: 'groundAutoTilePx' });
  }

  onGroundScaleChange(percent: number): void {
    this.localGroundSettings = { ...this.localGroundSettings, scalePercent: percent };
    this.emitGroundSettingsChange();
  }

  onGroundQualityChange(percent: number): void {
    this.localGroundSettings = { ...this.localGroundSettings, qualityPercent: percent };
    this.emitGroundSettingsChange();
  }

  private emitGroundSettingsChange(): void {
    this.mapControlEvent.emit({ type: 'groundSettingsChange', settings: { ...this.localGroundSettings } });
  }

  get groundStyleEditSelectValue(): string {
    return this.groundStyleEditTarget === 'park' ? 'park' : String(this.groundStyleEditTarget);
  }

  onGroundStyleTargetChange(raw: string): void {
    this.groundStyleEditTarget = raw === 'park' ? 'park' : Number(raw);
    this.cdr.markForCheck();
  }

  get groundStyleEditZone(): ZoneGroundStyle | null {
    if (this.groundStyleEditTarget === 'park') {
      return this.resolveParkGroundEditTemplate();
    }
    return this.resolveGroundStyleLayer(this.groundStyleEditTarget);
  }

  private resolveGroundStyleLayer(key: number): ZoneGroundStyle | null {
    return this.groundStyle[key] ?? this.groundStyle[0] ?? this.groundStyle[1] ?? null;
  }

  private resolveParkGroundEditTemplate(): ZoneGroundStyle | null {
    for (const key of GROUND_PARK_LAYER_KEYS) {
      const z = this.groundStyle[key];
      if (z?.elements?.length) return z;
    }
    return this.resolveGroundStyleLayer(0);
  }

  groundElementLabel(type: GroundElementType): string {
    return GROUND_ELEMENT_LABELS[type];
  }

  groundDensityPercent(density: number): number {
    return Math.round(density * 100);
  }

  groundMacroDensityPercent(zone: ZoneGroundStyle): number {
    return Math.round(zone.macroDensity * 100);
  }

  groundMacroAlphaPercent(zone: ZoneGroundStyle): number {
    return Math.round(zone.macroAlpha * 100);
  }

  groundEdgeBlend(zone: ZoneGroundStyle): number {
    return Math.round(zone.edgeBlend ?? 0);
  }

  groundEdgeAlphaPercent(zone: ZoneGroundStyle): number {
    return Math.round((zone.edgeBlendAlpha ?? 0.85) * 100);
  }

  groundElementSizeMinPercent(el: { sizeMin: number }): number {
    return Math.round(el.sizeMin * 100);
  }

  groundElementSizeMaxPercent(el: { sizeMax: number }): number {
    return Math.round(el.sizeMax * 100);
  }

  onGroundElementDensityChange(elIndex: number, percent: number): void {
    const zone = this.patchedGroundZone();
    zone.elements[elIndex].density = Math.min(1.2, Math.max(0, Number(percent) || 0) / 100);
    this.emitGroundStyleZone(zone);
  }

  onGroundElementSizeMinChange(elIndex: number, percent: number): void {
    const zone = this.patchedGroundZone();
    const el = zone.elements[elIndex];
    if (!el) return;
    el.sizeMin = groundElementSizeFrac(Number(percent));
    if (el.sizeMax < el.sizeMin) el.sizeMax = el.sizeMin;
    this.emitGroundStyleZone(zone);
  }

  onGroundElementSizeMaxChange(elIndex: number, percent: number): void {
    const zone = this.patchedGroundZone();
    const el = zone.elements[elIndex];
    if (!el) return;
    el.sizeMax = groundElementSizeFrac(Number(percent));
    if (el.sizeMin > el.sizeMax) el.sizeMin = el.sizeMax;
    this.emitGroundStyleZone(zone);
  }

  onGroundEdgeBlendChange(px: number): void {
    const zone = this.patchedGroundZone();
    zone.edgeBlend = Math.min(48, Math.max(0, Number(px) || 0));
    this.emitGroundStyleZone(zone);
  }

  onGroundEdgeAlphaChange(percent: number): void {
    const zone = this.patchedGroundZone();
    zone.edgeBlendAlpha = Math.min(1, Math.max(0, Number(percent) || 0) / 100);
    this.emitGroundStyleZone(zone);
  }

  addGroundElement(): void {
    const zone = this.patchedGroundZone();
    zone.elements.push({ type: this.groundAddType, density: 0.15, min: 0, sizeMin: 0.2, sizeMax: 0.4 });
    this.emitGroundStyleZone(zone);
  }

  removeGroundElement(elIndex: number): void {
    const zone = this.patchedGroundZone();
    zone.elements.splice(elIndex, 1);
    this.emitGroundStyleZone(zone);
  }

  onGroundMacroDensityChange(percent: number): void {
    const zone = this.patchedGroundZone();
    zone.macroDensity = Math.min(2, Math.max(0, Number(percent) || 0) / 100);
    this.emitGroundStyleZone(zone);
  }

  onGroundMacroAlphaChange(percent: number): void {
    const zone = this.patchedGroundZone();
    zone.macroAlpha = Math.min(1, Math.max(0, Number(percent) || 0) / 100);
    this.emitGroundStyleZone(zone);
  }

  applyGroundStyleToAllZones(): void {
    this.mapControlEvent.emit({ type: 'groundStyleApplyAll', style: this.patchedGroundZone() });
  }

  clearAllGroundLayers(): void {
    this.mapControlEvent.emit({ type: 'groundStyleClearAll' });
  }

  resetGroundStyleZone(): void {
    if (this.groundStyleEditTarget === 'park') {
      this.mapControlEvent.emit({ type: 'groundStyleResetParkLayers' });
      return;
    }
    this.mapControlEvent.emit({ type: 'groundStyleResetZone', sectionIndex: this.groundStyleEditTarget });
  }

  resetGroundStyleAll(): void {
    this.mapControlEvent.emit({ type: 'groundStyleResetAll' });
  }

  private patchedGroundZone(): ZoneGroundStyle {
    const z = this.groundStyleEditZone;
    if (!z) return { elements: [], macroDensity: 1, macroAlpha: 1 };
    return {
      macroDensity: z.macroDensity,
      macroAlpha: z.macroAlpha,
      edgeBlend: z.edgeBlend,
      edgeBlendAlpha: z.edgeBlendAlpha,
      bridge: z.bridge ? { ...z.bridge, elements: z.bridge.elements.map((e) => ({ ...e })) } : undefined,
      elements: z.elements.map((e) => ({ ...e })),
    };
  }

  private emitGroundStyleZone(zone: ZoneGroundStyle): void {
    if (this.groundStyleEditTarget === 'park') {
      this.mapControlEvent.emit({ type: 'groundStyleApplyParkLayers', style: zone });
      return;
    }
    this.mapControlEvent.emit({
      type: 'groundStyleZoneChange',
      sectionIndex: this.groundStyleEditTarget,
      style: zone,
    });
  }
}
