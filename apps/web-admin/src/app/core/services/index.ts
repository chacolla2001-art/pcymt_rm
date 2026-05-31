/**
 * Barrel export for core services
 *
 * Core services are application-wide utilities that are not feature-specific.
 * Feature-specific services have been moved to their respective feature modules.
 *
 * Usage: import { AlertService, AuthService } from '@core/services';
 */

export { AlertService } from './alert.service';
export { ApiRoutesService } from './api-routes.service';
export { AuthService } from './auth.service';
export { DrawerService } from './drawer.service';
export { LoggerService } from './logger.service';
export { ThemeManagerService } from './theme-manager.service';

// Feature-specific services have been moved:
// - UserService → features/users/services/
// - AnchorPointService → features/anchor-points/services/
// - VirtualAssetService → features/virtual-assets/services/
// - DashboardService, AnalyticsService, UserSessionService, UserInteractionService → features/dashboard/services/
