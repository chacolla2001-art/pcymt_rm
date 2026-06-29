/**
 * Tipos de interacción del usuario con los puntos de anclaje
 */
export enum InteractionType {
  View = 1,
  Scan = 2,
  Favorite = 3
}

/**
 * Modelo de Interacción de Usuario
 * Registra las interacciones entre usuarios y modelos 3D en el parque
 */
export class UserInteraction {
  id: string;
  interactionType: InteractionType;
  is_active: boolean;
  /** FK a User (user_id) */
  user_id: string;
  /** FK a AnchorPoint - Punto de Señalización Animal */
  psa: string;
  /** FK a VirtualAsset - Código Especie Representada Modelo */
  cerm: string;
  created_at: Date;
  updated_at: Date;

  constructor(data?: Partial<UserInteraction>) {
    this.id = data?.id ?? '';
    this.interactionType = data?.interactionType ?? InteractionType.View;
    this.is_active = data?.is_active ?? true;
    this.user_id = data?.user_id ?? '';
    this.psa = data?.psa ?? '';
    this.cerm = data?.cerm ?? '';
    this.created_at = data?.created_at ? new Date(data.created_at) : new Date();
    this.updated_at = data?.updated_at ? new Date(data.updated_at) : new Date();
  }

  /** Nombre legible del tipo de interacción */
  get interactionTypeName(): string {
    switch (this.interactionType) {
      case InteractionType.View: return 'Vista';
      case InteractionType.Scan: return 'Escaneo';
      case InteractionType.Favorite: return 'Favorito';
      default: return 'Desconocido';
    }
  }
}
