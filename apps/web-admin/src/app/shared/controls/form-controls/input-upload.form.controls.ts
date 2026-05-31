import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-file-upload',
  template: `
    <div class="file-upload-container">
      <span class="upload-label">{{ label }}</span>
      <button mat-stroked-button type="button" (click)="fileInput.click()">
        <mat-icon>upload</mat-icon>
        {{ buttonText }}
      </button>
      <input type="file" #fileInput (change)="onFileSelected($event)" hidden [accept]="accept">
      @if (selectedFile) {
        <span class="file-name">{{ selectedFile.name }}</span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .file-upload-container {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .upload-label {
      font-size: 0.875rem;
      color: var(--sys-on-surface-variant);
    }
    .file-name {
      font-size: 0.875rem;
      color: var(--sys-on-surface);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule],
})
export class FormFileUploadComponent {
  @Input() label = 'Upload File';
  @Input() buttonText = 'Upload';
  @Input() accept = '*/*';
  @Output() fileSelected = new EventEmitter<File>();
  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files?.length) {
      this.selectedFile = input.files[0];
      this.fileSelected.emit(this.selectedFile);
    }
  }
}
