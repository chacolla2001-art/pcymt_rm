import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Servicio del Dashboard
 * Maneja la navegación y eventos del dashboard principal
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly showMainDashboardSubject = new Subject<void>();

  /** Observable para suscribirse a eventos de mostrar dashboard */
  readonly showMainDashboard$ = this.showMainDashboardSubject.asObservable();

  /** Emite evento para mostrar el dashboard principal */
  openMainDashboard(): void {
    this.showMainDashboardSubject.next();
  }
}
