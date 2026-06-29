const {
  sequelize,
  connectDB,
  closeDB,
  healthCheck,
  startDBConnection,
  ensureDB,
} = require('./connection');
const models = require('./models');

module.exports = {
  sequelize,
  connectDB,
  closeDB,
  healthCheck,
  startDBConnection,
  ensureDB,
  ...models,
};
