import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  TimelineBlock,
  AnimatorState,
  ANIMATOR_CONSTANTS,
} from '../models/animator.types';
import { ThreeRendererService } from './three-renderer.service';

/**
 * Servicio para gestión de la secuencia de animación (timeline)
 */
@Injectable()
export class AnimationSequenceService {
  private readonly sequenceSubject = new BehaviorSubject<TimelineBlock[]>([]);
  private readonly originalSequenceSubject = new BehaviorSubject<TimelineBlock[]>([]);
  private readonly selectedBlockSubject = new BehaviorSubject<TimelineBlock | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly isPausedSubject = new BehaviorSubject<boolean>(false);

  private playResolve: (() => void) | null = null;
  private shouldStop = false;

  /** Secuencia actual de animación */
  readonly sequence$ = this.sequenceSubject.asObservable();

  /** Bloque seleccionado en el timeline */
  readonly selectedBlock$ = this.selectedBlockSubject.asObservable();

  /** Estado de reproducción */
  readonly isPlaying$ = this.isPlayingSubject.asObservable();

  /** Estado de pausa */
  readonly isPaused$ = this.isPausedSubject.asObservable();

  constructor(private readonly renderer: ThreeRendererService) {}

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get sequence(): TimelineBlock[] {
    return this.sequenceSubject.value;
  }

  get selectedBlock(): TimelineBlock | null {
    return this.selectedBlockSubject.value;
  }

  get isPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  get isPaused(): boolean {
    return this.isPausedSubject.value;
  }

  get hasAnimations(): boolean {
    return this.sequence.length > 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTIÓN DE SECUENCIA
  // ═══════════════════════════════════════════════════════════════

  /** Establece la secuencia de animación */
  setSequence(blocks: TimelineBlock[]): void {
    this.sequenceSubject.next([...blocks]);
  }

  /** Guarda la secuencia original (para cancelar edición) */
  saveOriginalSequence(): void {
    this.originalSequenceSubject.next([...this.sequence]);
  }

  /** Restaura la secuencia original */
  restoreOriginalSequence(): void {
    const original = this.originalSequenceSubject.value;
    // Convertir nombres a índices si es necesario
    const restored = original.map((block) => ({
      clip: typeof block.clip === 'string'
        ? this.renderer.getClipIndex(block.clip)
        : block.clip,
      duration: block.duration,
    }));
    this.sequenceSubject.next(restored);
  }

  /** Limpia la secuencia */
  clearSequence(): void {
    this.sequenceSubject.next([]);
    this.originalSequenceSubject.next([]);
    this.selectedBlockSubject.next(null);
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTIÓN DE BLOQUES
  // ═══════════════════════════════════════════════════════════════

  /** Agrega un clip al timeline */
  addClip(clipName: string): void {
    const index = this.renderer.getClipIndex(clipName);
    if (index === -1) return;

    const newBlock: TimelineBlock = {
      clip: index,
      duration: ANIMATOR_CONSTANTS.DEFAULT_BLOCK_DURATION,
    };

    this.sequenceSubject.next([...this.sequence, newBlock]);
  }

  /** Selecciona un bloque */
  selectBlock(block: TimelineBlock | null): void {
    this.selectedBlockSubject.next(block);
  }

  /** Elimina el bloque seleccionado */
  deleteSelectedBlock(): void {
    const selected = this.selectedBlock;
    if (!selected) return;

    const index = this.sequence.indexOf(selected);
    if (index !== -1) {
      const newSequence = [...this.sequence];
      newSequence.splice(index, 1);
      this.sequenceSubject.next(newSequence);
      this.selectedBlockSubject.next(null);
    }
  }

  /** Actualiza la duración de un bloque */
  updateBlockDuration(block: TimelineBlock, duration: number): void {
    block.duration = Math.max(ANIMATOR_CONSTANTS.MIN_BLOCK_DURATION, duration);
    // Trigger update
    this.sequenceSubject.next([...this.sequence]);
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTROL DE REPRODUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  /** Reproduce la secuencia completa */
  async playSequence(): Promise<void> {
    const mixer = this.renderer.currentMixer;
    if (!mixer || this.sequence.length === 0) return;

    this.isPlayingSubject.next(true);
    this.isPausedSubject.next(false);
    this.shouldStop = false;

    for (const block of this.sequence) {
      if (this.shouldStop) break;

      // Obtener índice del clip
      const clipIndex = typeof block.clip === 'number'
        ? block.clip
        : this.renderer.getClipIndex(block.clip);

      const action = this.renderer.playAnimationByIndex(clipIndex);
      if (!action) continue;

      // Esperar la duración del bloque
      const startTime = performance.now();
      while (performance.now() - startTime < block.duration * 1000) {
        if (this.shouldStop) {
          action.stop();
          break;
        }

        if (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.playResolve = resolve;
          });
        }

        await this.sleep(ANIMATOR_CONSTANTS.PLAYBACK_INTERVAL_MS);
      }

      action.stop();
    }

    this.isPlayingSubject.next(false);
    this.isPausedSubject.next(false);
  }

  /** Pausa la reproducción */
  pause(): void {
    this.isPausedSubject.next(true);
  }

  /** Reanuda la reproducción */
  resume(): void {
    this.isPausedSubject.next(false);
    if (this.playResolve) {
      this.playResolve();
      this.playResolve = null;
    }
  }

  /** Detiene la reproducción */
  stop(): void {
    this.shouldStop = true;
    this.isPlayingSubject.next(false);
    this.isPausedSubject.next(false);
    this.renderer.stopCurrentAction();
  }

  /** Helper para esperar */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
