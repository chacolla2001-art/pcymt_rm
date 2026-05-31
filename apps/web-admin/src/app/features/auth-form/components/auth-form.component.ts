import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApiErrorResponse, API_ERROR_CODES } from '../../../core/models/api-response.model';

@Component({
  selector: 'auth-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule
  ],
  templateUrl: './auth-form.component.html',
  styleUrls: ['./auth-form.component.css']
})
export class AuthFormComponent {
  private readonly logger = inject(LoggerService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly REMEMBER_USER_KEY = 'rememberUser';
  private readonly SAVED_EMAIL_KEY = 'savedEmail';

  loginForm: FormGroup;
  isLoading = false;
  loginError = '';
  passwordVisible = false;

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    this.loadSavedCredentials();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.logger.warn('Intento de login con formulario inválido', 'AuthForm', {
        errors: this.getFormErrors(),
      });
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    const { email, password, rememberMe } = this.loginForm.value;

    this.logger.debug('Enviando credenciales', 'AuthForm', { email });

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.saveCredentials(email, rememberMe);
        this.logger.info('Login exitoso, redirigiendo a dashboard', 'AuthForm');
        this.router.navigate(['/dashboard']);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.loginError = this.getErrorMessage(error);
        this.logger.error('Error en login', 'AuthForm', {
          status: error.status,
          message: this.loginError,
        });
      }
    });
  }

  /**
   * Obtiene mensaje de error amigable según el tipo de error
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    const errorBody = error.error as ApiErrorResponse | null;

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    }

    if (error.status === 401) {
      return errorBody?.message || 'Credenciales incorrectas. Verifica tu email y contraseña.';
    }

    if (error.status === 403) {
      return errorBody?.message || 'Tu cuenta está inactiva. Contacta al administrador.';
    }

    if (error.status === 429) {
      return 'Has excedido el límite de intentos. Espera unos minutos e intenta nuevamente.';
    }

    if (errorBody?.code === API_ERROR_CODES.VALIDATION_ERROR) {
      return 'Por favor verifica los datos ingresados.';
    }

    return errorBody?.message || 'Error de inicio de sesión. Intenta nuevamente.';
  }

  /**
   * Obtiene errores del formulario para logging
   */
  private getFormErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      if (control?.errors) {
        errors[key] = Object.keys(control.errors);
      }
    });

    return errors;
  }

  /**
   * Guarda o elimina las credenciales según la preferencia del usuario
   */
  private saveCredentials(email: string, rememberMe: boolean): void {
    if (!this.isBrowser) return;

    if (rememberMe) {
      localStorage.setItem(this.REMEMBER_USER_KEY, 'true');
      localStorage.setItem(this.SAVED_EMAIL_KEY, email);
      this.logger.debug('Credenciales guardadas', 'AuthForm');
    } else {
      localStorage.removeItem(this.REMEMBER_USER_KEY);
      localStorage.removeItem(this.SAVED_EMAIL_KEY);
      this.logger.debug('Credenciales eliminadas', 'AuthForm');
    }
  }

  /**
   * Carga las credenciales guardadas si el usuario eligió recordar
   */
  private loadSavedCredentials(): void {
    if (!this.isBrowser) return;

    const rememberUser = localStorage.getItem(this.REMEMBER_USER_KEY) === 'true';
    const savedEmail = localStorage.getItem(this.SAVED_EMAIL_KEY);

    if (rememberUser && savedEmail) {
      this.loginForm.patchValue({
        email: savedEmail,
        rememberMe: true
      });
      this.logger.debug('Credenciales cargadas', 'AuthForm', { email: savedEmail });
    }
  }
}
