import { TestBed } from '@angular/core/testing';
import { DrawerService } from './drawer.service';
import { MatDrawer } from '@angular/material/sidenav';

describe('DrawerService', () => {
  let service: DrawerService;
  let mockDrawer: jasmine.SpyObj<MatDrawer>;

  beforeEach(() => {
    mockDrawer = jasmine.createSpyObj('MatDrawer', ['toggle', 'open', 'close']);
    TestBed.configureTestingModule({});
    service = TestBed.inject(DrawerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('without drawer set', () => {
    it('should not throw on toggle when drawer not set', () => {
      expect(() => service.toggle()).not.toThrow();
    });

    it('should not throw on open when drawer not set', () => {
      expect(() => service.open()).not.toThrow();
    });

    it('should not throw on close when drawer not set', () => {
      expect(() => service.close()).not.toThrow();
    });
  });

  describe('with drawer set', () => {
    beforeEach(() => {
      service.setDrawer(mockDrawer);
    });

    it('should delegate toggle to drawer', () => {
      service.toggle();
      expect(mockDrawer.toggle).toHaveBeenCalled();
    });

    it('should delegate open to drawer', () => {
      service.open();
      expect(mockDrawer.open).toHaveBeenCalled();
    });

    it('should delegate close to drawer', () => {
      service.close();
      expect(mockDrawer.close).toHaveBeenCalled();
    });
  });
});
