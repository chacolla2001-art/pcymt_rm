import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validators for form validation
 */
export class CustomValidators {

  /**
   * Validates that control value contains no leading/trailing whitespace
   */
  static noWhitespace(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const value = control.value.toString();
    const isWhitespace = value.trim().length === 0;
    const hasLeadingOrTrailingSpace = value !== value.trim();

    return isWhitespace || hasLeadingOrTrailingSpace
      ? { whitespace: true }
      : null;
  }

  /**
   * Validates email format
   */
  static emailFormat(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const valid = emailRegex.test(control.value);

    return valid ? null : { invalidEmail: true };
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

  /**
   * Validates password strength (unified standard)
   * Requirements: At least 8 characters, uppercase, lowercase, number, symbol (@$!%*?&_#-.)
   */
  static passwordStrength(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const password = control.value.toString();
    const errors: any = {};

    if (password.length < 8) {
      errors.minLength = true;
    }

    if (!/[A-Z]/.test(password)) {
      errors.requiresUppercase = true;
    }

    if (!/[a-z]/.test(password)) {
      errors.requiresLowercase = true;
    }

    if (!/[0-9]/.test(password)) {
      errors.requiresNumber = true;
    }

    if (!/[@$!%*?&_#\-.]/.test(password)) {
      errors.requiresSymbol = true;
    }

    return Object.keys(errors).length > 0 ? { passwordStrength: errors } : null;
  }

  /**
   * Validates file size
   * @param maxMB Maximum file size in megabytes
   */
  static fileSize(maxMB: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const file = control.value as File;
      const maxBytes = maxMB * 1024 * 1024;

      return file.size > maxBytes
        ? { fileSize: { max: maxMB, actual: (file.size / 1024 / 1024).toFixed(2) } }
        : null;
    };
  }

  /**
   * Validates file type
   * @param types Array of allowed MIME types or extensions (e.g., ['image/png', '.jpg'])
   */
  static fileType(types: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const file = control.value as File;
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      const isValid = types.some(type => {
        const typeNormalized = type.toLowerCase();
        // Check extension (e.g., '.jpg')
        if (typeNormalized.startsWith('.')) {
          return fileName.endsWith(typeNormalized);
        }
        // Check MIME type (e.g., 'image/png')
        return fileType === typeNormalized;
      });

      return isValid
        ? null
        : { fileType: { allowed: types, actual: fileType || fileName.split('.').pop() } };
    };
  }

  /**
   * Validates that value matches another control
   * @param matchingControlName Name of the control to match
   */
  static matchesControl(matchingControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) {
        return null;
      }

      const matchingControl = control.parent.get(matchingControlName);
      if (!matchingControl) {
        return null;
      }

      return control.value === matchingControl.value
        ? null
        : { mismatch: true };
    };
  }

  /**
   * Validates username format (alphanumeric and underscore only)
   */
  static usernameFormat(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    const valid = usernameRegex.test(control.value);

    return valid ? null : { invalidUsername: true };
  }

  /**
   * Validates that a number is within a range
   * @param min Minimum value
   * @param max Maximum value
   */
  static numberRange(min: number, max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value && control.value !== 0) {
        return null;
      }

      const value = Number(control.value);

      if (isNaN(value)) {
        return { notANumber: true };
      }

      if (value < min || value > max) {
        return { outOfRange: { min, max, actual: value } };
      }

      return null;
    };
  }
}
