import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppShellLoadService } from '../../../core/services/app-shell-load.service';

@Component({
  selector: 'app-shell-load-overlay',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  templateUrl: './shell-load-overlay.component.html',
  styleUrl: './shell-load-overlay.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ShellLoadOverlayComponent {
  readonly shellLoad = inject(AppShellLoadService);
}
