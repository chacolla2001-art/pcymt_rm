'use strict';

/** Actualiza icon_url de virtual_assets y avatares a shared/uploads/model-icons */
module.exports = {
  async up(queryInterface) {
    const iconMap = {
      bear: 'bear',
      cattle: 'cattle',
      chicken: 'chicken',
      cow: 'cow',
      dog: 'dog',
      horse: 'horse',
      leopard: 'leopard',
      lizard: 'lizard',
      mermaid: 'reptile',
      pig: 'pig',
      tiger: 'tiger',
      viper: 'viper',
    };

    for (const [legacy, file] of Object.entries(iconMap)) {
      await queryInterface.sequelize.query(`
        UPDATE virtual_assets
        SET icon_url = '/api/files/model-icons/${file}.png',
            thumbnail_url = '/api/files/model-icons/${file}.png'
        WHERE icon_url LIKE '%/${legacy}.png'
           OR icon_url LIKE '%/${legacy}.png%'
      `);
    }

    await queryInterface.sequelize.query(`
      UPDATE users
      SET avatar_url = REPLACE(avatar_url, '/api/files/', '/api/files/model-icons/')
      WHERE avatar_url LIKE '/api/files/%.png'
        AND avatar_url NOT LIKE '/api/files/model-icons/%'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE virtual_assets
      SET icon_url = REPLACE(icon_url, '/api/files/model-icons/', '/api/files/'),
          thumbnail_url = REPLACE(thumbnail_url, '/api/files/model-icons/', '/api/files/')
      WHERE icon_url LIKE '/api/files/model-icons/%'
    `);
  },
};
