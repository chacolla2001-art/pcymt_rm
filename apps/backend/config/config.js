require('dotenv').config();

const commonDbDefaults = {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mydb',
  username: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
};

// Mantener la configuración de la aplicación para uso interno
const appConfig = {
  app: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
  },
  db: {
    host: commonDbDefaults.host,
    name: commonDbDefaults.database,
    user: commonDbDefaults.username,
    password: commonDbDefaults.password,
    port: commonDbDefaults.port,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    tokenExpiration: process.env.JWT_EXPIRES_IN || '1h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

// Exportar configuración para Sequelize CLI (development/test/production)
const sequelizeConfig = {
  development: {
    url: process.env.DATABASE_URL || undefined,
    ...commonDbDefaults,
  },
  test: {
    url: process.env.DATABASE_URL || undefined,
    ...commonDbDefaults,
  },
  production: {
    url: process.env.DATABASE_URL || undefined,
    ...commonDbDefaults,
    dialectOptions: {
      // ejemplo: ssl: { rejectUnauthorized: false }
    },
  },
};

// Combinar para compatibilidad: Sequelize CLI cargará las keys `development|test|production`,
// y el resto del código puede seguir importando `app`/`db`/`auth`.
module.exports = Object.assign({}, sequelizeConfig, appConfig);
