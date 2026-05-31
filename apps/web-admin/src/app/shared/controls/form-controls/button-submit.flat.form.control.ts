import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'button-form',
  template: `
    <button mat-flat-button [disabled]="disabled" (click)="onClick()">
      @if (icon) {
        <mat-icon>{{ icon }}</mat-icon>
      }
      {{ buttonText }}
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `],
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormButtonComponent {
  @Input() buttonText = 'Submit';
  @Input() icon?: string;
  @Input() disabled = false;
  @Output() buttonClick = new EventEmitter<void>();

  onClick() {
    this.buttonClick.emit();
  }
}
