import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserInteractionStatsComponent } from '../user-interaction-stats/user-interaction-stats.component';

@Component({
  selector: 'app-user-interaction-stats-container',
  standalone: true,
  imports: [CommonModule, UserInteractionStatsComponent],
  template: `
    <div class="container-wrapper">
      <app-user-interaction-stats></app-user-interaction-stats>
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
export class UserInteractionStatsContainerComponent {}
