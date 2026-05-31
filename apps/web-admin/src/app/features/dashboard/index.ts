/**
 * Barrel export for Dashboard Feature Module (RESTRUCTURED)
 */

// Container (Smart Component)
export { DashboardContainerComponent } from './containers/dashboard-container.component';

// Components (Presentation)
export { DashboardComponent } from './components/dashboard.component';

// Services
export { AnalyticsService } from './services/analytics.service';
export { DashboardService } from './services/dashboard.service';
export { DashboardMetricsService } from './services/dashboard-metrics.service';
export { UserSessionService } from './services/user-session.service';
export { UserInteractionService } from './services/user-interaction.service';

// Models
export { UserSession } from './models/user-session.model';
export { UserInteraction } from './models/user-interaction.model';
