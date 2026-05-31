import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

@Component({
  selector: 'select-form',
  template: `
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>{{ label }}</mat-label>
      <mat-select (selectionChange)="onSelectionChange($event.value)">
        @for (option of options; track option.value) {
          <mat-option [value]="option.value">{{ option.viewValue }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: [`
    :host {
      display: block;
    }
    .full-width {
      width: 100%;
    }
  `],
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatOptionModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormSelectComponent {
  @Input() label = 'Select an option';
  @Input() options: { value: string; viewValue: string }[] = [];
  @Output() selectionChange = new EventEmitter<string>();

  onSelectionChange(value: string) {
    this.selectionChange.emit(value);
  }
}
