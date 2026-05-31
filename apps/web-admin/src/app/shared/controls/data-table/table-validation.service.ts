/**
 * Servicio para manejar validaciones de usuarios
 * Separa la lógica de validación del componente principal
 */

import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../features/users/services/user.service';
import { AlertService } from '../../../core/services/alert.service';

@Injectable({ providedIn: 'root' })
export class TableValidationService {
  
  constructor(
    private userService: UserService,
    private alertService: AlertService
  ) {}

  /**
   * Verifica si un documento ya existe (para crear)
   */
  async checkDocumentExists(documentNumber: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.userService.checkDocumentExists(documentNumber)
      );
      if (result?.exists) {
        this.alertService.showAlert(
          'El número de documento ya está registrado.',
          'error',
          2000
        );
        return false;
      }
      return true;
    } catch (error) {
      return true; // Continuar si hay error en la validación
    }
  }

  /**
   * Verifica si un email ya existe (para crear)
   */
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.userService.checkEmailExists(email)
      );
      if (result?.exists) {
        this.alertService.showAlert(
          'El correo electrónico ya está registrado.',
          'error',
          2000
        );
        return false;
      }
      return true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Verifica si un username ya existe (para crear)
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.userService.checkUsernameExists(username)
      );
      if (result?.exists) {
        this.alertService.showAlert(
          'El nombre de usuario ya está registrado.',
          'error',
          2000
        );
        return false;
      }
      return true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Verifica si un documento ya existe (para editar, excluyendo el actual)
   */
  async checkDocumentExistsForEdit(
    currentDocument: string,
    newDocument: string
  ): Promise<boolean> {
    if (currentDocument === newDocument) {
      return true; // No cambió, no validar
    }
    return this.checkDocumentExists(newDocument);
  }

  /**
   * Verifica si un email ya existe (para editar, excluyendo el actual)
   */
  async checkEmailExistsForEdit(
    currentEmail: string,
    newEmail: string
  ): Promise<boolean> {
    if (currentEmail === newEmail) {
      return true;
    }
    return this.checkEmailExists(newEmail);
  }

  /**
   * Verifica si un username ya existe (para editar, excluyendo el actual)
   */
  async checkUsernameExistsForEdit(
    currentUsername: string,
    newUsername: string
  ): Promise<boolean> {
    if (currentUsername === newUsername) {
      return true;
    }
    return this.checkUsernameExists(newUsername);
  }
}
