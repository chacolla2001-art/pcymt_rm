import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { AlertService } from './alert.service';
import { AlertComponent, AlertType } from '../../shared/controls/alert-controls/alert-control';

describe('AlertService', () => {
  let service: AlertService;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
  const fakeRef = {} as MatSnackBarRef<AlertComponent>;

  beforeEach(() => {
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['openFromComponent']);
    snackBarSpy.openFromComponent.and.returnValue(fakeRef);

    TestBed.configureTestingModule({
      providers: [
        AlertService,
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    });
    service = TestBed.inject(AlertService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showAlert()', () => {
    it('should open snackbar with correct component and config', () => {
      service.showAlert('Test message', 'info', 3000);
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({
          data: jasmine.objectContaining({ message: 'Test message', type: 'info', duration: 3000 }),
          duration: 3000,
          panelClass: ['alert-snackbar', 'info'],
          horizontalPosition: 'right',
          verticalPosition: 'bottom'
        })
      );
    });

    it('should default duration to 5000ms', () => {
      service.showAlert('Test', 'success');
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({ duration: 5000 })
      );
    });
  });

  describe('showSuccess()', () => {
    it('should call showAlert with success type', () => {
      service.showSuccess('Saved!');
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({
          data: jasmine.objectContaining({ type: 'success', message: 'Saved!' })
        })
      );
    });
  });

  describe('showWarning()', () => {
    it('should call showAlert with warning type', () => {
      service.showWarning('Watch out!');
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({
          data: jasmine.objectContaining({ type: 'warning', message: 'Watch out!' })
        })
      );
    });
  });

  describe('showError()', () => {
    it('should call showAlert with error type', () => {
      service.showError('Something broke');
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({
          data: jasmine.objectContaining({ type: 'error', message: 'Something broke' })
        })
      );
    });
  });

  describe('showInfo()', () => {
    it('should call showAlert with info type', () => {
      service.showInfo('FYI');
      expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
        AlertComponent,
        jasmine.objectContaining({
          data: jasmine.objectContaining({ type: 'info', message: 'FYI' })
        })
      );
    });
  });
});
