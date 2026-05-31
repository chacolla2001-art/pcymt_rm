import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { AlertComponent, AlertType, AlertData } from '../../shared/controls/alert-controls/alert-control';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) {}

  showAlert(
    message: string,
    type: AlertType,
    duration: number = 5000,
    showProgress: boolean = true
  ): MatSnackBarRef<AlertComponent> {
    const alertData: AlertData = { 
      message, 
      type, 
      duration,
      showProgress 
    };

    const config: MatSnackBarConfig = {
      data: alertData,
      duration,
      panelClass: ['alert-snackbar', type],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    };

    return this.snackBar.openFromComponent(AlertComponent, config);
  }

  showSuccess(message: string, duration: number = 5000): MatSnackBarRef<AlertComponent> {
    return this.showAlert(message, 'success', duration);
  }

  showWarning(message: string, duration: number = 5000): MatSnackBarRef<AlertComponent> {
    return this.showAlert(message, 'warning', duration);
  }

  showError(message: string, duration: number = 5000): MatSnackBarRef<AlertComponent> {
    return this.showAlert(message, 'error', duration);
  }

  showInfo(message: string, duration: number = 5000): MatSnackBarRef<AlertComponent> {
    return this.showAlert(message, 'info', duration);
  }
}
