'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

/** Datos demo: visitantes, sesiones e interacciones para estadísticas realistas */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD || 'Cybercenter1', 10);

    const visitorNames = [
      'María Quispe', 'Juan Mamani', 'Ana Flores', 'Luis Condori', 'Rosa Choque',
      'Carlos Huanca', 'Elena Rojas', 'Pedro Velasco', 'Lucía Arce', 'Diego Salazar',
      'Valentina Cruz', 'Miguel Torrez', 'Camila Paredes', 'Andrés Vargas',
    ];

    const users = visitorNames.map((name, i) => ({
      id: `650e8400-e29b-41d4-a716-44665544${String(i + 10).padStart(4, '0')}`,
      name,
      email: `visitante${i + 1}@pcymt.demo`,
      password_hash: passwordHash,
      google_id: null,
      role: i === 0 ? 'moderator' : 'user',
      is_active: true,
      avatar_url: `/api/files/model-icons/${['bear', 'horse', 'cow', 'dog', 'leopard', 'pig', 'chicken', 'viper'][i % 8]}.png`,
      email_verified_at: now,
      last_login_at: new Date(now.getTime() - (i + 1) * 3600000 * 6),
      created_at: new Date(now.getTime() - (i + 5) * 86400000),
      updated_at: now,
    }));

    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'visitante%@pcymt.demo'`,
    );
    if (existing[0].count === 0) {
      await queryInterface.bulkInsert('users', users);
    }

    const [existingSessions] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM sessions WHERE id::text LIKE '880e8400-%'`,
    );
    if (existingSessions[0].count > 0) {
      return;
    }

    const assetIds = [
      '660e8400-e29b-41d4-a716-446655440001',
      '660e8400-e29b-41d4-a716-446655440002',
      '660e8400-e29b-41d4-a716-446655440003',
      '660e8400-e29b-41d4-a716-446655440004',
      '660e8400-e29b-41d4-a716-446655440005',
      '660e8400-e29b-41d4-a716-446655440006',
      '660e8400-e29b-41d4-a716-446655440007',
      '660e8400-e29b-41d4-a716-446655440008',
      '660e8400-e29b-41d4-a716-446655440009',
      '660e8400-e29b-41d4-a716-446655440010',
      '660e8400-e29b-41d4-a716-446655440011',
      '660e8400-e29b-41d4-a716-446655440012',
    ];

    const locationIds = [
      '770e8400-e29b-41d4-a716-446655440001',
      '770e8400-e29b-41d4-a716-446655440002',
      '770e8400-e29b-41d4-a716-446655440003',
      '770e8400-e29b-41d4-a716-446655440004',
      '770e8400-e29b-41d4-a716-446655440005',
      '770e8400-e29b-41d4-a716-446655440006',
      '770e8400-e29b-41d4-a716-446655440007',
      '770e8400-e29b-41d4-a716-446655440008',
      '770e8400-e29b-41d4-a716-446655440009',
      '770e8400-e29b-41d4-a716-446655440010',
      '770e8400-e29b-41d4-a716-446655440011',
      '770e8400-e29b-41d4-a716-446655440012',
    ];

    const sessions = [];
    const interactions = [];
    const types = ['view', 'scan', 'click', 'favorite', 'share'];
    let sessionIdx = 0;
    let interactionIdx = 0;

    for (let u = 0; u < users.length; u++) {
      const sessionCount = 2 + (u % 4);
      for (let s = 0; s < sessionCount; s++) {
        sessionIdx += 1;
        const loggedIn = new Date(now.getTime() - (u * 2 + s) * 86400000 - 3600000);
        const duration = 600 + Math.floor(Math.random() * 5400);
        sessions.push({
          id: `880e8400-e29b-41d4-a716-44665544${String(sessionIdx).padStart(4, '0')}`,
          user_id: users[u].id,
          platform: s % 3 === 0 ? 'web' : 'mobile',
          ip_address: `181.115.${10 + u}.${20 + s}`,
          user_agent: s % 2 === 0 ? 'Mozilla/5.0 (Android)' : 'Mozilla/5.0 (Windows)',
          logged_in_at: loggedIn,
          logged_out_at: new Date(loggedIn.getTime() + duration * 1000),
          session_duration_seconds: duration,
        });

        const interactionCount = 3 + (u + s) % 8;
        for (let k = 0; k < interactionCount; k++) {
          interactionIdx += 1;
          const assetIdx = (u + k) % assetIds.length;
          interactions.push({
            id: `990e8400-e29b-41d4-a716-44665544${String(interactionIdx).padStart(4, '0')}`,
            user_id: users[u].id,
            virtual_asset_id: assetIds[assetIdx],
            location_id: locationIds[assetIdx],
            interaction_type: types[(u + k) % types.length],
            metadata: JSON.stringify({ section: ['Tierras Altas', 'Tierras Medias', 'Tierras Bajas', 'Mitos y Leyendas'][assetIdx % 4] }),
            created_at: new Date(loggedIn.getTime() + k * 120000),
          });
        }
      }
    }

    await queryInterface.bulkInsert('sessions', sessions);
    await queryInterface.bulkInsert('interactions', interactions);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('interactions', {
      id: { [Op.like]: '990e8400-%' },
    }, {});
    await queryInterface.bulkDelete('sessions', {
      id: { [Op.like]: '880e8400-%' },
    }, {});
    await queryInterface.bulkDelete('users', {
      email: { [Op.like]: 'visitante%@pcymt.demo' },
    }, {});
  },
};
