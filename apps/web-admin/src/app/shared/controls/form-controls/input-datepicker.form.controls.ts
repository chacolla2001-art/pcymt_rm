import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-date-picker',
  template: `
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>{{ label }}</mat-label>
      <input matInput [matDatepicker]="picker" (dateChange)="onDateChange($event)">
      <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
      <mat-datepicker #picker></mat-datepicker>
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
  imports: [MatDatepickerModule, MatInputModule, MatNativeDateModule, MatFormFieldModule],
})
export class FormDatePickerComponent {
  @Input() label = 'Choose a date';
  @Output() dateSelected = new EventEmitter<Date>();

  onDateChange(event: any): void {
    this.dateSelected.emit(event.value);
  }
}
