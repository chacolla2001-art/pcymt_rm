import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores personalizados para formularios reactivos
 */
export class CustomValidators {

  /** Validador de email con formato estándar */
  static email(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    const valid = emailRegex.test(control.value);
    return valid ? null : { invalidEmail: true };
  }

  /** Validador de dominio de email específico */
  static emailDomain(allowedDomains: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const email = control.value as string;
      const isValid = allowedDomains.some(domain => email.endsWith(`@${domain}`));
      return isValid ? null : { invalidDomain: { allowedDomains } };
    };
  }

  /** Validador que requiere solo Gmail */
  static gmailOnly(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const email = control.value as string;
    if (!email.endsWith('@gmail.com')) {
      return { invalidDomain: true };
    }
    return null;
  }

  /**
   * Patrón estándar de contraseña (igual que backend).
   * Requisitos: mín. 8 caracteres, mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)
   */
  static readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-.])[A-Za-z\d@$!%*?&_#\-.]{8,}$/;
  static readonly PASSWORD_MIN_LENGTH = 8;
  static readonly PASSWORD_MAX_LENGTH = 128;
  static readonly PASSWORD_HINT = 'Mínimo 8 caracteres, debe incluir: mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)';
  static readonly PASSWORD_ERROR_MESSAGE = 'La contraseña debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)';

  /** Validador de fortaleza de contraseña (estándar unificado) */
  static passwordStrength(control: AbstractControl): ValidationErrors | null {
    const password = control.value as string;
    if (!password) return null;

    const errors: ValidationErrors = {};

    if (password.length < CustomValidators.PASSWORD_MIN_LENGTH) {
      errors['minLength'] = true;
    }
    if (!/[A-Z]/.test(password)) {
      errors['missingUppercase'] = true;
    }
    if (!/[a-z]/.test(password)) {
      errors['missingLowercase'] = true;
    }
    if (!/[0-9]/.test(password)) {
      errors['missingNumber'] = true;
    }
    if (!/[@$!%*?&_#\-.]/.test(password)) {
      errors['missingSpecialChar'] = true;
    }

    return Object.keys(errors).length > 0 ? { weakPassword: errors } : null;
  }

  /** Validador de longitud mínima de contraseña */
  static minPasswordLength(minLength: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      return control.value.length < minLength
        ? { minPasswordLength: { required: minLength, actual: control.value.length } }
        : null;
    };
  }

  /** Validador de confirmación de contraseña */
  static passwordMatch(passwordField: string, confirmField: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const password = group.get(passwordField)?.value;
      const confirm = group.get(confirmField)?.value;

      if (!password || !confirm) return null;

      return password === confirm ? null : { passwordMismatch: true };
    };
  }

  /** Validador de número de cédula (solo números, longitud específica) */
  static idCardNumber(minLength: number = 7, maxLength: number = 10): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const value = control.value as string;
      const numericOnly = /^\d+$/.test(value);

      if (!numericOnly) {
        return { invalidIdCard: { reason: 'notNumeric' } };
      }

      if (value.length < minLength || value.length > maxLength) {
        return { invalidIdCard: { reason: 'invalidLength', minLength, maxLength } };
      }

      return null;
    };
  }

  /** Validador de nombre de usuario (sin espacios, caracteres especiales limitados) */
  static username(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const value = control.value as string;
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;

    return usernameRegex.test(value) ? null : { invalidUsername: true };
  }

  /** Validador de solo letras (para nombres) */
  static lettersOnly(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const value = control.value as string;
    const lettersRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

    return lettersRegex.test(value) ? null : { lettersOnly: true };
  }

  /** Validador de coordenadas geográficas */
  static latitude(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const value = parseFloat(control.value);
    return isNaN(value) || value < -90 || value > 90
      ? { invalidLatitude: true }
      : null;
  }

  static longitude(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const value = parseFloat(control.value);
    return isNaN(value) || value < -180 || value > 180
      ? { invalidLongitude: true }
      : null;
  }
}
