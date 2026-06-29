import { AnchorPoint } from './anchor-point.model';

describe('AnchorPoint Model', () => {

  describe('constructor', () => {
    it('should create with default values', () => {
      const ap = new AnchorPoint();
      expect(ap.id).toBe('');
      expect(ap.name).toBe('');
      expect(ap.latitude).toBe(0);
      expect(ap.longitude).toBe(0);
      expect(ap.active).toBeTrue();
      expect(ap.createdAt).toBeInstanceOf(Date);
      expect(ap.updatedAt).toBeInstanceOf(Date);
    });

    it('should create with provided data', () => {
      const ap = new AnchorPoint({
        id: 'ap-1',
        name: 'Jaguar Spot',
        anchorCode: 'JAG-001',
        latitude: -16.5,
        longitude: -68.15,
        section: 'Tierras Altas',
        showInMap: true,
        active: false
      });
      expect(ap.id).toBe('ap-1');
      expect(ap.name).toBe('Jaguar Spot');
      expect(ap.anchorCode).toBe('JAG-001');
      expect(ap.latitude).toBe(-16.5);
      expect(ap.longitude).toBe(-68.15);
      expect(ap.section).toBe('Tierras Altas');
      expect(ap.showInMap).toBeTrue();
      expect(ap.active).toBeFalse();
    });

    it('should set virtualAssetId from animalModelId', () => {
      const ap = new AnchorPoint({ animalModelId: 'model-1' });
      expect(ap.virtualAssetId).toBe('model-1');
      expect(ap.animalModelId).toBe('model-1');
    });

    it('should set animalModelId from virtualAssetId', () => {
      const ap = new AnchorPoint({ virtualAssetId: 'asset-1' });
      expect(ap.animalModelId).toBe('asset-1');
    });
  });

  describe('coordinates', () => {
    it('should return formatted coordinates string', () => {
      const ap = new AnchorPoint({ latitude: -16.523456, longitude: -68.123456 });
      expect(ap.coordinates).toBe('-16.523456, -68.123456');
    });

    it('should pad to 6 decimal places', () => {
      const ap = new AnchorPoint({ latitude: 0, longitude: 0 });
      expect(ap.coordinates).toBe('0.000000, 0.000000');
    });
  });
});
