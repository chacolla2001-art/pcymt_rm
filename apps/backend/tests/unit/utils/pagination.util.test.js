const PaginationUtil = require('../../../src/shared/utils/pagination.util');

describe('PaginationUtil', () => {
  describe('getMeta', () => {
    test('should return pagination metadata for first page', () => {
      const result = PaginationUtil.getMeta(100, 1, 10);

      expect(result).toEqual({
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      });
    });

    test('should calculate correct totalPages', () => {
      expect(PaginationUtil.getMeta(95, 1, 10).totalPages).toBe(10);
      expect(PaginationUtil.getMeta(100, 1, 10).totalPages).toBe(10);
      expect(PaginationUtil.getMeta(101, 1, 10).totalPages).toBe(11);
    });

    test('should handle middle page correctly', () => {
      const result = PaginationUtil.getMeta(100, 5, 10);

      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
    });

    test('should handle last page correctly', () => {
      const result = PaginationUtil.getMeta(100, 10, 10);

      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });

    test('should handle empty results', () => {
      const result = PaginationUtil.getMeta(0, 1, 10);

      expect(result.totalPages).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('parse', () => {
    test('should parse pagination from query', () => {
      const result = PaginationUtil.parse({ page: '2', limit: '20' });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    test('should use default values for empty query', () => {
      const result = PaginationUtil.parse({});
      
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
    });

    test('should enforce maximum limit', () => {
      const result = PaginationUtil.parse({ limit: '200' });
      expect(result.limit).toBeLessThanOrEqual(100);
    });
  });
});
