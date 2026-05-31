import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserInteraction } from '../models/user-interaction.model';
import { AuthService } from './auth.service';
import { ApiRoutesService } from './api-routes.service';

/**
 * Servicio de Interacciones de Usuario
 * Maneja el registro de interacciones entre usuarios y modelos 3D
 */
@Injectable({
  providedIn: 'root',
})
export class UserInteractionService {
  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  /** Headers JSON con Authorization */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // OPERACIONES CRUD
  // ═══════════════════════════════════════════════════════════════

  /** Obtener todas las interacciones */
  getAllUserInteractions(): Observable<UserInteraction[]> {
    return this.http.get<UserInteraction[]>(this.apiRoutes.endpoints.userInteractions.base, {
      headers: this.getAuthHeaders()
    });
  }

  /** Obtener interacción por ID */
  getUserInteractionById(interactionId: string): Observable<UserInteraction> {
    return this.http.get<UserInteraction>(this.apiRoutes.endpoints.userInteractions.byId(interactionId), {
      headers: this.getAuthHeaders()
    });
  }

  /** Crear nueva interacción */
  createUserInteraction(interaction: UserInteraction): Observable<UserInteraction> {
    return this.http.post<UserInteraction>(this.apiRoutes.endpoints.userInteractions.base, interaction, {
      headers: this.getAuthHeaders()
    });
  }

  /** Actualizar interacción existente */
  updateUserInteraction(
    interactionId: string,
    interaction: UserInteraction
  ): Observable<UserInteraction> {
    return this.http.put<UserInteraction>(
      this.apiRoutes.endpoints.userInteractions.byId(interactionId),
      interaction,
      { headers: this.getAuthHeaders() }
    );
  }

  /** Eliminar interacción */
  deleteUserInteraction(interactionId: string): Observable<void> {
    return this.http.delete<void>(this.apiRoutes.endpoints.userInteractions.byId(interactionId), {
      headers: this.getAuthHeaders()
    });
  }
}
