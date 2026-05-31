require('dotenv').config();

// Build DATABASE_URL from individual variables if not provided
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'pcymtrm_dev';
  const user = process.env.DB_USER || 'postgres';
  const pass = process.env.DB_PASSWORD || '';
  
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${name}`;
}

// SSL only for remote databases (Render, Railway, etc.)
const useSSL = process.env.DATABASE_URL?.includes('render.com') || 
               process.env.DATABASE_URL?.includes('railway.app') ||
               process.env.DB_SSL === 'true';

const sslConfig = useSSL ? {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
} : {};

module.exports = {
  development: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    logging: false
  },
  test: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    logging: false
  },
  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    dialectOptions: sslConfig,
    logging: false
  }
};
