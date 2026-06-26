const bcrypt = require('bcrypt');
const { User } = require('../../../src/infrastructure/database/models');

const TEST_PASSWORD = 'TestPassword123!';

async function createVerifiedUser({ email, role = 'user', name = 'Test User' }) {
  const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      name,
      email,
      password_hash,
      role,
      is_active: true,
      email_verified_at: new Date(),
    },
  });

  await user.update({
    name,
    password_hash,
    role,
    is_active: true,
    email_verified_at: new Date(),
  });

  return user;
}

async function removeTestUsers(emails) {
  await User.destroy({ where: { email: emails }, force: true });
}

module.exports = {
  TEST_PASSWORD,
  createVerifiedUser,
  removeTestUsers,
};
