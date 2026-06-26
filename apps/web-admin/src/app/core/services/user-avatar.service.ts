import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiRoutesService } from './api-routes.service';
import {
  DEFAULT_AVATAR_API_PATH,
  normalizeAvatarPath,
  resolvePredefinedIdFromUrl,
  resolveStoredAvatarPath,
  isUserScopedProfilePicturePath,
} from '../utils/avatar-url.util';

export interface PredefinedAvatarOption {
  id: string;
  label: string;
  url: string;
}

/**
 * Gestión centralizada del avatar de perfil:
 * - Avatar por defecto (oso) si no hay foto o el archivo no existe
 * - URLs con token JWT para <img>
 * - Sincronización header ↔ settings ↔ auth
 */
@Injectable({ providedIn: 'root' })
export class UserAvatarService {
  private readonly auth = inject(AuthService);
  private readonly apiRoutes = inject(ApiRoutesService);

  private readonly version = signal(0);

  constructor() {
    this.auth.userUpdated$.subscribe(() => this.bumpRefresh());
  }

  readonly defaultDisplayUrl = computed(() => {
    this.version();
    return this.apiRoutes.getAssetUrl(DEFAULT_AVATAR_API_PATH);
  });

  readonly displayUrl = computed(() => {
    this.version();
    return this.buildDisplayUrl(this.auth.currentUser?.avatar_url);
  });

  readonly hasCustomAvatar = computed(() => {
    const raw = (this.auth.currentUser?.avatar_url ?? '').trim();
    return Boolean(raw) && resolveStoredAvatarPath(raw) !== DEFAULT_AVATAR_API_PATH;
  });

  bumpRefresh(): void {
    this.version.update((v) => v + 1);
  }

  /** URL lista para mostrar (nunca vacía: usa oso por defecto) */
  buildDisplayUrl(rawPath?: string | null): string {
    const normalized = resolveStoredAvatarPath(rawPath ?? this.auth.currentUser?.avatar_url);
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }

    let url = this.apiRoutes.getAssetUrl(normalized);
    if (isUserScopedProfilePicturePath(normalized)) {
      const updatedAt = this.auth.currentUser?.updated_at;
      const versionMs = updatedAt instanceof Date
        ? updatedAt.getTime()
        : updatedAt
          ? new Date(updatedAt).getTime()
          : Date.now();
      url += `${url.includes('?') ? '&' : '?'}v=${versionMs}`;
    }
    return url;
  }

  /** Si la imagen falla (404), mostrar avatar por defecto */
  onAvatarImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;

    const fallback = this.defaultDisplayUrl();
    if (img.src !== fallback) {
      img.src = fallback;
    }
  }

  buildPredefinedUrl(avatar: PredefinedAvatarOption): string {
    return this.apiRoutes.getAssetUrl(avatar.url);
  }

  resolvePredefinedId(
    avatars: PredefinedAvatarOption[],
    rawPath?: string | null,
  ): string | null {
    return resolvePredefinedIdFromUrl(avatars, rawPath);
  }

  applyAvatar(rawPath: string): void {
    const user = this.auth.currentUser;
    if (!user) return;

    user.avatar_url = normalizeAvatarPath(rawPath);
    this.auth.updateCurrentUser(user);
  }
}
