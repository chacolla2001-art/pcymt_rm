/**
 * Reset Database Script
 * Drops all tables and recreates the schema to allow fresh migrations
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Sequelize } = require('sequelize');

async function resetDatabase() {
  // Use DATABASE_URL directly
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL no está configurado en .env');
    process.exit(1);
  }

  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: console.log
  });

  try {
    console.log('📦 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');

    console.log('🗑️  Eliminando schema public...');
    await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE;');
    console.log('✅ Schema eliminado');

    console.log('🔧 Recreando schema public...');
    await sequelize.query('CREATE SCHEMA public;');
    console.log('✅ Schema recreado');

    console.log('🎉 Base de datos reiniciada exitosamente');
    console.log('📝 Ahora puedes ejecutar: npx sequelize-cli db:migrate');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

resetDatabase();
