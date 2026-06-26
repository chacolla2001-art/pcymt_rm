import { Component, OnInit, OnDestroy, EventEmitter, Output, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MapLayerConfigService } from '../services/map-layer-config.service';
import { MapConfigData } from '../models/map-layer-config.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

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
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  template: `
    <div class="config-panel" [class.open]="isOpen" [class.dark]="isDarkTheme" [class.hidden-toggle]="!showToggle">
      @if (showToggle) {
        <button class="toggle-btn" (click)="togglePanel()"
          [attr.title]="'map.toggleConfig' | translate"
          [attr.aria-label]="'map.toggleConfig' | translate"
          aria-haspopup="dialog"
          [attr.aria-expanded]="isOpen">
          <mat-icon aria-hidden="true">save</mat-icon>
        </button>
      }

      @if (isOpen && showToggle) {
        <div class="panel-body" role="region" [attr.aria-label]="'map.configTitle' | translate">
          <h3 class="panel-title">
            <mat-icon aria-hidden="true">tune</mat-icon>
            {{ 'map.configTitle' | translate }}
          </h3>

          @if (lastSavedAt) {
            <div class="last-saved">
              <span class="saved-label">{{ 'map.saved' | translate }}</span>
              <span class="saved-date">{{ lastSavedAt | date:'dd/MM/yy HH:mm' }}</span>
            </div>
          }
          @if (!lastSavedAt && !loading) {
            <div class="last-saved not-saved">{{ 'map.noConfigSaved' | translate }}</div>
          }

          <div class="actions">
            <button class="btn-action btn-save"
              (click)="saveConfig()"
              [disabled]="saving"
              [attr.title]="'map.saveHint' | translate">
              @if (saving) {
                <mat-spinner diameter="16" aria-hidden="true"></mat-spinner>
              } @else {
                <mat-icon aria-hidden="true">save</mat-icon>
              }
              {{ saving ? ('map.saving' | translate) : ('map.saveCurrent' | translate) }}
            </button>

            <button class="btn-action btn-load"
              (click)="loadConfig()"
              [disabled]="loading || !lastSavedAt"
              [attr.title]="'map.loadHint' | translate">
              @if (loading) {
                <mat-spinner diameter="16" aria-hidden="true"></mat-spinner>
              } @else {
                <mat-icon aria-hidden="true">folder_open</mat-icon>
              }
              {{ loading ? ('map.loading' | translate) : ('map.restoreSaved' | translate) }}
            </button>
          </div>

          <div class="hint" aria-hidden="true">
            <kbd>Ctrl</kbd>+<kbd>G</kbd> grilla &nbsp;
            <kbd>Ctrl</kbd>+<kbd>L</kbd> etiquetas<br>
            <kbd>Ctrl</kbd>+<kbd>±</kbd> zoom &nbsp;
            <kbd>Ctrl</kbd>+<kbd>R</kbd> reset
          </div>
        </div>
      }

      <div class="toast" [class.visible]="showToast" [class.error]="toastIsError" role="status">{{ toastMessage }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .config-panel {
      --panel-bg: color-mix(in srgb, var(--sys-inverse-surface) 92%, transparent);
      --panel-border: var(--sys-outline-variant);
      --text: var(--sys-inverse-on-surface);
      --text-secondary: color-mix(in srgb, var(--sys-inverse-on-surface) 70%, transparent);
      --accent: var(--sys-primary);
      --danger: var(--sys-error);
      --success: var(--sys-tertiary);

      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      font-family: Roboto, 'Segoe UI', sans-serif;
      font-size: 13px;
    }

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
      --panel-bg: color-mix(in srgb, var(--sys-surface) 95%, transparent);
      --panel-border: var(--sys-outline-variant);
      --text: var(--sys-on-surface);
      --text-secondary: var(--sys-on-surface-variant);
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
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, transform 0.15s;
      backdrop-filter: blur(4px);
    }

    .toggle-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

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
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }

    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.85; }

    .last-saved {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--text) 5%, transparent);
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
      transition: filter 0.15s, border-color 0.15s, color 0.15s;
      text-align: left;
    }

    .btn-action mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .btn-action:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .btn-save {
      background: var(--accent);
      color: var(--sys-on-primary);
    }
    .btn-save:not(:disabled):hover {
      filter: brightness(1.1);
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
      background: color-mix(in srgb, var(--text) 4%, transparent);
      border-radius: 6px;
      margin-bottom: 4px;
    }

    kbd {
      display: inline-block;
      padding: 1px 4px;
      background: color-mix(in srgb, var(--text) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--text) 20%, transparent);
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
      transition: opacity 0.3s, max-height 0.3s;
      background: var(--success);
      color: var(--sys-on-tertiary);
      text-align: center;
    }

    .toast.visible {
      opacity: 1;
      max-height: 40px;
      margin-top: 8px;
    }

    .toast.error { background: var(--danger); color: var(--sys-on-error); }
  `]
})
export class MapLayerConfigPanelComponent implements OnInit, OnDestroy {
  @Input() isDarkTheme = true;
  @Input() showToggle = true;

  @Output() configLoaded = new EventEmitter<MapConfigData>();
  @Output() captureStateRequest = new EventEmitter<void>();

  private readonly i18n = inject(I18nService);
  private destroy$ = new Subject<void>();

  isOpen = false;
  loading = false;
  saving = false;
  lastSavedAt: Date | null = null;

  showToast = false;
  toastMessage = '';
  toastIsError = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

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

  receiveState(state: MapConfigData): void {
    this.pendingState = state;
    this.doSave(state);
  }

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
          this.toast(this.i18n.t('map.configSaved'));
        },
        error: () => {
          this.saving = false;
          this.toast(this.i18n.t('map.saveError'), true);
        }
      });
  }

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
            this.toast(this.i18n.t('map.configRestored'));
          } else {
            this.toast(this.i18n.t('map.noConfigSaved'), true);
          }
        },
        error: () => {
          this.loading = false;
          this.toast(this.i18n.t('map.loadError'), true);
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
