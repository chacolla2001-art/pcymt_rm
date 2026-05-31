import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from '../components/dashboard.component';

/**
 * SMART CONTAINER for Dashboard Feature
 *
 * Responsibilities:
 * - Fetches dashboard analytics data
 * - Manages dashboard state
 * - Coordinates multiple data sources
 *
 * The actual DashboardComponent becomes a PRESENTATION component
 * that receives data via @Input() if needed.
 *
 * For now, DashboardComponent still has its own data fetching,
 * but this container provides a place to centralize that logic
 * in the future.
 */
@Component({
  selector: 'app-dashboard-container',
  standalone: true,
  imports: [CommonModule, DashboardComponent],
  template: `
    <div class="container-wrapper">
      <app-dashboard></app-dashboard>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 20px;
      height: 100%;
      overflow: auto;
    }
  `]
})export class DashboardContainerComponent {
  constructor() {
    // Component initialized via routing
  }

  /**
   * Future: Move data fetching logic from DashboardComponent here
   * and pass data down via @Input() properties
   */
}
