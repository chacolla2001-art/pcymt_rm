import { Injectable } from '@angular/core';
import { NgProgressRef } from 'ngx-progressbar';

@Injectable({ providedIn: 'root' })
export class ProgressBarService {
  private ref: NgProgressRef | null = null;
  private pendingStart = false;

  setRef(ref: NgProgressRef): void {
    this.ref = ref;
    if (this.pendingStart) {
      ref.start();
      this.pendingStart = false;
    }
  }

  start(): void {
    if (this.ref) {
      this.ref.start();
    } else {
      this.pendingStart = true;
    }
  }

  complete(): void {
    this.pendingStart = false;
    this.ref?.complete();
  }
}
