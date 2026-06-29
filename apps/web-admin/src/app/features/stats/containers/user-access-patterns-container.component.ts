import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserAccessPatternsComponent } from '../user-access-patterns/user-access-patterns.component';

@Component({
  selector: 'app-user-access-patterns-container',
  standalone: true,
  imports: [CommonModule, UserAccessPatternsComponent],
  template: `
    <div class="container-wrapper">
      <app-user-access-patterns></app-user-access-patterns>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 20px;
      height: 100%;
      overflow: auto;
    }
  `]
})
export class UserAccessPatternsContainerComponent {}
