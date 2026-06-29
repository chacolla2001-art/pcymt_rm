import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-access-denied-page',
  standalone: true,
  templateUrl: './access-denied-page.html',
  styleUrls: ['./access-denied-page.scss'],
  imports: [MatButtonModule, MatIconModule, MatCardModule, TranslatePipe],
})
export class AccessDeniedPageComponent {
  private readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
