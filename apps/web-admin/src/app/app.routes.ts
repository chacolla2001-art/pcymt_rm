import { Routes } from '@angular/router';
import { LoginRedirectGuard } from './core/guards/login-redirect.guard';
import { AuthGuard } from './core/guards/auth.guard';

/**
 * RESTRUCTURED ROUTES - Angular Best Practices
 *
 * Changes from old structure:
 * 1. MainLayoutComponent now wraps all authenticated routes
 * 2. Each feature has its own route with lazy loading
 * 3. No more view toggles in BodyComponent
 * 4. Proper containers handle business logic
 * 5. Clean separation of concerns
 */
export const routes: Routes = [
  // Auth routes (no layout)
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page').then(m => m.LoginPageComponent),
    canActivate: [LoginRedirectGuard]
  },
  {
    path: 'recover-password',
    loadComponent: () => import('./pages/recover-password/recover-password-page').then(m => m.RecoverPasswordPageComponent)
  },

  // Main application routes (with layout)
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/containers/dashboard-container.component').then(m => m.DashboardContainerComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/containers/users-container.component').then(m => m.UsersContainerComponent),
        data: { title: 'Gestión de Usuarios' }
      },
      {
        path: 'anchor-points',
        loadComponent: () => import('./features/anchor-points/containers/anchor-points-container.component').then(m => m.AnchorPointsContainerComponent),
        data: { title: 'Puntos de Anclaje' }
      },
      {
        path: 'virtual-assets',
        loadComponent: () => import('./features/virtual-assets/containers/assets-container.component').then(m => m.AssetsContainerComponent),
        data: { title: 'Contenido 3D' }
      },
      {
        path: 'map',
        loadComponent: () => import('./features/map/containers/map-container.component').then(m => m.MapContainerComponent),
        data: { title: 'Mapa del Parque' }
      },
      {
        path: 'animator',
        loadComponent: () => import('./features/animator/containers/animator-container.component').then(m => m.AnimatorContainerComponent),
        data: { title: 'Animador 3D' }
      },
      // — Estadísticas —
      {
        path: 'stats/session-history',
        loadComponent: () => import('./features/stats/containers/session-history-container.component').then(m => m.SessionHistoryContainerComponent),
        data: { title: 'Historial de Accesos' }
      },
      {
        path: 'stats/interaction-stats',
        loadComponent: () => import('./features/stats/containers/interaction-stats-container.component').then(m => m.InteractionStatsContainerComponent),
        data: { title: 'Interacciones por Animal' }
      },
      {
        path: 'stats/zone-visits',
        loadComponent: () => import('./features/stats/containers/zone-visits-container.component').then(m => m.ZoneVisitsContainerComponent),
        data: { title: 'Visitas por Zona' }
      },
      // — Estadísticas por Usuario —
      {
        path: 'stats/user-interactions',
        loadComponent: () => import('./features/stats/containers/user-interaction-stats-container.component').then(m => m.UserInteractionStatsContainerComponent),
        data: { title: 'Interacciones por Usuario' }
      },
      {
        path: 'stats/user-access',
        loadComponent: () => import('./features/stats/containers/user-access-patterns-container.component').then(m => m.UserAccessPatternsContainerComponent),
        data: { title: 'Accesos por Usuario' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/containers/settings-container.component').then(m => m.SettingsContainerComponent),
        data: { title: 'Configuración' }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'login'
  }
];
