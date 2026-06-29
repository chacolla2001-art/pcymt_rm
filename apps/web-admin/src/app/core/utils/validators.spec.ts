import { FormControl, FormGroup } from '@angular/forms';
import { CustomValidators } from './validators';

describe('CustomValidators (core)', () => {

  describe('email()', () => {
    it('should accept valid email', () => {
      const ctrl = new FormControl('test@example.com');
      expect(CustomValidators.email(ctrl)).toBeNull();
    });

    it('should reject email without domain', () => {
      const ctrl = new FormControl('test@');
      expect(CustomValidators.email(ctrl)).toEqual({ invalidEmail: true });
    });

    it('should reject plain text', () => {
      const ctrl = new FormControl('notanemail');
      expect(CustomValidators.email(ctrl)).toEqual({ invalidEmail: true });
    });

    it('should allow empty value (null = valid)', () => {
      const ctrl = new FormControl('');
      expect(CustomValidators.email(ctrl)).toBeNull();
    });
  });

  describe('emailDomain()', () => {
    it('should accept email with allowed domain', () => {
      const validator = CustomValidators.emailDomain(['gmail.com', 'yahoo.com']);
      const ctrl = new FormControl('user@gmail.com');
      expect(validator(ctrl)).toBeNull();
    });

    it('should reject email with non-allowed domain', () => {
      const validator = CustomValidators.emailDomain(['gmail.com']);
      const ctrl = new FormControl('user@hotmail.com');
      expect(validator(ctrl)).toEqual({ invalidDomain: { allowedDomains: ['gmail.com'] } });
    });

    it('should allow empty value', () => {
      const validator = CustomValidators.emailDomain(['gmail.com']);
      const ctrl = new FormControl('');
      expect(validator(ctrl)).toBeNull();
    });
  });

  describe('gmailOnly()', () => {
    it('should accept @gmail.com', () => {
      const ctrl = new FormControl('user@gmail.com');
      expect(CustomValidators.gmailOnly(ctrl)).toBeNull();
    });

    it('should reject non-gmail domains', () => {
      const ctrl = new FormControl('user@yahoo.com');
      expect(CustomValidators.gmailOnly(ctrl)).toEqual({ invalidDomain: true });
    });
  });

  describe('passwordStrength()', () => {
    it('should accept strong password', () => {
      const ctrl = new FormControl('Abc123!@#');
      expect(CustomValidators.passwordStrength(ctrl)).toBeNull();
    });

    it('should accept Cybercenter1_ as valid password', () => {
      const ctrl = new FormControl('Cybercenter1_');
      expect(CustomValidators.passwordStrength(ctrl)).toBeNull();
    });

    it('should reject password shorter than 8 characters', () => {
      const ctrl = new FormControl('Ab1!');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['weakPassword']?.['minLength']).toBeTrue();
    });

    it('should reject password missing uppercase', () => {
      const ctrl = new FormControl('abc123!@#');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['weakPassword']?.['missingUppercase']).toBeTrue();
    });

    it('should reject password missing lowercase', () => {
      const ctrl = new FormControl('ABC123!@#');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['weakPassword']?.['missingLowercase']).toBeTrue();
    });

    it('should reject password missing number', () => {
      const ctrl = new FormControl('Abcdef!@#');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['weakPassword']?.['missingNumber']).toBeTrue();
    });

    it('should reject password missing special char', () => {
      const ctrl = new FormControl('Abcdef123');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['weakPassword']?.['missingSpecialChar']).toBeTrue();
    });
  });

  describe('minPasswordLength()', () => {
    it('should accept password meeting minimum length', () => {
      const validator = CustomValidators.minPasswordLength(8);
      const ctrl = new FormControl('12345678');
      expect(validator(ctrl)).toBeNull();
    });

    it('should reject short password', () => {
      const validator = CustomValidators.minPasswordLength(8);
      const ctrl = new FormControl('1234');
      expect(validator(ctrl)).toEqual({ minPasswordLength: { required: 8, actual: 4 } });
    });
  });

  describe('passwordMatch()', () => {
    it('should pass when passwords match', () => {
      const group = new FormGroup({
        password: new FormControl('abc123'),
        confirm: new FormControl('abc123')
      });
      const validator = CustomValidators.passwordMatch('password', 'confirm');
      expect(validator(group)).toBeNull();
    });

    it('should fail when passwords differ', () => {
      const group = new FormGroup({
        password: new FormControl('abc123'),
        confirm: new FormControl('xyz789')
      });
      const validator = CustomValidators.passwordMatch('password', 'confirm');
      expect(validator(group)).toEqual({ passwordMismatch: true });
    });
  });

  describe('idCardNumber()', () => {
    it('should accept valid numeric ID', () => {
      const validator = CustomValidators.idCardNumber();
      const ctrl = new FormControl('1234567');
      expect(validator(ctrl)).toBeNull();
    });

    it('should reject non-numeric ID', () => {
      const validator = CustomValidators.idCardNumber();
      const ctrl = new FormControl('ABC1234');
      expect(validator(ctrl)?.['invalidIdCard']?.['reason']).toBe('notNumeric');
    });

    it('should reject too short ID', () => {
      const validator = CustomValidators.idCardNumber(7, 10);
      const ctrl = new FormControl('123');
      expect(validator(ctrl)?.['invalidIdCard']?.['reason']).toBe('invalidLength');
    });

    it('should reject too long ID', () => {
      const validator = CustomValidators.idCardNumber(7, 10);
      const ctrl = new FormControl('12345678901');
      expect(validator(ctrl)?.['invalidIdCard']?.['reason']).toBe('invalidLength');
    });
  });

  describe('username()', () => {
    it('should accept valid username with alphanumeric, dots, hyphens, underscores', () => {
      const ctrl = new FormControl('user.name-test_1');
      expect(CustomValidators.username(ctrl)).toBeNull();
    });

    it('should reject username with spaces', () => {
      const ctrl = new FormControl('user name');
      expect(CustomValidators.username(ctrl)).toEqual({ invalidUsername: true });
    });

    it('should reject username with special chars', () => {
      const ctrl = new FormControl('user@name!');
      expect(CustomValidators.username(ctrl)).toEqual({ invalidUsername: true });
    });
  });

  describe('lettersOnly()', () => {
    it('should accept letters and accented characters', () => {
      const ctrl = new FormControl('José María');
      expect(CustomValidators.lettersOnly(ctrl)).toBeNull();
    });

    it('should reject numbers', () => {
      const ctrl = new FormControl('Name123');
      expect(CustomValidators.lettersOnly(ctrl)).toEqual({ lettersOnly: true });
    });
  });

  describe('latitude()', () => {
    it('should accept valid latitude', () => {
      expect(CustomValidators.latitude(new FormControl('45.5'))).toBeNull();
      expect(CustomValidators.latitude(new FormControl('-90'))).toBeNull();
      expect(CustomValidators.latitude(new FormControl('90'))).toBeNull();
    });

    it('should reject out-of-range latitude', () => {
      expect(CustomValidators.latitude(new FormControl('91'))).toEqual({ invalidLatitude: true });
      expect(CustomValidators.latitude(new FormControl('-91'))).toEqual({ invalidLatitude: true });
    });

    it('should reject non-numeric', () => {
      expect(CustomValidators.latitude(new FormControl('abc'))).toEqual({ invalidLatitude: true });
    });
  });

  describe('longitude()', () => {
    it('should accept valid longitude', () => {
      expect(CustomValidators.longitude(new FormControl('180'))).toBeNull();
      expect(CustomValidators.longitude(new FormControl('-180'))).toBeNull();
      expect(CustomValidators.longitude(new FormControl('0'))).toBeNull();
    });

    it('should reject out-of-range longitude', () => {
      expect(CustomValidators.longitude(new FormControl('181'))).toEqual({ invalidLongitude: true });
      expect(CustomValidators.longitude(new FormControl('-181'))).toEqual({ invalidLongitude: true });
    });
  });
});
