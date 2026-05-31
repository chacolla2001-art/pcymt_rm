/**
 * Roles de usuario disponibles en el sistema
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

/**
 * Modelo de Usuario
 * Campos sincronizados con el backend (PostgreSQL)
 */
export class User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  google_id?: string;
  avatar_url: string;
  email_verified_at?: Date;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;

  constructor(data?: Partial<User>) {
    this.id = data?.id ?? '';
    this.name = data?.name ?? '';
    this.email = data?.email ?? '';
    this.role = data?.role ?? UserRole.USER;
    this.is_active = data?.is_active ?? true;
    this.google_id = data?.google_id;
    this.avatar_url = data?.avatar_url ?? '';
    this.email_verified_at = data?.email_verified_at ? new Date(data.email_verified_at) : undefined;
    this.last_login_at = data?.last_login_at ? new Date(data.last_login_at) : undefined;
    this.created_at = data?.created_at ? new Date(data.created_at) : new Date();
    this.updated_at = data?.updated_at ? new Date(data.updated_at) : new Date();
  }

  /** Nombre completo formateado */
  get fullDisplayName(): string {
    return this.name || this.email;
  }

  /** Verifica si el usuario es administrador */
  isAdmin(): boolean {
    return this.role.toLowerCase() === UserRole.ADMIN;
  }

  /** Verifica si el usuario tiene un rol específico */
  hasRole(role: UserRole | string): boolean {
    return this.role.toLowerCase() === role.toLowerCase();
  }

  /** Obtiene las iniciales del nombre */
  getInitials(): string {
    const parts = this.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (this.name.substring(0, 2) || this.email.substring(0, 2)).toUpperCase();
  }

  /** Verifica si el usuario está activo y puede operar */
  canOperate(): boolean {
    return this.is_active;
  }
}
