import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionHistoryComponent } from '../session-history/session-history.component';

@Component({
  selector: 'app-session-history-container',
  standalone: true,
  imports: [CommonModule, SessionHistoryComponent],
  template: `
    <div class="container-wrapper">
      <app-session-history></app-session-history>
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
export class SessionHistoryContainerComponent {}
