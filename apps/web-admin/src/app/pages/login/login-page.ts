import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthFormComponent } from '../../features/auth-form/components/auth-form.component';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.scss'],
  standalone: true,
  imports: [AuthFormComponent, MatButtonModule, MatIconModule],
})
export class LoginPageComponent {
}
