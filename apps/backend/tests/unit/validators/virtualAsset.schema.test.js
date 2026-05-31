const { virtualAssetSchemas } = require('../../../src/shared/validators');

describe('VirtualAsset Validators', () => {
  describe('create schema', () => {
    test('should validate correct virtual asset data', () => {
      const validAsset = {
        name: 'Jaguar Americano',
        scientific_name: 'Panthera onca',
        description: 'Descripción del jaguar',
        category: 'Mamífero',
        habitat: 'Selva tropical',
        display_order: 1,
      };

      const { error } = virtualAssetSchemas.create.validate(validAsset);
      expect(error).toBeUndefined();
    });

    test('should reject missing required name field', () => {
      const invalidAsset = {
        scientific_name: 'Panthera onca',
        category: 'Mamífero',
      };

      const { error } = virtualAssetSchemas.create.validate(invalidAsset);
      expect(error).toBeDefined();
    });

    test('should accept optional fields', () => {
      const validAsset = {
        name: 'Jaguar',
        model_url: 'https://example.com/model.glb',
        icon_url: 'https://example.com/icon.png',
      };

      const { error } = virtualAssetSchemas.create.validate(validAsset);
      expect(error).toBeUndefined();
    });
  });

  describe('update schema', () => {
    test('should allow partial updates', () => {
      const validUpdate = {
        name: 'Updated Name',
      };

      const { error } = virtualAssetSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });

    test('should validate display_order as number', () => {
      const validUpdate = {
        display_order: 5,
      };

      const { error } = virtualAssetSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });
  });
});
