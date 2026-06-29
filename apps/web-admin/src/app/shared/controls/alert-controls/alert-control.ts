import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface AlertData {
  message: string;
  type: AlertType;
  duration?: number;
  showProgress?: boolean;
}

interface AlertConfig {
  icon: string;
  title: string;
  colorClass: string;
}

@Component({
  selector: 'app-alert',
  templateUrl: './alert-control.html',
  styleUrls: ['./alert-control.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressBarModule],
})
export class AlertComponent implements OnInit, OnDestroy {
  progress = 100;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  
  private readonly alertConfigs: Record<AlertType, AlertConfig> = {
    success: {
      icon: 'check_circle',
      title: 'Éxito',
      colorClass: 'alert-success'
    },
    warning: {
      icon: 'warning',
      title: 'Advertencia',
      colorClass: 'alert-warning'
    },
    error: {
      icon: 'error',
      title: 'Error',
      colorClass: 'alert-error'
    },
    info: {
      icon: 'info',
      title: 'Información',
      colorClass: 'alert-info'
    }
  };

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: AlertData,
    private snackBarRef: MatSnackBarRef<AlertComponent>
  ) {}

  ngOnInit(): void {
    if (this.data.showProgress !== false && this.data.duration) {
      this.startProgressBar();
    }
  }

  ngOnDestroy(): void {
    this.clearProgress();
  }

  private startProgressBar(): void {
    const duration = this.data.duration || 5000;
    const interval = 50;
    const decrement = (100 * interval) / duration;

    this.progressInterval = setInterval(() => {
      this.progress -= decrement;
      if (this.progress <= 0) {
        this.clearProgress();
      }
    }, interval);
  }

  private clearProgress(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  close(): void {
    this.snackBarRef.dismiss();
  }

  get config(): AlertConfig {
    return this.alertConfigs[this.data.type] || this.alertConfigs.info;
  }

  get icon(): string {
    return this.config.icon;
  }

  get title(): string {
    return this.config.title;
  }

  get colorClass(): string {
    return this.config.colorClass;
  }
}
