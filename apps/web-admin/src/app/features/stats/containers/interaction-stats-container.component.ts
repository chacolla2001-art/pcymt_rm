import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractionStatsComponent } from '../interaction-stats/interaction-stats.component';

@Component({
  selector: 'app-interaction-stats-container',
  standalone: true,
  imports: [CommonModule, InteractionStatsComponent],
  template: `
    <div class="container-wrapper">
      <app-interaction-stats></app-interaction-stats>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 20px;
      height: 100%;
      overflow: auto;
    }
  `]
})
export class InteractionStatsContainerComponent {}
