import { routes } from './app.routes';

describe('App Routes', () => {

  it('should have a login route', () => {
    const loginRoute = routes.find(r => r.path === 'login');
    expect(loginRoute).toBeTruthy();
    expect(loginRoute?.loadComponent).toBeDefined();
    expect(loginRoute?.canActivate?.length).toBe(1); // LoginRedirectGuard
  });

  it('should have a recover-password route', () => {
    const recoverRoute = routes.find(r => r.path === 'recover-password');
    expect(recoverRoute).toBeTruthy();
    expect(recoverRoute?.loadComponent).toBeDefined();
  });

  it('should have a protected main layout route', () => {
    const mainRoute = routes.find(r => r.path === '');
    expect(mainRoute).toBeTruthy();
    expect(mainRoute?.canActivate?.length).toBe(1); // AuthGuard
    expect(mainRoute?.children?.length).toBeGreaterThan(0);
  });

  it('should define all expected child routes under main', () => {
    const mainRoute = routes.find(r => r.path === '');
    const children = mainRoute?.children ?? [];
    const childPaths = children.map(c => c.path);

    expect(childPaths).toContain('dashboard');
    expect(childPaths).toContain('users');
    expect(childPaths).toContain('anchor-points');
    expect(childPaths).toContain('virtual-assets');
    expect(childPaths).toContain('map');
    expect(childPaths).toContain('animator');
    expect(childPaths).toContain('stats/session-history');
    expect(childPaths).toContain('stats/interaction-stats');
    expect(childPaths).toContain('stats/zone-visits');
    expect(childPaths).toContain('stats/user-interactions');
    expect(childPaths).toContain('stats/user-access');
  });

  it('should redirect empty path to dashboard', () => {
    const mainRoute = routes.find(r => r.path === '');
    const redirect = mainRoute?.children?.find(c => c.path === '');
    expect(redirect?.redirectTo).toBe('dashboard');
    expect(redirect?.pathMatch).toBe('full');
  });

  it('should redirect wildcard to login', () => {
    const wildcard = routes.find(r => r.path === '**');
    expect(wildcard?.redirectTo).toBe('login');
  });

  it('should use lazy loading for all feature routes', () => {
    const mainRoute = routes.find(r => r.path === '');
    const children = mainRoute?.children ?? [];
    children.filter(c => c.loadComponent).forEach(child => {
      expect(typeof child.loadComponent).toBe('function');
    });
  });

  it('should set titles on route data', () => {
    const mainRoute = routes.find(r => r.path === '');
    const dashboard = mainRoute?.children?.find(c => c.path === 'dashboard');
    expect(dashboard?.data?.['title']).toBe('Dashboard');

    const users = mainRoute?.children?.find(c => c.path === 'users');
    expect(users?.data?.['title']).toBe('Gestión de Usuarios');

    const anchors = mainRoute?.children?.find(c => c.path === 'anchor-points');
    expect(anchors?.data?.['title']).toBe('Puntos de Anclaje');
  });
});
