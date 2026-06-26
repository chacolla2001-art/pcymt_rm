const request = require('supertest');
const { createApp } = require('../../src/app');
const { connectDB, closeDB } = require('../../src/infrastructure/database');
const {
  TEST_PASSWORD,
  createVerifiedUser,
  removeTestUsers,
} = require('./helpers/db-test-helper');

const VISITOR_EMAIL = 'rbac-visitor@test.local';
const STAFF_EMAIL = 'rbac-staff@test.local';

describe('API RBAC integration', () => {
  let app;
  let visitorToken;
  let staffToken;
  let visitorId;
  let staffId;

  beforeAll(async () => {
    await connectDB();
    app = createApp();

    const visitor = await createVerifiedUser({
      email: VISITOR_EMAIL,
      role: 'user',
      name: 'Visitor Test',
    });
    const staff = await createVerifiedUser({
      email: STAFF_EMAIL,
      role: 'admin',
      name: 'Staff Test',
    });
    visitorId = visitor.id;
    staffId = staff.id;

    const visitorLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: VISITOR_EMAIL, password: TEST_PASSWORD, platform: 'mobile' });
    visitorToken = visitorLogin.body.data.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: STAFF_EMAIL, password: TEST_PASSWORD, platform: 'web' });
    staffToken = staffLogin.body.data.token;
  }, 30000);

  afterAll(async () => {
    await removeTestUsers([VISITOR_EMAIL, STAFF_EMAIL]);
    await closeDB();
  });

  describe('Authentication', () => {
    it('GET /api/auth/me returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/me returns current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${visitorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(VISITOR_EMAIL);
    });

    it('POST /api/auth/login rejects invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: VISITOR_EMAIL, password: 'WrongPass123!', platform: 'web' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Staff-only routes', () => {
    it('GET /api/users returns 403 for visitor role', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${visitorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/users returns 200 for staff role', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });

    it('GET /api/analytics/totals returns 403 for visitor role', async () => {
      const res = await request(app)
        .get('/api/analytics/totals')
        .set('Authorization', `Bearer ${visitorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Avatar', () => {
    it('PATCH /api/users/:id/avatar updates own avatar', async () => {
      const res = await request(app)
        .patch(`/api/users/${visitorId}/avatar`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ avatar_id: 'bear' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.avatar_url).toContain('/api/files/model-icons/bear.png');
    });

    it('PATCH /api/users/:id/avatar rejects invalid avatar_id', async () => {
      const res = await request(app)
        .patch(`/api/users/${visitorId}/avatar`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ avatar_id: 'invalid-animal' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('PATCH /api/users/:id/avatar returns 403 for another user', async () => {
      const res = await request(app)
        .patch(`/api/users/${staffId}/avatar`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ avatar_id: 'dog' });

      expect(res.status).toBe(403);
    });
  });

  describe('Protected files', () => {
    it('GET /api/files/:filename returns 401 without token', async () => {
      const res = await request(app).get('/api/files/bear.png');
      expect(res.status).toBe(401);
    });

    it('GET /api/files/:folder/:filename accepts token query param', async () => {
      const res = await request(app).get(
        `/api/files/model-icons/bear.png?token=${visitorToken}`,
      );
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Public config', () => {
    it('GET /api/config returns park feature flags without auth', async () => {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
