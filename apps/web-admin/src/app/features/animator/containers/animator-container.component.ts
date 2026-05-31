import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelAnimatorComponent } from '../components/model-animator.component';

/**
 * SMART CONTAINER for 3D Animator Feature
 *
 * Responsibilities:
 * - Manages animation state
 * - Coordinates 3D rendering
 * - Handles timeline controls
 */
@Component({
  selector: 'app-animator-container',
  standalone: true,
  imports: [CommonModule, ModelAnimatorComponent],
  template: `
    <div class="container-wrapper">
      <app-model-animator></app-model-animator>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 0;
      height: 100%;
      width: 100%;
    }
  `]
})
export class AnimatorContainerComponent {
  constructor() {
    // Component initialized via routing
  }
}
