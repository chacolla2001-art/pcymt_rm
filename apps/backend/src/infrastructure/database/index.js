const { sequelize, connectDB, closeDB, healthCheck } = require('./connection');
const models = require('./models');

module.exports = {
  sequelize,
  connectDB,
  closeDB,
  healthCheck,
  ...models,
};
