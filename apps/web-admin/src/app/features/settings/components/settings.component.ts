import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { SettingsService, AppConfig } from '../services/settings.service';
import { I18nService, AppLanguage } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface TtlPreset {
  label: string;
  key: string;
  days: number;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  config: AppConfig | null = null;
  ttlDays = 365;
  originalTtlDays = 365;
  private subs = new Subscription();

  readonly ttlPresets: TtlPreset[] = [
    { label: '', key: 'settings.day', days: 1, icon: 'hourglass_empty' },
    { label: '', key: 'settings.week', days: 7, icon: 'date_range' },
    { label: '', key: 'settings.month', days: 30, icon: 'calendar_month' },
    { label: '', key: 'settings.threeMonths', days: 90, icon: 'event' },
    { label: '', key: 'settings.sixMonths', days: 180, icon: 'event_available' },
    { label: '', key: 'settings.year', days: 365, icon: 'all_inclusive' },
  ];

  constructor(
    private readonly settingsService: SettingsService,
    readonly i18n: I18nService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadConfig();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get ttlChanged(): boolean {
    return this.ttlDays !== this.originalTtlDays;
  }

  get ttlLabel(): string {
    if (this.ttlDays === 1) return `1 ${this.i18n.t('settings.day')}`;
    return `${this.ttlDays} ${this.i18n.t('settings.days')}`;
  }

  loadConfig(): void {
    this.loading = true;
    this.subs.add(
      this.settingsService.getConfig().subscribe({
        next: (config) => {
          this.config = config;
          this.ttlDays = config.arcore.cloudAnchorTtlDays;
          this.originalTtlDays = config.arcore.cloudAnchorTtlDays;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open(this.i18n.t('settings.error'), 'OK', { duration: 4000 });
        },
      })
    );
  }

  setTtlPreset(days: number): void {
    this.ttlDays = days;
  }

  isPresetActive(days: number): boolean {
    return this.ttlDays === days;
  }

  saveTtl(): void {
    if (this.saving || !this.ttlChanged) return;
    this.saving = true;

    this.subs.add(
      this.settingsService.updateConfig({ cloudAnchorTtlDays: this.ttlDays }).subscribe({
        next: () => {
          this.originalTtlDays = this.ttlDays;
          this.saving = false;
          this.snackBar.open(this.i18n.t('settings.saved'), '✓', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
        },
        error: () => {
          this.saving = false;
          this.snackBar.open(this.i18n.t('settings.error'), 'OK', { duration: 4000 });
        },
      })
    );
  }

  setLanguage(lang: AppLanguage): void {
    this.i18n.setLanguage(lang);
  }

  formatTtlSliderLabel(value: number): string {
    if (value >= 365) return '1Y';
    if (value >= 30) return `${Math.round(value / 30)}M`;
    if (value >= 7) return `${Math.round(value / 7)}W`;
    return `${value}D`;
  }
}
