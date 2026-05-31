import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsComponent } from '../components/settings.component';

@Component({
  selector: 'app-settings-container',
  standalone: true,
  imports: [CommonModule, SettingsComponent],
  template: `
    <div class="container-wrapper">
      <app-settings></app-settings>
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
export class SettingsContainerComponent {}
