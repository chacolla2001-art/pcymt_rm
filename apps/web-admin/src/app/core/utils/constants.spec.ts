import { Constants } from './constants';

describe('Constants', () => {

  it('should define ERROR_MESSAGES', () => {
    expect(Constants.ERROR_MESSAGES.NETWORK_ERROR).toContain('red');
    expect(Constants.ERROR_MESSAGES.AUTH_FAILED).toContain('Autenticación');
    expect(Constants.ERROR_MESSAGES.INVALID_DATA).toContain('inválidos');
  });

  it('should define USER_ROLES', () => {
    expect(Constants.USER_ROLES.ADMIN).toBe('admin');
    expect(Constants.USER_ROLES.USER).toBe('user');
  });

  it('should have default pagination values', () => {
    expect(Constants.DEFAULT_PAGE_SIZE).toBe(10);
    expect(Constants.PAGE_SIZE_OPTIONS).toEqual([5, 10, 25, 50]);
  });
});
