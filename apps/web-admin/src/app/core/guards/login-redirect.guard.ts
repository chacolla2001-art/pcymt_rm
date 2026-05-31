import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que redirige usuarios autenticados fuera de la página de login.
 * Si el usuario ya está autenticado, lo redirige a /main.
 */
export const LoginRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserAuthenticated()) {
    return router.createUrlTree(['/main']);
  }

  return true;
};
