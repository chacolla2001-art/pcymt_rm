/** Rol del usuario en el sistema */
export type UserRole = 'admin' | 'user';

/** Plataforma desde donde se accede */
export type Platform = 'web' | 'mobile';

/**
 * Modelo de Sesión de Usuario
 * Registra las sesiones de inicio/cierre de sesión
 */
export class UserSession {
  id: string;
  user_id: string;
  login_at: Date;
  logout_at?: Date;
  role: UserRole;
  platform: Platform;

  constructor(data?: Partial<UserSession>) {
    this.id = data?.id ?? '';
    this.user_id = data?.user_id ?? '';
    this.login_at = data?.login_at ? new Date(data.login_at) : new Date();
    this.logout_at = data?.logout_at ? new Date(data.logout_at) : undefined;
    this.role = data?.role ?? 'user';
    this.platform = data?.platform ?? 'web';
  }

  /** Verifica si la sesión sigue activa */
  get isActive(): boolean {
    return !this.logout_at;
  }

  /** Duración de la sesión en minutos (null si aún activa) */
  get durationMinutes(): number | null {
    if (!this.logout_at) return null;
    return Math.round((this.logout_at.getTime() - this.login_at.getTime()) / 60000);
  }
}
