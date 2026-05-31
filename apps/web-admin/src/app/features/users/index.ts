/**
 * Barrel export for Users Feature Module
 *
 * This follows the new architecture where each feature is self-contained
 * with its own services, models, and components.
 */

// Container (Smart Component - handles routing)
export { UsersContainerComponent } from './containers/users-container.component';

// Components (Dumb Components - presentation only)
export { UserTableComponent } from './components/user-table/user-table.component';

// Services (Feature-specific)
export { UserService } from './services/user.service';

// Models (Feature-specific)
export { User } from './models/user.model';
