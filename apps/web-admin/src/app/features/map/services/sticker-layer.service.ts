import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  StickerLayer,
  StickerInstance,
  StickerDefinition,
  STICKER_CATALOG
} from '../models/sticker.model';

/**
 * Service that manages a SINGLE sticker layer, CRUD operations,
 * and persistence to localStorage.
 *
 * Simplified: only one layer exists. Admins can edit; regular users just see stickers.
 */
@Injectable({ providedIn: 'root' })
export class StickerLayerService {
  private readonly STORAGE_KEY = 'pcymt_sticker_layers_v1';
  private readonly imageCache = new Map<string, HTMLImageElement>();
  /** In-flight load promises — shared so concurrent callers get the same Promise */
  private readonly imageLoading = new Map<string, Promise<HTMLImageElement>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500;

  private layersSubject = new BehaviorSubject<StickerLayer[]>([]);
  layers$ = this.layersSubject.asObservable();

  /** Currently active layer id (always the single layer) */
  private activeLayerIdSubject = new BehaviorSubject<string | null>(null);
  activeLayerId$ = this.activeLayerIdSubject.asObservable();

  /** Whether sticker edit mode is active */
  private editModeSubject = new BehaviorSubject<boolean>(false);
  editMode$ = this.editModeSubject.asObservable();

  // ── Undo / Redo stacks ───────────────────────────────────
  private undoStack: StickerLayer[][] = [];
  private redoStack: StickerLayer[][] = [];
  private readonly MAX_UNDO_STEPS = 50;

  constructor() {
    this.load();
    this.ensureSingleLayer();
  }

  // ── Catalog ──────────────────────────────────────────────

  getAvailableStickers(): StickerDefinition[] {
    return STICKER_CATALOG;
  }

  // ── Image Cache ──────────────────────────────────────────

  loadImage(key: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(key);
    if (cached && cached.complete) return Promise.resolve(cached);

    // Return the existing in-flight promise if one exists for this key
    const inflight = this.imageLoading.get(key);
    if (inflight) return inflight;

    const def = STICKER_CATALOG.find(s => s.key === key);
    if (!def) return Promise.reject(`Unknown sticker: ${key}`);

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(key, img);
        this.imageLoading.delete(key);
        resolve(img);
      };
      img.onerror = () => {
        this.imageLoading.delete(key);
        reject(`Failed to load image: ${def.imagePath}`);
      };
      img.src = def.imagePath;
    });

    this.imageLoading.set(key, promise);
    return promise;
  }

  getCachedImage(key: string): HTMLImageElement | undefined {
    const img = this.imageCache.get(key);
    return img?.complete ? img : undefined;
  }

  preloadAll(): void {
    STICKER_CATALOG.forEach(s => this.loadImage(s.key).catch(() => {}));
  }

  // ── Single Layer Management ──────────────────────────────

  get layers(): StickerLayer[] {
    return this.layersSubject.value;
  }

  get activeLayerId(): string | null {
    return this.activeLayerIdSubject.value;
  }

  get isEditMode(): boolean {
    return this.editModeSubject.value;
  }

  setEditMode(enabled: boolean): void {
    this.editModeSubject.next(enabled);
    if (!enabled) {
      this.saveImmediate(); // Flush immediately when leaving edit mode
    }
  }

  setActiveLayer(layerId: string | null): void {
    this.activeLayerIdSubject.next(layerId);
  }

  getActiveLayer(): StickerLayer | undefined {
    const id = this.activeLayerId;
    if (id) {
      const found = this.layers.find(l => l.id === id);
      if (found) return found;
    }
    return this.layers.length > 0 ? this.layers[0] : undefined;
  }

  /** Ensure at least one layer exists */
  ensureSingleLayer(): void {
    if (this.layers.length === 0) {
      const layer: StickerLayer = {
        id: this.generateId(),
        name: 'Stickers',
        visible: true,
        opacity: 1.0,
        stickers: []
      };
      this.layersSubject.next([layer]);
      this.activeLayerIdSubject.next(layer.id);
      this.save();
    } else if (!this.activeLayerId || !this.layers.find(l => l.id === this.activeLayerId)) {
      this.activeLayerIdSubject.next(this.layers[0].id);
    }
  }

  /** Set opacity for the layer (0.0 – 1.0) */
  setLayerOpacity(layerId: string, opacity: number): void {
    this.updateLayer(layerId, l => ({ ...l, opacity: Math.max(0, Math.min(1, opacity)) }));
  }

  /** Clear all stickers from a layer */
  clearAllStickers(layerId: string): void {
    this.updateLayer(layerId, l => ({ ...l, stickers: [] }));
  }

  // ── Sticker CRUD ─────────────────────────────────────────

  addSticker(layerId: string, stickerKey: string, lat: number, lng: number): StickerInstance {
    const sticker: StickerInstance = {
      id: this.generateId(),
      stickerKey,
      lat,
      lng,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0
    };
    this.updateLayer(layerId, l => ({
      ...l,
      stickers: [...l.stickers, sticker]
    }));
    this.loadImage(stickerKey).catch(() => {});
    return sticker;
  }

  updateSticker(layerId: string, sticker: StickerInstance, snapshot = false): void {
    this.updateLayer(layerId, l => ({
      ...l,
      stickers: l.stickers.map(s => s.id === sticker.id ? { ...sticker } : s)
    }), snapshot);
  }

  removeSticker(layerId: string, stickerId: string): void {
    this.updateLayer(layerId, l => ({
      ...l,
      stickers: l.stickers.filter(s => s.id !== stickerId)
    }));
  }

  // ── Legacy compatibility (used by map-container config load) ──

  createLayer(name: string): StickerLayer {
    const layer: StickerLayer = {
      id: this.generateId(),
      name,
      visible: true,
      opacity: 1.0,
      stickers: []
    };
    this.layersSubject.next([...this.layers, layer]);
    this.activeLayerIdSubject.next(layer.id);
    this.save();
    return layer;
  }

  deleteLayer(layerId: string): void {
    // Don't actually delete the last layer — just clear its stickers
    if (this.layers.length <= 1) {
      this.clearAllStickers(layerId);
      return;
    }
    const layers = this.layers.filter(l => l.id !== layerId);
    this.layersSubject.next(layers);
    this.activeLayerIdSubject.next(layers[0]?.id ?? null);
    this.save();
  }

  toggleLayerVisibility(layerId: string): void {
    this.updateLayer(layerId, l => ({ ...l, visible: !l.visible }));
  }

  renameLayer(layerId: string, name: string): void {
    this.updateLayer(layerId, l => ({ ...l, name }));
  }

  // ── Persistence ──────────────────────────────────────────

  /** Debounced save — coalesces rapid updates (e.g. during drag) into one write */
  save(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushSave();
    }, this.SAVE_DEBOUNCE_MS);
  }

  /** Immediately persist to localStorage (bypasses debounce) */
  saveImmediate(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.flushSave();
  }

  private flushSave(): void {
    try {
      const data = JSON.stringify(this.layers);
      localStorage.setItem(this.STORAGE_KEY, data);
    } catch (e) {
      console.warn('StickerLayerService: error saving', e);
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const validKeys = new Set(STICKER_CATALOG.map(s => s.key));
        const layers: StickerLayer[] = JSON.parse(raw).map((l: any) => ({
          ...l,
          opacity: l.opacity ?? 1.0,
          // Drop sticker instances referencing catalog keys that no longer exist
          stickers: (l.stickers ?? []).filter((s: any) => validKeys.has(s.stickerKey))
        }));
        this.layersSubject.next(layers);
        if (layers.length > 0) {
          this.activeLayerIdSubject.next(layers[0].id);
        }
        const keys = new Set<string>();
        layers.forEach(l => l.stickers.forEach(s => keys.add(s.stickerKey)));
        keys.forEach(k => this.loadImage(k).catch(() => {}));
      }
    } catch (e) {
      console.warn('StickerLayerService: error loading', e);
    }
  }

  // ── Undo / Redo ──────────────────────────────────────────

  /** Save current state to undo stack before a mutation */
  private pushUndoSnapshot(): void {
    const snapshot = JSON.parse(JSON.stringify(this.layers)) as StickerLayer[];
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
  }

  /** Undo the last sticker operation. Returns true if something was undone. */
  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const current = JSON.parse(JSON.stringify(this.layers)) as StickerLayer[];
    this.redoStack.push(current);
    const prev = this.undoStack.pop()!;
    this.layersSubject.next(prev);
    this.save();
    return true;
  }

  /** Redo the last undone operation. Returns true if something was redone. */
  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const current = JSON.parse(JSON.stringify(this.layers)) as StickerLayer[];
    this.undoStack.push(current);
    const next = this.redoStack.pop()!;
    this.layersSubject.next(next);
    this.save();
    return true;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  // ── Helpers ──────────────────────────────────────────────

  private updateLayer(layerId: string, fn: (l: StickerLayer) => StickerLayer, snapshot = true): void {
    if (snapshot) this.pushUndoSnapshot();
    const layers = this.layers.map(l => l.id === layerId ? fn(l) : l);
    this.layersSubject.next(layers);
    this.save();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
}
