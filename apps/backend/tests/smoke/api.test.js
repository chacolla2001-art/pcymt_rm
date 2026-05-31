const request = require('supertest');

// Mock database and external dependencies
jest.mock('../../src/infrastructure/database');
jest.mock('../../src/config/container');

const { createApp } = require('../../src/app');

describe('Smoke Tests - API Routes', () => {
  let app;

  beforeAll(() => {
    // Mock container to avoid real DB connections
    const mockContainer = {
      userController: {
        getAll: jest.fn((req, res) => res.json({ success: true, data: [] })),
        getById: jest.fn((req, res) => res.json({ success: true, data: {} })),
      },
      authController: {
        login: jest.fn((req, res) => res.json({ success: true })),
      },
    };

    require('../../src/config/container').default = mockContainer;
    app = createApp();
  });

  test('should handle 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route-xyz');
    expect(res.statusCode).toBe(404);
  });

  test('should respond to OPTIONS requests (CORS preflight)', async () => {
    const res = await request(app).options('/health');
    expect([200, 204]).toContain(res.statusCode);
  });

  test('should set security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).toHaveProperty('x-content-type-options');
  });
});
