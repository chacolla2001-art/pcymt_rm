import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que restringe el panel web a roles staff (admin / moderator).
 */
export const StaffGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isUserAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (authService.isStaffUser()) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
