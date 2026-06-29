import { Helpers } from './helpers';

describe('Helpers', () => {

  describe('formatDate()', () => {
    it('should format date as DD/MM/YYYY', () => {
      const date = new Date(2026, 0, 15); // Jan 15, 2026
      expect(Helpers.formatDate(date)).toBe('15/01/2026');
    });

    it('should pad single-digit days and months', () => {
      const date = new Date(2026, 2, 5); // Mar 5, 2026
      expect(Helpers.formatDate(date)).toBe('05/03/2026');
    });
  });

  describe('formatDateISO()', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2026-06-15T12:00:00Z');
      expect(Helpers.formatDateISO(date)).toBe('2026-06-15');
    });
  });

  describe('formatDateTime()', () => {
    it('should format date and time as DD/MM/YYYY HH:mm', () => {
      const date = new Date(2026, 0, 15, 9, 5);
      expect(Helpers.formatDateTime(date)).toBe('15/01/2026 09:05');
    });
  });

  describe('handleHttpError()', () => {
    it('should return network error for status 0', () => {
      expect(Helpers.handleHttpError({ status: 0 })).toContain('red');
    });

    it('should return client error for 4xx status', () => {
      expect(Helpers.handleHttpError({ status: 400 })).toContain('cliente');
    });

    it('should use server message for 4xx if available', () => {
      expect(Helpers.handleHttpError({ status: 400, error: { message: 'Bad data' } })).toBe('Bad data');
    });

    it('should return server error for 5xx status', () => {
      expect(Helpers.handleHttpError({ status: 500 })).toContain('servidor');
    });

    it('should return generic error for other statuses', () => {
      expect(Helpers.handleHttpError({ status: 300 })).toContain('inesperado');
    });
  });

  describe('capitalize()', () => {
    it('should capitalize first letter', () => {
      expect(Helpers.capitalize('hello')).toBe('Hello');
    });

    it('should lowercase the rest', () => {
      expect(Helpers.capitalize('HELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(Helpers.capitalize('')).toBe('');
    });
  });

  describe('capitalizeWords()', () => {
    it('should capitalize each word', () => {
      expect(Helpers.capitalizeWords('hello world')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(Helpers.capitalizeWords('')).toBe('');
    });
  });

  describe('truncate()', () => {
    it('should truncate long strings with ellipsis', () => {
      expect(Helpers.truncate('This is a very long string', 10)).toBe('This is...');
    });

    it('should not truncate short strings', () => {
      expect(Helpers.truncate('Short', 10)).toBe('Short');
    });

    it('should use custom suffix', () => {
      expect(Helpers.truncate('This is a very long string', 12, '…')).toBe('This is a v…');
    });

    it('should handle empty/null string', () => {
      expect(Helpers.truncate('', 10)).toBe('');
    });
  });

  describe('generateId()', () => {
    it('should generate a non-empty string', () => {
      expect(Helpers.generateId()).toBeTruthy();
    });

    it('should generate unique IDs', () => {
      const id1 = Helpers.generateId();
      const id2 = Helpers.generateId();
      expect(id1).not.toBe(id2);
    });

    it('should contain a hyphen separator', () => {
      expect(Helpers.generateId()).toContain('-');
    });
  });

  describe('isEmpty()', () => {
    it('should return true for empty object', () => {
      expect(Helpers.isEmpty({})).toBeTrue();
    });

    it('should return false for non-empty object', () => {
      expect(Helpers.isEmpty({ key: 'value' } as any)).toBeFalse();
    });
  });

  describe('deepClone()', () => {
    it('should create a deep copy', () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = Helpers.deepClone(original);
      clone.b.c = 99;
      expect(original.b.c).toBe(2);
    });

    it('should clone arrays', () => {
      const original = [1, [2, 3]];
      const clone = Helpers.deepClone(original);
      (clone[1] as number[])[0] = 99;
      expect((original[1] as number[])[0]).toBe(2);
    });
  });

  describe('removeNullish()', () => {
    it('should remove null and undefined values', () => {
      const obj = { a: 1, b: null, c: undefined, d: 'hello' };
      const result = Helpers.removeNullish(obj as any);
      expect(result).toEqual({ a: 1, d: 'hello' } as any);
    });

    it('should keep falsy non-nullish values', () => {
      const obj = { a: 0, b: '', c: false };
      const result = Helpers.removeNullish(obj as any);
      expect(result).toEqual({ a: 0, b: '', c: false } as any);
    });
  });

  describe('debounce()', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('should delay execution', () => {
      const fn = jasmine.createSpy('fn');
      const debounced = Helpers.debounce(fn, 300);
      debounced();
      expect(fn).not.toHaveBeenCalled();
      jasmine.clock().tick(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset delay on subsequent calls', () => {
      const fn = jasmine.createSpy('fn');
      const debounced = Helpers.debounce(fn, 300);
      debounced();
      jasmine.clock().tick(200);
      debounced();
      jasmine.clock().tick(200);
      expect(fn).not.toHaveBeenCalled();
      jasmine.clock().tick(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
