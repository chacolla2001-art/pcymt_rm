import { FormControl, FormGroup } from '@angular/forms';
import { CustomValidators } from './custom-validators';

describe('CustomValidators (shared)', () => {

  describe('noWhitespace()', () => {
    it('should accept normal text', () => {
      const ctrl = new FormControl('hello');
      expect(CustomValidators.noWhitespace(ctrl)).toBeNull();
    });

    it('should reject whitespace-only string', () => {
      const ctrl = new FormControl('   ');
      expect(CustomValidators.noWhitespace(ctrl)).toEqual({ whitespace: true });
    });

    it('should reject leading/trailing spaces', () => {
      const ctrl = new FormControl(' hello ');
      expect(CustomValidators.noWhitespace(ctrl)).toEqual({ whitespace: true });
    });

    it('should allow empty value', () => {
      const ctrl = new FormControl('');
      expect(CustomValidators.noWhitespace(ctrl)).toBeNull();
    });
  });

  describe('emailFormat()', () => {
    it('should accept valid email', () => {
      expect(CustomValidators.emailFormat(new FormControl('test@example.com'))).toBeNull();
    });

    it('should reject invalid email', () => {
      expect(CustomValidators.emailFormat(new FormControl('invalid'))).toEqual({ invalidEmail: true });
    });

    it('should allow empty value', () => {
      expect(CustomValidators.emailFormat(new FormControl(''))).toBeNull();
    });
  });

  describe('passwordStrength()', () => {
    it('should accept strong password with 8+ chars, upper, lower, number, symbol', () => {
      const ctrl = new FormControl('Cyber1_x');
      expect(CustomValidators.passwordStrength(ctrl)).toBeNull();
    });

    it('should accept Cybercenter1_ as valid password', () => {
      const ctrl = new FormControl('Cybercenter1_');
      expect(CustomValidators.passwordStrength(ctrl)).toBeNull();
    });

    it('should detect missing uppercase', () => {
      const ctrl = new FormControl('mypassword1!');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['passwordStrength']?.['requiresUppercase']).toBeTrue();
    });

    it('should detect missing lowercase', () => {
      const ctrl = new FormControl('MYPASSWORD1!');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['passwordStrength']?.['requiresLowercase']).toBeTrue();
    });

    it('should detect too short password', () => {
      const ctrl = new FormControl('Short1!');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['passwordStrength']?.['minLength']).toBeTrue();
    });

    it('should detect missing number', () => {
      const ctrl = new FormControl('MyPassworddd!');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['passwordStrength']?.['requiresNumber']).toBeTrue();
    });

    it('should detect missing symbol', () => {
      const ctrl = new FormControl('MyPassword12');
      const result = CustomValidators.passwordStrength(ctrl);
      expect(result?.['passwordStrength']?.['requiresSymbol']).toBeTrue();
    });
  });

  describe('fileSize()', () => {
    it('should accept file under limit', () => {
      const validator = CustomValidators.fileSize(5);
      const file = new File(['x'.repeat(1024)], 'test.txt');
      const ctrl = new FormControl(file);
      expect(validator(ctrl)).toBeNull();
    });

    it('should reject file over limit', () => {
      const validator = CustomValidators.fileSize(0.001); // ~1KB max
      const content = new Uint8Array(2048);
      const file = new File([content], 'big.txt');
      const ctrl = new FormControl(file);
      expect(validator(ctrl)?.['fileSize']).toBeTruthy();
    });
  });

  describe('fileType()', () => {
    it('should accept allowed file extension', () => {
      const validator = CustomValidators.fileType(['.png', '.jpg']);
      const file = new File([''], 'image.png', { type: 'image/png' });
      const ctrl = new FormControl(file);
      expect(validator(ctrl)).toBeNull();
    });

    it('should accept allowed MIME type', () => {
      const validator = CustomValidators.fileType(['image/png']);
      const file = new File([''], 'image.png', { type: 'image/png' });
      const ctrl = new FormControl(file);
      expect(validator(ctrl)).toBeNull();
    });

    it('should reject disallowed file type', () => {
      const validator = CustomValidators.fileType(['.png']);
      const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
      const ctrl = new FormControl(file);
      expect(validator(ctrl)?.['fileType']).toBeTruthy();
    });
  });

  describe('matchesControl()', () => {
    it('should pass when controls match', () => {
      const group = new FormGroup({
        password: new FormControl('abc123'),
        confirm: new FormControl('abc123')
      });
      const validator = CustomValidators.matchesControl('password');
      expect(validator(group.get('confirm')!)).toBeNull();
    });

    it('should fail when controls differ', () => {
      const group = new FormGroup({
        password: new FormControl('abc123'),
        confirm: new FormControl('xyz789')
      });
      const validator = CustomValidators.matchesControl('password');
      expect(validator(group.get('confirm')!)).toEqual({ mismatch: true });
    });
  });

  describe('usernameFormat()', () => {
    it('should accept valid alphanumeric username with underscores', () => {
      expect(CustomValidators.usernameFormat(new FormControl('user_123'))).toBeNull();
    });

    it('should reject username with dots', () => {
      expect(CustomValidators.usernameFormat(new FormControl('user.name'))).toEqual({ invalidUsername: true });
    });

    it('should reject username with special chars', () => {
      expect(CustomValidators.usernameFormat(new FormControl('user@!'))).toEqual({ invalidUsername: true });
    });
  });

  describe('numberRange()', () => {
    it('should accept value within range', () => {
      const validator = CustomValidators.numberRange(1, 100);
      expect(validator(new FormControl(50))).toBeNull();
    });

    it('should accept boundary values', () => {
      const validator = CustomValidators.numberRange(1, 100);
      expect(validator(new FormControl(1))).toBeNull();
      expect(validator(new FormControl(100))).toBeNull();
    });

    it('should reject value out of range', () => {
      const validator = CustomValidators.numberRange(1, 100);
      expect(validator(new FormControl(101))?.['outOfRange']).toBeTruthy();
      expect(validator(new FormControl(0))?.['outOfRange']).toBeTruthy();
    });

    it('should reject non-numeric value', () => {
      const validator = CustomValidators.numberRange(1, 100);
      expect(validator(new FormControl('abc'))?.['notANumber']).toBeTrue();
    });
  });
});
