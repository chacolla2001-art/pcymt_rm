const request = require('supertest');

// Mock database module before requiring app
jest.mock('../../src/infrastructure/database', () => ({
  healthCheck: jest.fn().mockResolvedValue(true),
  connectDB: jest.fn().mockResolvedValue(true),
  closeDB: jest.fn().mockResolvedValue(true),
}));

const { createApp } = require('../../src/app');

describe('Smoke Tests - Health Endpoint', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    test('should return 200 status code', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
    });

    test('should return JSON with success property', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('success');
      expect(res.body.success).toBe(true);
    });

    test('should include timestamp', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
    });

    test('should include uptime in seconds', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should include database check status', async () => {
      const res = await request(app).get('/health');
      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks.database).toBe('ok');
    });

    test('should include memory usage info', async () => {
      const res = await request(app).get('/health');
      expect(res.body.checks).toHaveProperty('memory');
      expect(res.body.checks.memory).toHaveProperty('used');
      expect(res.body.checks.memory).toHaveProperty('total');
      expect(res.body.checks.memory).toHaveProperty('unit', 'MB');
    });
  });
});
