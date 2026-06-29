import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZoneVisitsComponent } from '../zone-visits/zone-visits.component';

@Component({
  selector: 'app-zone-visits-container',
  standalone: true,
  imports: [CommonModule, ZoneVisitsComponent],
  template: `
    <div class="container-wrapper">
      <app-zone-visits></app-zone-visits>
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
export class ZoneVisitsContainerComponent {}
