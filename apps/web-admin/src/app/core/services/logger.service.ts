import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorCode, API_ERROR_CODES, ApiErrorResponse } from '../models/api-response.model';

/** Niveles de log */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Entrada de log estructurada */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  errorCode?: ApiErrorCode;
  stack?: string;
}

/** Configuración de colores para consola */
const LOG_COLORS: Record<LogLevel, string> = {
  debug: 'color: #6B7280',
  info: 'color: #3B82F6',
  warn: 'color: #F59E0B',
  error: 'color: #EF4444',
};

/**
 * Servicio de Logging centralizado
 * Proporciona logs estructurados y específicos para cada tipo de error
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Log de depuración */
  debug(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('debug', message, context, data);
  }

  /** Log informativo */
  info(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('info', message, context, data);
  }

  /** Log de advertencia */
  warn(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('warn', message, context, data);
  }

  /** Log de error */
  error(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('error', message, context, data);
  }

  /**
   * Log específico para errores HTTP
   * Extrae información relevante del HttpErrorResponse
   */
  logHttpError(error: HttpErrorResponse, context?: string): void {
    const errorInfo = this.parseHttpError(error);

    const entry: LogEntry = {
      level: 'error',
      message: errorInfo.message,
      timestamp: new Date().toISOString(),
      context: context || 'HTTP',
      errorCode: errorInfo.code,
      data: {
        status: error.status,
        statusText: error.statusText,
        url: error.url || 'unknown',
        ...errorInfo.details,
      },
    };

    this.writeLog(entry);
  }

  /**
   * Log específico para errores de autenticación
   */
  logAuthError(error: HttpErrorResponse | Error, action: string): void {
    const message = error instanceof HttpErrorResponse
      ? this.parseHttpError(error).message
      : error.message;

    this.log('error', `[AUTH] ${action}: ${message}`, 'AuthService', {
      action,
      errorType: error.constructor.name,
    });
  }

  /**
   * Log específico para errores de validación
   */
  logValidationError(errors: Array<{ field: string; message: string }>, context?: string): void {
    const fields = errors.map(e => e.field).join(', ');
    this.log('warn', `[VALIDATION] Campos inválidos: ${fields}`, context, {
      errors,
    });
  }

  /**
   * Log específico para errores de red/timeout
   */
  logNetworkError(error: HttpErrorResponse): void {
    const isTimeout = error.status === 0 && error.message?.includes('timeout');
    const errorCode = isTimeout ? API_ERROR_CODES.TIMEOUT_ERROR : API_ERROR_CODES.NETWORK_ERROR;

    this.log('error', `[NETWORK] ${isTimeout ? 'Timeout' : 'Connection failed'}`, 'Network', {
      url: error.url,
      errorCode,
    });
  }

  /**
   * Parsea un HttpErrorResponse para extraer información estructurada
   */
  private parseHttpError(error: HttpErrorResponse): {
    message: string;
    code: ApiErrorCode;
    details: Record<string, unknown>;
  } {
    // Error de red (sin conexión)
    if (error.status === 0) {
      return {
        message: 'Error de conexión con el servidor',
        code: API_ERROR_CODES.NETWORK_ERROR,
        details: { offline: true },
      };
    }

    // Intenta parsear respuesta del backend
    const body = error.error as ApiErrorResponse | null;

    if (body && typeof body === 'object') {
      return {
        message: body.message || this.getDefaultMessage(error.status),
        code: body.code || this.getCodeFromStatus(error.status),
        details: body.errors ? { validationErrors: body.errors } : {},
      };
    }

    // Fallback para respuestas no estructuradas
    return {
      message: this.getDefaultMessage(error.status),
      code: this.getCodeFromStatus(error.status),
      details: {},
    };
  }

  /** Obtiene mensaje por defecto según código HTTP */
  private getDefaultMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'No autorizado',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      409: 'Conflicto con recurso existente',
      422: 'Error de validación',
      429: 'Demasiadas solicitudes',
      500: 'Error interno del servidor',
      502: 'Error de gateway',
      503: 'Servicio no disponible',
      504: 'Timeout del servidor',
    };
    return messages[status] || `Error HTTP ${status}`;
  }

  /** Mapea código HTTP a código de error de la API */
  private getCodeFromStatus(status: number): ApiErrorCode {
    const mapping: Record<number, ApiErrorCode> = {
      400: API_ERROR_CODES.VALIDATION_ERROR,
      401: API_ERROR_CODES.UNAUTHORIZED,
      403: API_ERROR_CODES.FORBIDDEN,
      404: API_ERROR_CODES.NOT_FOUND,
      409: API_ERROR_CODES.CONFLICT,
      422: API_ERROR_CODES.VALIDATION_ERROR,
      429: API_ERROR_CODES.RATE_LIMITED,
    };
    return mapping[status] || API_ERROR_CODES.INTERNAL_ERROR;
  }

  /** Escribe una entrada de log */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
    };

    this.writeLog(entry);
  }

  /** Escribe el log a la consola */
  private writeLog(entry: LogEntry): void {
    if (!this.isBrowser) return;

    const prefix = entry.context ? `[${entry.context}]` : '';
    const logMessage = `${entry.timestamp} ${prefix} ${entry.message}`;

    const color = LOG_COLORS[entry.level];

    switch (entry.level) {
      case 'debug':
        console.debug(`%c${logMessage}`, color, entry.data || '');
        break;
      case 'info':
        console.info(`%c${logMessage}`, color, entry.data || '');
        break;
      case 'warn':
        console.warn(`%c${logMessage}`, color, entry.data || '');
        break;
      case 'error':
        console.error(`%c${logMessage}`, color, entry.data || '');
        if (entry.stack) console.error(entry.stack);
        break;
    }
  }
}
