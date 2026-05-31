// src/app/environments/environment.ts
// Este archivo es generado automáticamente por scripts/load-env.js
// No editar manualmente

/**
 * Interfaz para la configuración del ambiente
 */
export interface Environment {
  /** URL base de la API backend */
  apiUrl: string;
  /** Duración de la autenticación en milisegundos */
  authDurationMs: number;
  /** Google Maps API Key */
  googleMapsApiKey: string;
  /** Configuración de seguridad */
  security: {
    /** Forzar HTTPS */
    forceHttps: boolean;
    /** Habilitar CSP (Content Security Policy) */
    enableCSP: boolean;
    /** Habilitar validación estricta de tokens */
    strictTokenValidation: boolean;
  };
  /** Configuración de features */
  features: {
    /** Habilitar analytics */
    enableAnalytics: boolean;
  };
  /** Nombre del ambiente */
  envName: string;
  /** Indica si es producción */
  production: boolean;
}

/**
 * Configuración de la aplicación
 * Los valores se cargan desde variables de entorno (.env)
 */
export const environment: Environment = {
  apiUrl: 'http://localhost:5001',
  authDurationMs: 24 * 60 * 60 * 1000, // 1 día
  googleMapsApiKey: '', // Not used in current version
  security: {
    forceHttps: false,
    enableCSP: false,
    strictTokenValidation: false,
  },
  features: {
    enableAnalytics: false,
  },
  envName: 'development',
  production: false,
};
