/**
 * Integration Tests - Backend + Database
 * Pruebas completas de integración para verificar la interacción entre componentes
 */

const request = require('supertest');
const { createApp } = require('../../src/app');
const { connectDB, closeDB, sequelize } = require('../../src/infrastructure/database');
const { User, AnchorPoint, VirtualAsset, UserSession, UserInteraction } = require('../../src/infrastructure/database/models');

describe('🔗 Integration Tests - Complete System', () => {
  let app;
  let authToken;
  let adminToken;
  let testUserId;
  let testAnchorPointId;
  let testVirtualAssetId;

  // Usuario de prueba
  const testUser = {
    username: 'integration_test_user',
    email: 'integration@test.com',
    password: 'TestPassword123!',
    role: 'general'
  };

  // Administrador de prueba
  const adminUser = {
    username: 'admin_test',
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    role: 'admin'
  };

  beforeAll(async () => {
    console.log('🚀 Iniciando tests de integración...');
    await connectDB();
    app = createApp();
    
    // Limpiar datos de prueba anteriores
    await User.destroy({ where: { email: [testUser.email, adminUser.email] } });
    await AnchorPoint.destroy({ where: { name: { [sequelize.Op.like]: '%Test%' } } });
    await VirtualAsset.destroy({ where: { name: { [sequelize.Op.like]: '%Test%' } } });
  });

  afterAll(async () => {
    console.log('🧹 Limpiando datos de prueba...');
    // Cleanup
    if (testUserId) {
      await UserInteraction.destroy({ where: { user_id: testUserId } });
      await UserSession.destroy({ where: { user_id: testUserId } });
    }
    await User.destroy({ where: { email: [testUser.email, adminUser.email] } });
    if (testAnchorPointId) await AnchorPoint.destroy({ where: { id: testAnchorPointId } });
    if (testVirtualAssetId) await VirtualAsset.destroy({ where: { id: testVirtualAssetId } });
    
    await closeDB();
    console.log('✅ Tests de integración completados');
  });

  describe('📝 1. User Registration and Authentication Flow', () => {
    it('should create a new general user', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.role).toBe('general');
      
      testUserId = response.body.data.id;
      console.log(`✓ Usuario creado: ${testUserId}`);
    });

    it('should create an admin user', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send(adminUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
      console.log(`✓ Admin creado: ${response.body.data.id}`);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          login: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      
      authToken = response.body.data.token;
      console.log('✓ Login exitoso, token obtenido');
    });

    it('should login admin with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          login: adminUser.email,
          password: adminUser.password
        })
        .expect(200);

      adminToken = response.body.data.token;
      console.log('✓ Admin login exitoso');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          login: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
      expect(response.body.data.email).toBe(testUser.email);
      console.log('✓ Perfil de usuario obtenido correctamente');
    });

    it('should reject access without token', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('📍 2. Anchor Points Management', () => {
    const testAnchorPoint = {
      name: 'Test Anchor Point Integration',
      latitude: -16.5000,
      longitude: -68.1500,
      altitude: 3650,
      orientation: 90,
      section: 'Tierras Altas',
      description: 'Punto de anclaje de prueba para integración',
      is_active: true
    };

    it('should require admin role to create anchor point', async () => {
      const response = await request(app)
        .post('/api/v1/anchor-points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testAnchorPoint)
        .expect(403);

      expect(response.body.success).toBe(false);
      console.log('✓ Restricción de rol funcionando correctamente');
    });

    it('should create anchor point with admin token', async () => {
      const response = await request(app)
        .post('/api/v1/anchor-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testAnchorPoint)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(testAnchorPoint.name);
      
      testAnchorPointId = response.body.data.id;
      console.log(`✓ Anchor point creado: ${testAnchorPointId}`);
    });

    it('should get all anchor points without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/anchor-points')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      console.log(`✓ ${response.body.data.length} anchor points encontrados`);
    });

    it('should get specific anchor point by id', async () => {
      const response = await request(app)
        .get(`/api/v1/anchor-points/${testAnchorPointId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testAnchorPointId);
    });

    it('should update anchor point with admin token', async () => {
      const response = await request(app)
        .put(`/api/v1/anchor-points/${testAnchorPointId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Descripción actualizada en prueba de integración' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toContain('actualizada');
      console.log('✓ Anchor point actualizado correctamente');
    });
  });

  describe('🎨 3. Virtual Assets Management', () => {
    const testVirtualAsset = {
      name: 'Test Virtual Asset Integration',
      scientific_name: 'Testus integrationus',
      description: 'Asset virtual de prueba para integración',
      model_url: 'https://example.com/models/test.glb',
      icon_url: 'https://example.com/icons/test.png',
      category: 'fauna',
      habitat: 'test',
      is_active: true
    };

    it('should create virtual asset with admin token', async () => {
      const response = await request(app)
        .post('/api/v1/virtual-assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testVirtualAsset)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      
      testVirtualAssetId = response.body.data.id;
      console.log(`✓ Virtual asset creado: ${testVirtualAssetId}`);
    });

    it('should get all virtual assets', async () => {
      const response = await request(app)
        .get('/api/v1/virtual-assets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      console.log(`✓ ${response.body.data.length} virtual assets encontrados`);
    });

    it('should filter active virtual assets', async () => {
      const response = await request(app)
        .get('/api/v1/virtual-assets?is_active=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(asset => asset.is_active === true)).toBe(true);
    });

    it('should update virtual asset animation sequence', async () => {
      const animationSequence = [
        { name: 'idle', duration: 2.0, loop: true },
        { name: 'walk', duration: 1.5, loop: true }
      ];

      const response = await request(app)
        .put(`/api/v1/virtual-assets/${testVirtualAssetId}/animation-sequence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ animation_sequence: animationSequence })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.animation_sequence).toEqual(animationSequence);
      console.log('✓ Secuencia de animación actualizada');
    });
  });

  describe('📊 4. User Interactions and Sessions', () => {
    it('should create user session on login', async () => {
      const sessions = await UserSession.findAll({
        where: { user_id: testUserId },
        order: [['created_at', 'DESC']],
        limit: 1
      });

      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].user_id).toBe(testUserId);
      console.log('✓ Sesión de usuario creada correctamente');
    });

    it('should record user interaction', async () => {
      const response = await request(app)
        .post('/api/v1/interactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          virtual_asset_id: testVirtualAssetId,
          anchor_point_id: testAnchorPointId,
          interaction_type: 0, // view
          duration_seconds: 10
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      console.log('✓ Interacción de usuario registrada');
    });

    it('should get user interaction history', async () => {
      const response = await request(app)
        .get('/api/v1/interactions/my-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      console.log(`✓ ${response.body.data.length} interacciones en historial`);
    });
  });

  describe('📈 5. Analytics and Metrics', () => {
    it('should get users by role analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/users-by-role')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      console.log('✓ Análisis de usuarios por rol obtenido');
    });

    it('should get total counts', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/total-counts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('virtualAssets');
      expect(response.body.data).toHaveProperty('interactions');
      console.log('✓ Conteos totales obtenidos:', response.body.data);
    });

    it('should get top virtual assets', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/top-virtual-assets?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      console.log(`✓ Top ${response.body.data.length} virtual assets obtenidos`);
    });

    it('should get interactions by section', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/interactions-by-section')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      console.log('✓ Interacciones por sección obtenidas');
    });
  });

  describe('🔐 6. Authorization and Permissions', () => {
    it('should allow admin to list all users', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should deny general user from listing all users', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin to update user role', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'collaborator' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('collaborator');
      console.log('✓ Rol de usuario actualizado por admin');
    });

    it('should prevent user from changing their own role', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('🔍 7. Search and Filtering', () => {
    it('should filter anchor points by section', async () => {
      const response = await request(app)
        .get('/api/v1/anchor-points?section=Tierras%20Altas')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(ap => ap.section === 'Tierras Altas')).toBe(true);
    });

    it('should filter virtual assets by category', async () => {
      const response = await request(app)
        .get('/api/v1/virtual-assets?category=fauna')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(va => va.category === 'fauna')).toBe(true);
    });
  });

  describe('✅ 8. Data Validation', () => {
    it('should reject invalid email format', async () => {
      const invalidUser = { ...testUser, email: 'invalid-email', username: 'unique123' };
      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should reject invalid coordinates for anchor point', async () => {
      const invalidAnchor = {
        name: 'Invalid',
        latitude: 100, // Invalid
        longitude: 200, // Invalid
        section: 'Tierras Altas'
      };

      const response = await request(app)
        .post('/api/v1/anchor-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAnchor)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject empty required fields', async () => {
      const response = await request(app)
        .post('/api/v1/virtual-assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('🚀 9. Performance and Pagination', () => {
    it('should paginate users list', async () => {
      const response = await request(app)
        .get('/api/v1/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should handle large offset pagination', async () => {
      const response = await request(app)
        .get('/api/v1/virtual-assets?page=100&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('🔄 10. Complete User Journey', () => {
    it('should complete full user journey: register -> login -> view -> interact', async () => {
      // 1. Register
      const newUser = {
        username: 'journey_user',
        email: 'journey@test.com',
        password: 'JourneyPass123!',
        role: 'general'
      };

      const registerResponse = await request(app)
        .post('/api/v1/users')
        .send(newUser)
        .expect(201);

      const userId = registerResponse.body.data.id;

      // 2. Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          login: newUser.email,
          password: newUser.password
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // 3. View anchor points
      const anchorResponse = await request(app)
        .get('/api/v1/anchor-points')
        .expect(200);

      expect(anchorResponse.body.data.length).toBeGreaterThan(0);

      // 4. View virtual assets
      const assetsResponse = await request(app)
        .get('/api/v1/virtual-assets')
        .expect(200);

      expect(assetsResponse.body.data.length).toBeGreaterThan(0);

      // 5. Record interaction
      const interactionResponse = await request(app)
        .post('/api/v1/interactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          virtual_asset_id: testVirtualAssetId,
          anchor_point_id: testAnchorPointId,
          interaction_type: 1, // click
          duration_seconds: 30
        })
        .expect(201);

      expect(interactionResponse.body.success).toBe(true);

      // 6. View own profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.data.email).toBe(newUser.email);

      // 7. View interaction history
      const historyResponse = await request(app)
        .get('/api/v1/interactions/my-history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(historyResponse.body.data.length).toBeGreaterThan(0);

      // Cleanup
      await UserInteraction.destroy({ where: { user_id: userId } });
      await UserSession.destroy({ where: { user_id: userId } });
      await User.destroy({ where: { id: userId } });

      console.log('✓ Journey de usuario completo exitoso');
    });
  });
});
