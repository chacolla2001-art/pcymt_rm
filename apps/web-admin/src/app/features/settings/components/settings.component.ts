import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { SettingsService, AppConfig, PredefinedAvatar } from '../services/settings.service';
import { I18nService, AppLanguage } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';
import { UserAvatarService } from '../../../core/services/user-avatar.service';
import { ThemeManagerService, ThemeMode } from '../../../core/services/theme-manager.service';
import { AppShellLoadService } from '../../../core/services/app-shell-load.service';

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
  savingAvatar = false;
  config: AppConfig | null = null;
  avatars: PredefinedAvatar[] = [];
  selectedAvatarId: string | null = null;
  currentAvatarUrl = '';
  ttlDays = 365;
  originalTtlDays = 365;
  private subs = new Subscription();
  private readonly shellLoad = inject(AppShellLoadService);

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
    private readonly snackBar: MatSnackBar,
    readonly authService: AuthService,
    private readonly userService: UserService,
    readonly apiRoutes: ApiRoutesService,
    readonly userAvatar: UserAvatarService,
    readonly themeManager: ThemeManagerService,
  ) {}

  ngOnInit(): void {
    this.loadConfig();
    this.subs.add(
      this.authService.userUpdated$.subscribe(() => {
        if (this.avatars.length) {
          this.syncCurrentAvatar();
        }
      }),
    );
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
      this.settingsService.getConfig().pipe(this.shellLoad.endNavigationWhenDone()).subscribe({
        next: (config) => {
          this.config = config;
          this.avatars = config.avatars ?? [];
          this.ttlDays = config.arcore.cloudAnchorTtlDays;
          this.originalTtlDays = config.arcore.cloudAnchorTtlDays;
          this.syncCurrentAvatar();
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

  setThemeMode(mode: ThemeMode): void {
    this.themeManager.setThemeMode(mode);
  }

  formatTtlSliderLabel(value: number): string {
    if (value >= 365) return '1Y';
    if (value >= 30) return `${Math.round(value / 30)}M`;
    if (value >= 7) return `${Math.round(value / 7)}W`;
    return `${value}D`;
  }

  private syncCurrentAvatar(): void {
    const raw = this.authService.currentUser?.avatar_url ?? '';
    this.currentAvatarUrl = this.userAvatar.buildDisplayUrl(raw);
    this.selectedAvatarId = this.userAvatar.resolvePredefinedId(this.avatars, raw);
  }

  selectAvatar(avatar: PredefinedAvatar): void {
    const userId = this.authService.currentUser?.id;
    if (!userId || this.savingAvatar) return;

    const previousId = this.selectedAvatarId;
    this.selectedAvatarId = avatar.id;
    this.currentAvatarUrl = this.userAvatar.buildPredefinedUrl(avatar);
    this.savingAvatar = true;

    this.subs.add(
      this.userService.setPredefinedAvatar(userId, avatar.id).subscribe({
        next: (response) => {
          const rawUrl = response.avatar_url ?? response.profile_picture_url;
          this.userAvatar.applyAvatar(rawUrl);
          this.currentAvatarUrl = this.userAvatar.buildDisplayUrl(rawUrl);
          this.selectedAvatarId = avatar.id;
          this.savingAvatar = false;
          this.snackBar.open(this.i18n.t('settings.avatarSaved'), '✓', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
        },
        error: () => {
          this.selectedAvatarId = previousId;
          this.syncCurrentAvatar();
          this.savingAvatar = false;
          this.snackBar.open(this.i18n.t('settings.avatarError'), 'OK', { duration: 4000 });
        },
      })
    );
  }

  isAvatarSelected(avatar: PredefinedAvatar): boolean {
    return this.selectedAvatarId === avatar.id;
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.savingAvatar) return;

    const file = input.files[0];
    input.value = '';

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(this.i18n.t('settings.avatarUploadError'), 'OK', { duration: 4000 });
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.snackBar.open(this.i18n.t('settings.avatarUploadError'), 'OK', { duration: 4000 });
      return;
    }

    const userId = this.authService.currentUser?.id;
    if (!userId) return;

    this.savingAvatar = true;
    this.subs.add(
      this.userService.updateProfilePicture(userId, file).subscribe({
        next: (response) => {
          const rawUrl = response.avatar_url ?? response.profile_picture_url ?? '';
          this.userAvatar.applyAvatar(rawUrl);
          this.syncCurrentAvatar();
          this.selectedAvatarId = null;
          this.savingAvatar = false;
          this.snackBar.open(this.i18n.t('settings.avatarUploadSuccess'), '✓', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
        },
        error: () => {
          this.savingAvatar = false;
          this.snackBar.open(this.i18n.t('settings.avatarUploadError'), 'OK', { duration: 4000 });
        },
      }),
    );
  }
}
