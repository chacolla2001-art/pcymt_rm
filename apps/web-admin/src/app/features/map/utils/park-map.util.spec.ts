import { findParkSectionAt, isInsidePark, sectionLabelCentroids } from './park-map.util';

describe('park-map.util', () => {
  it('exposes 3 section label centroids', () => {
    expect(sectionLabelCentroids()).toHaveSize(3);
    expect(sectionLabelCentroids().map((s) => s.name)).toEqual([
      'Tierras Altas',
      'Tierras Medias',
      'Tierras Bajas',
    ]);
  });

  it('resolves a point inside Tierras Altas', () => {
    const alta = sectionLabelCentroids().find((s) => s.name === 'Tierras Altas');
    expect(alta).toBeTruthy();
    expect(findParkSectionAt(alta!.geo.lat, alta!.geo.lng)).toBe('Tierras Altas');
  });

  it('detects park boundary', () => {
    const alta = sectionLabelCentroids()[0];
    expect(isInsidePark(alta.geo)).toBeTrue();
  });
});
