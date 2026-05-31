import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mensaje-hint',
  standalone: true,
  imports: [MatIconModule, MatCardModule,CommonModule],
  template: `
    <mat-card [ngClass]="messageClass" class="mensaje-hint">
      <mat-icon>{{ icon }}</mat-icon>
      <span>{{ mensaje }}</span>
    </mat-card>
  `,
  styles: [`
    .mensaje-hint {
      display: flex;
      align-items: center;
      padding: 8px;
      margin: 8px 0;
      font-size: 16px;
      border-radius: 4px;
    }
    .error { background-color: #f8d7da; color: #721c24; }
    .warning { background-color: #fff3cd; color: #856404; }
    .success { background-color: #d4edda; color: #155724; }
    .info { background-color: #d1ecf1; color: #0c5460; }
    mat-icon { margin-right: 8px; }
  `]
})
export class MensajeHintComponent {
  @Input() tipo: 'error' | 'warning' | 'success' | 'info' = 'info';
  @Input() mensaje: string = '';

  get icon(): string {
    switch (this.tipo) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'check_circle';
      default:
        return 'info';
    }
  }

  get messageClass(): string {
    return this.tipo;
  }
}
