/**
 * Servicio para manejar operaciones de datos de la tabla
 * Separa la lógica de negocio del componente de presentación
 */

import { Injectable, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UserService } from '../../../features/users/services/user.service';
import { AnchorPointService } from '../../../features/anchor-points/services/anchor-point.service';
import { VirtualAssetService } from '../../../features/virtual-assets/services/virtual-asset.service';
import { AlertService } from '../../../core/services/alert.service';

import { User } from '../../../core/models/user.model';
import { AnchorPoint, ParkSection } from '../../../core/models/anchor-point.model';
import { VirtualAsset } from '../../../core/models/virtual-asset.model';
import { TableDataType, TableElement, StatusFilter } from './table-types';

@Injectable({ providedIn: 'root' })
export class TableDataHandlerService {

  private userService = inject(UserService);
  private anchorPointService = inject(AnchorPointService);
  private virtualAssetService = inject(VirtualAssetService);
  private alertService = inject(AlertService);

  /**
   * Carga datos según el tipo especificado
   */
  loadData(type: TableDataType): Observable<TableElement[]> {
    switch (type) {
      case 'users':
        return this.userService.getAllUsers().pipe(
          map(users => this.sortByUpdated(users))
        );

      case 'anchorPoints':
        return this.anchorPointService.getAllAnchorPoints().pipe(
          map(anchors => this.sortByUpdated(anchors))
        );

      case 'virtualAssets':
        return this.virtualAssetService.getAllVirtualAssets().pipe(
          map(assets => this.sortByUpdated(assets))
        );
    }
  }

  /**
   * Ordena elementos por fecha de actualización (más reciente primero)
   */
  private sortByUpdated<T extends { updated_at?: Date | string; updatedAt?: Date | string }>(
    items: T[]
  ): T[] {
    return items.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.updatedAt || '').getTime();
      const dateB = new Date(b.updated_at || b.updatedAt || '').getTime();
      return dateB - dateA;
    });
  }

  /**
   * Crea un predicado de filtro para la tabla
   */
  createFilterPredicate(
    type: TableDataType,
    statusFilter: StatusFilter
  ): (data: TableElement, filter: string) => boolean {
    return (data: TableElement, filter: string) => {
      const searchText = filter.trim().toLowerCase();

      // Filtro de estado
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'active' && this.isActive(data)) ||
        (statusFilter === 'inactive' && !this.isActive(data));

      // Campos de búsqueda según el tipo
      const fieldsToSearch = this.getSearchFields(type);

      // Búsqueda de texto
      const textMatch = fieldsToSearch.some(field => {
        const value = (data as Record<string, unknown>)[field];
        return (value || '').toString().toLowerCase().includes(searchText);
      });

      return statusMatch && textMatch;
    };
  }

  /**
   * Determina si un elemento está activo
   */
  private isActive(data: TableElement): boolean {
    if ('is_active' in data) {
      return data.is_active === true;
    }
    if ('active' in data) {
      return data.active === true;
    }
    return false;
  }

  /**
   * Obtiene los campos de búsqueda según el tipo
   */
  private getSearchFields(type: TableDataType): string[] {
    switch (type) {
      case 'users':
        return ['username', 'email'];
      case 'anchorPoints':
      case 'virtualAssets':
        return ['name', 'description'];
    }
  }

  /**
   * Crea un nuevo usuario
   */
  createUser(formData: FormData): Observable<unknown> {
    return this.userService.createUser(formData);
  }

  /**
   * Actualiza un usuario existente
   */
  updateUser(id: string, userData: Partial<User>): Observable<unknown> {
    const formData = new FormData();
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    return this.userService.updateUser(id, formData);
  }

  /**
   * Cambia el estado activo de un usuario
   */
  toggleUserActive(userId: string, isActive: boolean): Observable<unknown> {
    return this.userService.toggleUserActive(userId, isActive);
  }

  /**
   * Crea un nuevo punto de anclaje
   */
  createAnchorPoint(anchorData: AnchorPoint): Observable<unknown> {
    return this.anchorPointService.createAnchorPoint(anchorData);
  }

  /**
   * Actualiza un punto de anclaje existente
   */
  updateAnchorPoint(id: string, anchorData: AnchorPoint): Observable<unknown> {
    return this.anchorPointService.updateAnchorPoint(id, anchorData);
  }

  /**
   * Crea un nuevo activo virtual
   */
  createVirtualAsset(formData: FormData): Observable<unknown> {
    return this.virtualAssetService.createVirtualAsset(formData);
  }

  /**
   * Actualiza un activo virtual existente
   */
  updateVirtualAsset(id: string, formData: FormData): Observable<unknown> {
    return this.virtualAssetService.updateVirtualAsset(id, formData);
  }

  /**
   * Actualiza el modelo asociado a un punto de anclaje
   */
  updateAnchorVirtualAsset(
    anchor: AnchorPoint,
    newAssetId: string
  ): Observable<unknown> {
    const updated = { ...anchor, virtualAssetId: newAssetId };
    return this.anchorPointService.updateAnchorPoint(anchor.id, updated);
  }

  /**
   * Muestra una alerta de éxito
   */
  showSuccess(message: string): void {
    this.alertService.showAlert(message, 'success', 2000);
  }

  /**
   * Muestra una alerta de error
   */
  showError(message: string): void {
    this.alertService.showAlert(message, 'error', 2000);
  }
}
