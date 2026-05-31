const controllers = require('./controllers');
const middlewares = require('./middlewares');
const createRoutes = require('./routes');

module.exports = {
  ...controllers,
  ...middlewares,
  createRoutes,
};
