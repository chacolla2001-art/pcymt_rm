import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeManagerService } from '../../core/services/theme-manager.service';
import { UserService } from '../../features/users/services/user.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-recover-password-page',
  standalone: true,
  templateUrl: './recover-password-page.html',
  styleUrls: ['./recover-password-page.scss'],
  imports: [
    RouterLink,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
  ],
})
export class RecoverPasswordPageComponent implements OnDestroy {
  recoverPasswordForm: FormGroup;
  isLoading = false;
  showSuccessMessage = false;
  canResend = true;
  countdown = 0;
  private countdownInterval: any;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router,
    private userService: UserService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private themeService: ThemeManagerService,
    private alertService: AlertService
  ) {
    this.recoverPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get email() {
    return this.recoverPasswordForm.get('email');
  }

  onSubmit(): void {
    if (this.recoverPasswordForm.valid && this.canResend) {
      this.isLoading = true;
      this.recoverPasswordForm.disable();

      const email = this.recoverPasswordForm.value.email;
      this.userService.recoverPassword(email).subscribe({
        next: () => {
          this.isLoading = false;
          this.recoverPasswordForm.enable();
          this.showSuccessMessage = true;
          this.startCountdown();
        },
        error: () => {
          this.isLoading = false;
          this.recoverPasswordForm.enable();
          this.showSuccessMessage = true;
          this.startCountdown();
        },
      });
    }
  }

  private startCountdown(): void {
    this.canResend = false;
    this.countdown = 60;

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.canResend = true;
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
