import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  MapCheckpoint,
  MapCheckpointSummary,
  MapConfigData,
} from '../models/map-layer-config.model';

const SESSION_KEY = 'pcymt_map_session_v1';
const CHECKPOINTS_KEY = 'pcymt_map_checkpoints_v1';
const LEGACY_MAP_KEY = 'pcymt_map_state_v3';
const LEGACY_STICKER_KEY = 'pcymt_sticker_layers_v1';
const MAX_CHECKPOINTS = 10;

interface StoredSession {
  data: MapConfigData;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MapSessionService {
  private readonly checkpointsSubject = new BehaviorSubject<MapCheckpointSummary[]>([]);
  checkpoints$ = this.checkpointsSubject.asObservable();

  private lastSessionSavedAt: string | null = null;

  constructor() {
    this.refreshCheckpointList();
  }

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
      return !!localStorage.getItem(SESSION_KEY)
        || !!localStorage.getItem(LEGACY_MAP_KEY)
        || !!localStorage.getItem(LEGACY_STICKER_KEY);
    } catch {
      return false;
    }
  }

  listCheckpoints(): MapCheckpointSummary[] {
    return this.readCheckpoints().map(({ id, label, savedAt }) => ({ id, label, savedAt }));
  }

  saveCheckpoint(data: MapConfigData, label?: string): MapCheckpoint | null {
    const checkpoints = this.readCheckpoints();
    const savedAt = new Date().toISOString();
    const checkpoint: MapCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: (label?.trim() || this.defaultCheckpointLabel(checkpoints.length + 1)),
      savedAt,
      data,
    };
    checkpoints.unshift(checkpoint);
    if (checkpoints.length > MAX_CHECKPOINTS) {
      checkpoints.length = MAX_CHECKPOINTS;
    }
    if (!this.writeCheckpoints(checkpoints)) return null;
    this.refreshCheckpointList();
    return checkpoint;
  }

  getCheckpoint(id: string): MapCheckpoint | null {
    return this.readCheckpoints().find((c) => c.id === id) ?? null;
  }

  restoreCheckpoint(id: string): MapConfigData | null {
    return this.getCheckpoint(id)?.data ?? null;
  }

  deleteCheckpoint(id: string): boolean {
    const next = this.readCheckpoints().filter((c) => c.id !== id);
    if (!this.writeCheckpoints(next)) return false;
    this.refreshCheckpointList();
    return true;
  }

  renameCheckpoint(id: string, label: string): boolean {
    const trimmed = label.trim();
    if (!trimmed) return false;
    const checkpoints = this.readCheckpoints();
    const target = checkpoints.find((c) => c.id === id);
    if (!target) return false;
    target.label = trimmed;
    if (!this.writeCheckpoints(checkpoints)) return false;
    this.refreshCheckpointList();
    return true;
  }

  private migrateLegacySession(): MapConfigData | null {
    try {
      const mapRaw = localStorage.getItem(LEGACY_MAP_KEY);
      const stickerRaw = localStorage.getItem(LEGACY_STICKER_KEY);
      if (!mapRaw && !stickerRaw) return null;

      let mapState = {
        scale: 1.2,
        rotation: -52 * Math.PI / 180,
        offsetX: 0,
        offsetY: 0,
        showSections: true,
        showLabels: true,
      };
      if (mapRaw) {
        const legacy = JSON.parse(mapRaw);
        mapState = { ...mapState, ...legacy };
      }

      let stickerLayers: MapConfigData['stickerLayers'] = [];
      if (stickerRaw) {
        const layers = JSON.parse(stickerRaw) as Array<{
          id: string; name: string; visible: boolean;
          stickers: Array<{ stickerKey: string; lat: number; lng: number; scale: number; rotation: number; opacity: number }>;
        }>;
        stickerLayers = layers.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          stickers: l.stickers ?? [],
        }));
      }

      return {
        version: 1,
        mapState,
        stickerLayers,
        activeStickerLayerId: stickerLayers[0]?.id ?? null,
      };
    } catch (e) {
      console.warn('MapSessionService: legacy migrate failed', e);
      return null;
    }
  }

  private readCheckpoints(): MapCheckpoint[] {
    try {
      const raw = localStorage.getItem(CHECKPOINTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { checkpoints?: MapCheckpoint[] };
      return Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [];
    } catch {
      return [];
    }
  }

  private writeCheckpoints(checkpoints: MapCheckpoint[]): boolean {
    try {
      localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify({ checkpoints }));
      return true;
    } catch (e) {
      console.warn('MapSessionService: checkpoint save failed', e);
      return false;
    }
  }

  private refreshCheckpointList(): void {
    this.checkpointsSubject.next(this.listCheckpoints());
  }

  private defaultCheckpointLabel(index: number): string {
    return `Punto ${index}`;
  }
}
