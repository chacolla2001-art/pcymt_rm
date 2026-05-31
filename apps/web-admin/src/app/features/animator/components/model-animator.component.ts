import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { VirtualAssetService } from '../../virtual-assets/services/virtual-asset.service';
import { VirtualAsset } from '../../virtual-assets/models/virtual-asset.model';
import { AnimationSequence, AnimationStep } from '../../virtual-assets/models/animation-sequence.model';
import { ApiRoutesService } from '../../../core/services/api-routes.service';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';

import { ThreeRendererService } from '../services/three-renderer.service';
import { AnimationSequenceService } from '../services/animation-sequence.service';
import {
  AnimatorState,
  TimelineBlock,
  ANIMATOR_CONSTANTS,
  THEME_CANVAS_COLORS,
} from '../models/animator.types';

@Component({
  selector: 'app-model-animator',
  templateUrl: './model-animator.component.html',
  styleUrls: ['./model-animator.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
  ],
  providers: [ThreeRendererService, AnimationSequenceService],
})
export class ModelAnimatorComponent implements OnInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainer!: ElementRef<HTMLElement>;

  readonly apiRoutes = inject(ApiRoutesService);
  readonly pixelPerSecond = ANIMATOR_CONSTANTS.PIXELS_PER_SECOND;

  virtualAssets: VirtualAsset[] = [];
  filteredAssets: VirtualAsset[] = [];
  animatorState: AnimatorState = 1;
  loadedModelId = '';
  selectedAnimationName = '';
  searchQuery = '';

  showModelsSidebar = true;
  showAnimationSidebar = false;
  showTimeline = false;
  isLoading = false;

  private readonly destroy$ = new Subject<void>();
  private readonly themeManager = inject(ThemeManagerService);

  constructor(
    private readonly virtualAssetService: VirtualAssetService,
    readonly renderer: ThreeRendererService,
    readonly sequenceService: AnimationSequenceService
  ) {}

  ngOnInit(): void {
    this.loadVirtualAssets();
    this.subscribeToRendererEvents();
    this.subscribeToSequenceEvents();
    this.subscribeToThemeChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.renderer.dispose();
  }

  // Getters
  get animationClips() {
    return this.renderer.clips;
  }

  get animationSequence() {
    return this.sequenceService.sequence;
  }

  get selectedTimelineBlock() {
    return this.sequenceService.selectedBlock;
  }

  get isPlaying() {
    return this.sequenceService.isPlaying;
  }

  get isPaused() {
    return this.sequenceService.isPaused;
  }

  get isCreateDisabled(): boolean {
    return this.animatorState === 3 || this.isPlaying;
  }

  get hasModelLoaded(): boolean {
    return this.animatorState >= 2;
  }

  get isEditingMode(): boolean {
    return this.animatorState === 3;
  }

  get currentAssetName(): string {
    const asset = this.virtualAssets.find(a => a.id === this.loadedModelId);
    return asset?.name || '';
  }

  // Data Loading

  private loadVirtualAssets(): void {
    this.isLoading = true;
    this.virtualAssetService
      .getAllVirtualAssets()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (assets) => {
          this.virtualAssets = assets.filter((a) => a.is_active);
          this.filteredAssets = [...this.virtualAssets];
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  private subscribeToRendererEvents(): void {
    this.renderer.animationFinished$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {});
  }

  private subscribeToSequenceEvents(): void {
    this.sequenceService.sequence$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sequence) => {
        this.showTimeline = sequence.length > 0 || this.animatorState === 3;
      });
  }

  private subscribeToThemeChanges(): void {
    // Aplicar tema inicial
    this.applyThemeToCanvas();

    // Escuchar cambios de tema
    this.themeManager.themeChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyThemeToCanvas();
      });
  }

  private applyThemeToCanvas(): void {
    const isDark = this.themeManager.isDarkMode();
    const color = isDark ? THEME_CANVAS_COLORS.dark : THEME_CANVAS_COLORS.light;
    this.renderer.setBackgroundColor(color);
  }

  // Type conversion helpers

  /** Convierte AnimationSequence a TimelineBlock[] para uso interno */
  private toTimelineBlocks(sequence: AnimationSequence | undefined): TimelineBlock[] {
    if (!sequence) return [];
    return sequence.map(step => ({
      clip: step.name,
      duration: step.duration
    }));
  }

  /** Convierte TimelineBlock[] a AnimationSequence para guardar en BD */
  private toAnimationSequence(blocks: TimelineBlock[]): AnimationSequence {
    return blocks.map(block => ({
      name: typeof block.clip === 'string' ? block.clip : `clip_${block.clip}`,
      duration: block.duration
    }));
  }

  // Model Selection

  filterAssets(): void {
    const searchTerm = this.searchQuery.toLowerCase().trim();
    this.filteredAssets = this.virtualAssets.filter((asset) =>
      asset.name.toLowerCase().includes(searchTerm)
    );
  }

  onAssetSelected(asset: VirtualAsset): void {
    const url = this.apiRoutes.getModelUrl(asset.model_url);
    this.loadAsset(url, asset.id);

    const existingSequence = this.toTimelineBlocks(asset.animation_sequence);
    this.sequenceService.setSequence(existingSequence);
    this.sequenceService.saveOriginalSequence();
    this.showAnimationSidebar = true;
  }

  private loadAsset(assetUrl: string, assetId: string): void {
    this.loadedModelId = assetId;
    this.animatorState = 2;
    this.selectedAnimationName = '';
    this.isLoading = true;

    this.renderer.initialize(this.canvasContainer.nativeElement);
    this.renderer.loadModel(assetUrl, assetId);

    this.virtualAssetService
      .getVirtualAssetById(assetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (asset) => {
          if (asset.animation_sequence && Array.isArray(asset.animation_sequence)) {
            this.sequenceService.setSequence(this.toTimelineBlocks(asset.animation_sequence));
            this.sequenceService.saveOriginalSequence();
            this.showTimeline = true;
          } else {
            this.sequenceService.clearSequence();
            this.showTimeline = false;
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  // Animation Controls

  onAnimationToggleClicked(clipName: string): void {
    this.selectedAnimationName = clipName;
    if (this.animatorState === 3) {
      this.sequenceService.addClip(clipName);
    } else {
      this.renderer.playAnimation(clipName);
    }
  }

  startCreatingSequence(): void {
    this.sequenceService.stop();
    this.showTimeline = true;
    this.animatorState = 3;
    this.selectedAnimationName = '';
  }

  cancelEditingSequence(): void {
    this.sequenceService.stop();
    this.sequenceService.restoreOriginalSequence();
    this.sequenceService.selectBlock(null);
    this.animatorState = 2;
    this.selectedAnimationName = '';
    this.showTimeline = this.animationSequence.length > 0;
  }

  saveAnimationSequence(): void {
    if (!this.loadedModelId) return;

    this.virtualAssetService
      .updateAnimationSequence(this.loadedModelId, this.toAnimationSequence(this.animationSequence))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sequenceService.saveOriginalSequence();
          this.animatorState = 2;
          this.showTimeline = true;
          this.sequenceService.selectBlock(null);
          this.selectedAnimationName = '';
        },
        error: () => {},
      });
  }

  // Playback

  playSequence(): void {
    this.sequenceService.playSequence();
  }

  pauseSequence(): void {
    this.sequenceService.pause();
  }

  resumeSequence(): void {
    this.sequenceService.resume();
  }

  stopSequence(): void {
    this.sequenceService.stop();
  }

  // Timeline

  /** Selecciona un bloque del timeline */
  selectTimelineBlock(block: TimelineBlock): void {
    if (this.animatorState !== 3) return;
    this.sequenceService.selectBlock(block);
  }

  /** Elimina el bloque seleccionado */
  deleteSelectedBlock(): void {
    this.sequenceService.deleteSelectedBlock();
  }

  /** Inicia el redimensionamiento de un bloque */
  startResize(
    event: MouseEvent,
    block: TimelineBlock,
    direction: 'left' | 'right'
  ): void {
    if (this.animatorState !== 3) return;

    event.preventDefault();
    event.stopPropagation();

    const initialX = event.clientX;
    const initialDuration = block.duration;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - initialX;
      const deltaSeconds = deltaX / this.pixelPerSecond;

      let newDuration = initialDuration;
      if (direction === 'right') {
        newDuration = initialDuration + deltaSeconds;
      } else {
        newDuration = initialDuration - deltaSeconds;
      }

      this.sequenceService.updateBlockDuration(block, newDuration);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Sidebar Controls

  toggleModelsSidebar(): void {
    this.showModelsSidebar = !this.showModelsSidebar;
  }

  toggleAnimationSidebar(): void {
    this.showAnimationSidebar = !this.showAnimationSidebar;
  }

  // Helper Methods

  /** Gets the clip name from a timeline block (handles both index and name) */
  getClipName(block: TimelineBlock): string {
    if (typeof block.clip === 'string') {
      return block.clip;
    }
    // block.clip is a number (index)
    const clip = this.animationClips[block.clip];
    return clip?.name ?? `Clip ${block.clip}`;
  }
}
