import { Component, OnInit, OnDestroy, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MapLayerConfigService } from '../services/map-layer-config.service';
import { MapConfigData } from '../models/map-layer-config.model';

/**
 * Simplified map config panel — single global config per system.
 * No multiple named configs, no public flag.
 * One "Save" button → upserts the global record.
 * One "Load" button → restores the global record.
 * Button is positioned at the top-right of the map.
 */
@Component({
  selector: 'app-map-layer-config-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="config-panel" [class.open]="isOpen" [class.dark]="isDarkTheme" [class.hidden-toggle]="!showToggle">
      <!-- Toggle button — only shown when showToggle is true -->
      @if (showToggle) {
        <button class="toggle-btn" (click)="togglePanel()" title="Guardar / cargar configuración del mapa">
          <span class="icon">💾</span>
        </button>
      }

      <div class="panel-body" *ngIf="isOpen && showToggle">
        <h3 class="panel-title">📋 Config. del Mapa</h3>

        <!-- Last saved info -->
        <div class="last-saved" *ngIf="lastSavedAt">
          <span class="saved-label">Guardado</span>
          <span class="saved-date">{{ lastSavedAt | date:'dd/MM/yy HH:mm' }}</span>
        </div>
        <div class="last-saved not-saved" *ngIf="!lastSavedAt && !loading">
          Sin configuración guardada
        </div>

        <!-- Actions -->
        <div class="actions">
          <button class="btn-action btn-save"
            (click)="saveConfig()"
            [disabled]="saving"
            title="Guarda posición, zoom, rotación y stickers actuales">
            <span>{{ saving ? '⏳' : '💾' }}</span>
            {{ saving ? 'Guardando...' : 'Guardar estado actual' }}
          </button>

          <button class="btn-action btn-load"
            (click)="loadConfig()"
            [disabled]="loading || !lastSavedAt"
            title="Restaura la última configuración guardada">
            <span>{{ loading ? '⏳' : '📂' }}</span>
            {{ loading ? 'Cargando...' : 'Restaurar guardado' }}
          </button>
        </div>

        <!-- Keyboard hint -->
        <div class="hint">
          <kbd>Ctrl</kbd>+<kbd>G</kbd> grilla &nbsp;
          <kbd>Ctrl</kbd>+<kbd>L</kbd> etiquetas<br>
          <kbd>Ctrl</kbd>+<kbd>±</kbd> zoom &nbsp;
          <kbd>Ctrl</kbd>+<kbd>R</kbd> reset
        </div>
      </div>

      <!-- Toast — always shown regardless of showToggle -->
      <div class="toast" [class.visible]="showToast" [class.error]="toastIsError">{{ toastMessage }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .config-panel {
      --panel-bg: rgba(0, 0, 0, 0.9);
      --panel-border: #444;
      --text: #fff;
      --text-secondary: #aaa;
      --accent: #7c4dff;
      --danger: #f44336;
      --success: #4caf50;

      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      font-family: 'Segoe UI', sans-serif;
      font-size: 13px;
    }

    /* When toggle button is hidden, only show toast centered at top */
    .config-panel.hidden-toggle {
      top: 10px;
      right: 50%;
      transform: translateX(50%);
      pointer-events: none;
    }
    .config-panel.hidden-toggle .toast {
      pointer-events: auto;
    }

    .config-panel:not(.dark) {
      --panel-bg: rgba(255, 255, 255, 0.95);
      --panel-border: #ddd;
      --text: #212121;
      --text-secondary: #666;
    }

    .toggle-btn {
      position: absolute;
      top: 0;
      right: 0;
      width: 40px;
      height: 40px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      color: var(--text);
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      backdrop-filter: blur(4px);
    }

    .toggle-btn:hover {
      border-color: var(--accent);
      transform: scale(1.05);
    }

    .panel-body {
      position: absolute;
      top: 48px;
      right: 0;
      width: 250px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 14px;
      backdrop-filter: blur(8px);
    }

    .panel-title {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }

    .last-saved {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .saved-label { color: var(--text-secondary); }
    .saved-date { color: var(--accent); font-weight: 600; }
    .not-saved { color: var(--text-secondary); font-style: italic; justify-content: center; }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .btn-action {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid transparent;
      transition: all 0.15s;
      text-align: left;
    }

    .btn-action:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .btn-save {
      background: var(--accent);
      color: #fff;
    }
    .btn-save:not(:disabled):hover {
      filter: brightness(1.15);
    }

    .btn-load {
      background: transparent;
      border-color: var(--panel-border);
      color: var(--text);
    }
    .btn-load:not(:disabled):hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .hint {
      font-size: 10px;
      color: var(--text-secondary);
      line-height: 1.8;
      padding: 8px;
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      margin-bottom: 4px;
    }

    kbd {
      display: inline-block;
      padding: 1px 4px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 3px;
      font-size: 10px;
      font-family: monospace;
    }

    .toast {
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 11px;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      transition: all 0.3s;
      background: var(--success);
      color: #fff;
      text-align: center;
    }

    .toast.visible {
      opacity: 1;
      max-height: 40px;
      margin-top: 8px;
    }

    .toast.error { background: var(--danger); }
  `]
})
export class MapLayerConfigPanelComponent implements OnInit, OnDestroy {
  @Input() isDarkTheme = true;
  /** When false, hides the toggle button — save/load is triggered externally */
  @Input() showToggle = true;

  /** Emits the config data to apply to the map */
  @Output() configLoaded = new EventEmitter<MapConfigData>();

  /** Request current map state (parent should respond via captureState) */
  @Output() captureStateRequest = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  isOpen = false;
  loading = false;
  saving = false;
  lastSavedAt: Date | null = null;

  showToast = false;
  toastMessage = '';
  toastIsError = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set by parent when captureState is requested */
  private pendingState: MapConfigData | null = null;

  constructor(private configService: MapLayerConfigService) {}

  ngOnInit(): void {
    this.fetchLastSavedDate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.fetchLastSavedDate();
    }
  }

  private fetchLastSavedDate(): void {
    this.configService.getGlobal()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: config => {
          this.lastSavedAt = config?.updatedAt ?? null;
        },
        error: () => { this.lastSavedAt = null; }
      });
  }

  /** Called by parent to provide captured state for saving */
  receiveState(state: MapConfigData): void {
    this.pendingState = state;
    this.doSave(state);
  }

  /** User pressed "Save" button */
  saveConfig(): void {
    this.captureStateRequest.emit();
  }

  private doSave(state: MapConfigData): void {
    this.saving = true;
    this.configService.upsertGlobal(state)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.lastSavedAt = saved.updatedAt;
          this.toast('✅ Configuración guardada');
        },
        error: () => {
          this.saving = false;
          this.toast('❌ Error al guardar', true);
        }
      });
  }

  /** User pressed "Load" button */
  loadConfig(): void {
    if (this.loading) return;
    this.loading = true;
    this.configService.getGlobal()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: config => {
          this.loading = false;
          if (config?.configData) {
            this.configLoaded.emit(config.configData);
            this.toast('✅ Configuración restaurada');
          } else {
            this.toast('No hay configuración guardada', true);
          }
        },
        error: () => {
          this.loading = false;
          this.toast('❌ Error al cargar', true);
        }
      });
  }

  private toast(msg: string, isError = false): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastIsError = isError;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 2800);
  }
}
