const database = require('./database');
const external = require('./external');

module.exports = {
  ...database,
  ...external,
};
