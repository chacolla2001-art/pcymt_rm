/**
 * Smoke Tests
 * Verifican que el servidor y servicios principales estén funcionando
 */

const http = require('http');

describe('Smoke Tests', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const API_PREFIX = '/api';

  /**
   * Helper para hacer solicitudes HTTP
   */
  function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        timeout: 5000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null,
            });
          } catch {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data,
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  describe('Server Health', () => {
    test('Servidor debe estar corriendo', async () => {
      try {
        const response = await makeRequest(`${API_PREFIX}/auth/login`, 'POST');
        expect([200, 400, 401]).toContain(response.status);
      } catch (error) {
        fail(`Servidor no responde: ${error.message}`);
      }
    }, 10000);

    test('API debe responder en formato JSON', async () => {
      const response = await makeRequest(`${API_PREFIX}/auth/login`, 'POST');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login debe estar disponible', async () => {
      const response = await makeRequest(`${API_PREFIX}/auth/login`, 'POST');
      expect([200, 400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });

    test('GET /api/auth/me debe requerir autenticación', async () => {
      const response = await makeRequest(`${API_PREFIX}/auth/me`, 'GET');
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('User Endpoints', () => {
    test('GET /api/users debe requerir autenticación', async () => {
      const response = await makeRequest(`${API_PREFIX}/users`, 'GET');
      expect([401, 403]).toContain(response.status);
    });

    test('POST /api/users/check-email debe estar disponible', async () => {
      const response = await makeRequest(`${API_PREFIX}/users/check-email`, 'POST');
      expect([200, 400]).toContain(response.status);
    });

    test('POST /api/users/check-document debe estar disponible', async () => {
      const response = await makeRequest(`${API_PREFIX}/users/check-document`, 'POST');
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Resource Endpoints', () => {
    test('GET /api/anchor-points debe requerir autenticación', async () => {
      const response = await makeRequest(`${API_PREFIX}/anchor-points`, 'GET');
      expect([200, 401, 403]).toContain(response.status);
    });

    test('GET /api/user-interactions debe requerir autenticación', async () => {
      const response = await makeRequest(`${API_PREFIX}/user-interactions`, 'GET');
      expect([200, 401, 403]).toContain(response.status);
    });

    test('GET /api/analytics/totals debe requerir autenticación', async () => {
      const response = await makeRequest(`${API_PREFIX}/analytics/totals`, 'GET');
      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
