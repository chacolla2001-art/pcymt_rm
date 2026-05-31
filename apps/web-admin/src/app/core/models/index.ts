/**
 * Barrel export for core models
 *
 * Core models are application-wide types that are not feature-specific.
 * Feature-specific models have been moved to their respective feature modules.
 *
 * Usage: import { ApiResponse } from '@core/models';
 */

export { ApiResponse } from './api-response.model';

// Feature-specific models have been moved:
// - User → features/users/models/
// - AnchorPoint, ParkSection → features/anchor-points/models/
// - VirtualAsset, VirtualAssetDTO → features/virtual-assets/models/
// - UserSession, UserInteraction → features/dashboard/models/
