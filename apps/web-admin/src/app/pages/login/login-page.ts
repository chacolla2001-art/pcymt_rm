import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { resolveApiError } from '../../core/utils/api-error.util';

const REMEMBER_USER_KEY = 'rememberUser';
const SAVED_EMAIL_KEY = 'savedEmail';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
})
export class LoginPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  isLoading = false;
  loginError = '';
  passwordVisible = false;

  ngOnInit(): void {
    this.loadSavedEmail();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    const email = String(this.loginForm.value.email).trim().toLowerCase();
    const password = String(this.loginForm.value.password);
    const rememberMe = Boolean(this.loginForm.value.rememberMe);

    this.authService.login({ email, password }).pipe(
      finalize(() => { this.isLoading = false; }),
    ).subscribe({
      next: () => {
        this.persistRememberedEmail(email, rememberMe);
        void this.router.navigate(['/dashboard']);
      },
      error: (error: HttpErrorResponse) => {
        this.loginError = this.resolveLoginError(error);
      },
    });
  }

  private resolveLoginError(error: HttpErrorResponse): string {
    const resolved = resolveApiError(error, error.url ?? undefined);

    if (error.status === 403) {
      const body = error.error as ApiErrorResponse | null;
      return body?.message || 'Tu cuenta está inactiva. Contacta al administrador.';
    }

    return resolved.message;
  }

  private persistRememberedEmail(email: string, rememberMe: boolean): void {
    if (!this.isBrowser) return;

    if (rememberMe) {
      localStorage.setItem(REMEMBER_USER_KEY, 'true');
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_USER_KEY);
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }
  }

  private loadSavedEmail(): void {
    if (!this.isBrowser) return;
    if (localStorage.getItem(REMEMBER_USER_KEY) !== 'true') return;

    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    if (!savedEmail) return;

    this.loginForm.patchValue({ email: savedEmail, rememberMe: true });
  }
}
