/**
 * Constantes globales de la aplicación
 */
export const Constants = {
  /** Mensajes de error comunes */
  ERROR_MESSAGES: {
    NETWORK_ERROR: 'Error de red: Por favor verifica tu conexión a internet.',
    AUTH_FAILED: 'Autenticación fallida. Por favor intenta de nuevo.',
    INVALID_DATA: 'Datos inválidos. Por favor verifica tu entrada.',
  },

  /** Roles de usuario en el sistema */
  USER_ROLES: {
    ADMIN: 'admin',
    USER: 'user',
  } as const,

  /** Valores de paginación por defecto */
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 25, 50] as const,
} as const;

/** Tipo para roles de usuario */
export type UserRoleType = typeof Constants.USER_ROLES[keyof typeof Constants.USER_ROLES];
