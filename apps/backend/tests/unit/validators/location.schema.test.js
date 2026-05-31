const { locationSchemas } = require('../../../src/shared/validators');

describe('Location Validators', () => {
  describe('create schema', () => {
    test('should validate correct location data', () => {
      const validLocation = {
        name: 'Parque Nacional Madidi',
        latitude: -14.4333,
        longitude: -67.7167,
      };

      const { error } = locationSchemas.create.validate(validLocation);
      expect(error).toBeUndefined();
    });

    test('should reject missing required latitude', () => {
      const invalidLocation = {
        name: 'Test Location',
        longitude: -67.7167,
      };

      const { error } = locationSchemas.create.validate(invalidLocation);
      expect(error).toBeDefined();
    });

    test('should reject missing required longitude', () => {
      const invalidLocation = {
        name: 'Test Location',
        latitude: -14.4333,
      };

      const { error } = locationSchemas.create.validate(invalidLocation);
      expect(error).toBeDefined();
    });

    test('should validate latitude range', () => {
      const invalidLocation = {
        name: 'Test',
        latitude: 100, // Invalid: > 90
        longitude: -67.7167,
      };

      const { error } = locationSchemas.create.validate(invalidLocation);
      expect(error).toBeDefined();
    });

    test('should validate longitude range', () => {
      const invalidLocation = {
        name: 'Test',
        latitude: -14.4333,
        longitude: 200, // Invalid: > 180
      };

      const { error } = locationSchemas.create.validate(invalidLocation);
      expect(error).toBeDefined();
    });
  });

  describe('update schema', () => {
    test('should allow partial updates', () => {
      const validUpdate = {
        name: 'Updated Location Name',
      };

      const { error } = locationSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });

    test('should validate updated coordinates', () => {
      const validUpdate = {
        latitude: -16.5,
        longitude: -68.15,
      };

      const { error } = locationSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });
  });
});
