import { Injectable } from '@angular/core';
import { MapConfigData } from '../models/map-layer-config.model';

const SESSION_KEY = 'pcymt_map_session_v1';
const LEGACY_MAP_KEY = 'pcymt_map_state_v3';

interface StoredSession {
  data: MapConfigData;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MapSessionService {
  private lastSessionSavedAt: string | null = null;

  get lastSavedAt(): string | null {
    return this.lastSessionSavedAt;
  }

  saveSession(data: MapConfigData): boolean {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ data, savedAt } satisfies StoredSession));
      this.lastSessionSavedAt = savedAt;
      return true;
    } catch (e) {
      console.warn('MapSessionService: session save failed', e);
      return false;
    }
  }

  loadSession(): MapConfigData | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return this.migrateLegacySession();
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed?.data?.mapState) return this.migrateLegacySession();
      this.lastSessionSavedAt = parsed.savedAt ?? null;
      return parsed.data;
    } catch (e) {
      console.warn('MapSessionService: session load failed', e);
      return this.migrateLegacySession();
    }
  }

  hasSession(): boolean {
    try {
      return !!localStorage.getItem(SESSION_KEY) || !!localStorage.getItem(LEGACY_MAP_KEY);
    } catch {
      return false;
    }
  }

  private migrateLegacySession(): MapConfigData | null {
    try {
      const mapRaw = localStorage.getItem(LEGACY_MAP_KEY);
      if (!mapRaw) return null;

      let mapState = {
        scale: 1.2,
        rotation: -52 * Math.PI / 180,
        offsetX: 0,
        offsetY: 0,
        showSections: true,
        showLabels: true,
      };
      const legacy = JSON.parse(mapRaw);
      mapState = { ...mapState, ...legacy };

      return {
        version: 1,
        mapState,
      };
    } catch (e) {
      console.warn('MapSessionService: legacy migrate failed', e);
      return null;
    }
  }
}
