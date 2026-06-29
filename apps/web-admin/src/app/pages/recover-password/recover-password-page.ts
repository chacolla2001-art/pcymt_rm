import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../features/users/services/user.service';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

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
    TranslatePipe,
  ],
})
export class RecoverPasswordPageComponent implements OnDestroy {
  recoverPasswordForm: FormGroup;
  isLoading = false;
  showSuccessMessage = false;
  canResend = true;
  countdown = 0;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly userService: UserService,
  ) {
    this.recoverPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (!this.recoverPasswordForm.valid || !this.canResend) {
      return;
    }

    this.isLoading = true;
    this.recoverPasswordForm.disable();

    const email = this.recoverPasswordForm.value.email;
    this.userService.recoverPassword(email).subscribe({
      next: () => this.onRequestFinished(),
      error: () => this.onRequestFinished(),
    });
  }

  private onRequestFinished(): void {
    this.isLoading = false;
    this.recoverPasswordForm.enable();
    this.showSuccessMessage = true;
    this.startCountdown();
  }

  private startCountdown(): void {
    this.canResend = false;
    this.countdown = 60;

    this.countdownInterval = setInterval(() => {
      this.countdown -= 1;
      if (this.countdown <= 0) {
        this.canResend = true;
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
