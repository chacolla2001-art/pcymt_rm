import { VirtualAsset } from './virtual-asset.model';

describe('VirtualAsset Model', () => {

  describe('constructor', () => {
    it('should create with default values', () => {
      const asset = new VirtualAsset();
      expect(asset.id).toBe('');
      expect(asset.name).toBe('');
      expect(asset.model_url).toBe('');
      expect(asset.is_active).toBeTrue();
      expect(asset.created_at).toBeInstanceOf(Date);
      expect(asset.updated_at).toBeInstanceOf(Date);
    });

    it('should create from full data', () => {
      const asset = new VirtualAsset({
        id: 'va-1',
        name: 'Jaguar',
        scientific_name: 'Panthera onca',
        description: 'A big cat',
        model_url: '/models/jaguar.glb',
        icon_url: '/icons/jaguar.png',
        thumbnail_url: '/thumbs/jaguar.jpg',
        category: 'mammals',
        habitat: 'tropical',
        display_order: 1,
        is_active: true
      });
      expect(asset.id).toBe('va-1');
      expect(asset.name).toBe('Jaguar');
      expect(asset.scientific_name).toBe('Panthera onca');
      expect(asset.description).toBe('A big cat');
      expect(asset.model_url).toBe('/models/jaguar.glb');
      expect(asset.icon_url).toBe('/icons/jaguar.png');
      expect(asset.category).toBe('mammals');
      expect(asset.habitat).toBe('tropical');
      expect(asset.display_order).toBe(1);
    });

    it('should handle undefined optional fields', () => {
      const asset = new VirtualAsset({ id: '1', name: 'Test' });
      expect(asset.scientific_name).toBeUndefined();
      expect(asset.description).toBeUndefined();
      expect(asset.icon_url).toBeUndefined();
      expect(asset.thumbnail_url).toBeUndefined();
      expect(asset.category).toBeUndefined();
      expect(asset.animation_sequence).toBeUndefined();
    });

    it('should parse dates from strings', () => {
      const asset = new VirtualAsset({
        created_at: new Date('2026-01-15'),
        updated_at: new Date('2026-02-20')
      });
      expect(asset.created_at.getFullYear()).toBe(2026);
      expect(asset.updated_at.getMonth()).toBe(1); // February
    });
  });
});
