/**
 * Clase de utilidades con helpers comunes
 * Para validadores de formularios, usar CustomValidators de './validators'
 */
export class Helpers {

  /** Formatea una fecha al formato 'dd/MM/yyyy' */
  static formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /** Formatea una fecha al formato ISO 'yyyy-MM-dd' */
  static formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Formatea fecha y hora */
  static formatDateTime(date: Date): string {
    const dateStr = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}`;
  }

  /** Maneja errores HTTP y devuelve un mensaje amigable */
  static handleHttpError(error: { status: number; error?: { message?: string } }): string {
    if (error.status === 0) {
      return 'Error de red: Por favor verifica tu conexión a internet.';
    }
    if (error.status >= 400 && error.status < 500) {
      return error.error?.message || 'Error del cliente: Por favor verifica tu solicitud.';
    }
    if (error.status >= 500) {
      return 'Error del servidor: Por favor intenta de nuevo más tarde.';
    }
    return 'Ocurrió un error inesperado.';
  }

  /** Capitaliza la primera letra de un string */
  static capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /** Capitaliza cada palabra de un string */
  static capitalizeWords(str: string): string {
    if (!str) return '';
    return str.split(' ').map(word => this.capitalize(word)).join(' ');
  }

  /** Trunca un string a la longitud especificada */
  static truncate(str: string, maxLength: number, suffix = '...'): string {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
  }

  /** Genera un ID único simple */
  static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /** Comprueba si un objeto está vacío */
  static isEmpty(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).length === 0;
  }

  /** Clona un objeto de forma profunda */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Elimina propiedades nulas o undefined de un objeto */
  static removeNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value != null)
    ) as Partial<T>;
  }

  /** Debounce para funciones */
  static debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
}
