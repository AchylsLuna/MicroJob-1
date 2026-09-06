import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { ensureDevDemoUser, ensureDevSuperAdmin } from '../../lib/devSeed.js';
import User from '../../models/User.js';

let mongoServer;

const SUPERADMIN_EMAIL = 'superadmin@microjobs.test';
const DEMO_EMAIL = 'demo@microjobs.test';

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'microjobs-devseed-test' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  process.env.AUTO_SEED_SUPERADMIN = 'true';
  process.env.AUTO_SEED_DEMO_USER = 'true';
  process.env.SUPERADMIN_EMAIL = SUPERADMIN_EMAIL;
  process.env.SUPERADMIN_PASSWORD = 'SuperAdmin123!';
  process.env.DEMO_USER_EMAIL = DEMO_EMAIL;
  process.env.DEMO_USER_PASSWORD = 'User12345!';
  delete process.env.SUPERADMIN_RESET_PASSWORD;
  delete process.env.DEMO_USER_RESET_PASSWORD;
});

test('ensureDevSuperAdmin creates an active superadmin that can log in', async () => {
  await ensureDevSuperAdmin({ isProduction: false });

  const user = await User.findOne({ email: SUPERADMIN_EMAIL }).select('+passwordHashed');
  assert.equal(user.role, 'superadmin');
  assert.equal(user.status, 'active');
  assert.equal(await user.validatePassword('SuperAdmin123!'), true);
});

test('ensureDevSuperAdmin normalizes an existing downgraded account without duplicating it', async () => {
  const seeded = new User({
    email: SUPERADMIN_EMAIL,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'work',
    status: 'disabled',
  });
  await seeded.setPassword('SuperAdmin123!');
  await seeded.save();

  await ensureDevSuperAdmin({ isProduction: false });

  const users = await User.find({ email: SUPERADMIN_EMAIL });
  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'superadmin');
  assert.equal(users[0].status, 'active');
  assert.equal(String(users[0]._id), String(seeded._id));
});

// Regression: the seed used to findOne() then save(), so a concurrent
// delete/recreate of the same account left it updating a stale _id and mongoose
// threw DocumentNotFoundError, taking down server startup.
test('ensureDevSuperAdmin survives the account being replaced with a new _id mid-seed', async () => {
  const original = new User({
    email: SUPERADMIN_EMAIL,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'work',
    status: 'disabled',
  });
  await original.setPassword('SuperAdmin123!');
  await original.save();

  const originalExists = User.exists.bind(User);
  User.exists = async (filter) => {
    const result = await originalExists(filter);
    await User.deleteOne({ email: SUPERADMIN_EMAIL });
    const replacement = new User({
      email: SUPERADMIN_EMAIL,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'work',
      status: 'disabled',
    });
    await replacement.setPassword('SuperAdmin123!');
    await replacement.save();
    return result;
  };

  try {
    await ensureDevSuperAdmin({ isProduction: false });
  } finally {
    User.exists = originalExists;
  }

  const users = await User.find({ email: SUPERADMIN_EMAIL });
  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'superadmin');
  assert.equal(users[0].status, 'active');
  assert.notEqual(String(users[0]._id), String(original._id));
});

test('ensureDevSuperAdmin is idempotent across repeated startups', async () => {
  await ensureDevSuperAdmin({ isProduction: false });
  const first = await User.findOne({ email: SUPERADMIN_EMAIL }).select('+passwordHashed');

  await ensureDevSuperAdmin({ isProduction: false });
  const second = await User.findOne({ email: SUPERADMIN_EMAIL }).select('+passwordHashed');

  assert.equal(await User.countDocuments({ email: SUPERADMIN_EMAIL }), 1);
  assert.equal(String(first._id), String(second._id));
  assert.equal(first.passwordHashed, second.passwordHashed);
});

test('ensureDevSuperAdmin rehashes the password only when the reset flag is set', async () => {
  await ensureDevSuperAdmin({ isProduction: false });
  const before = await User.findOne({ email: SUPERADMIN_EMAIL }).select('+passwordHashed');

  process.env.SUPERADMIN_RESET_PASSWORD = 'true';
  process.env.SUPERADMIN_PASSWORD = 'RotatedPass456!';
  await ensureDevSuperAdmin({ isProduction: false });

  const after = await User.findOne({ email: SUPERADMIN_EMAIL }).select('+passwordHashed');
  assert.notEqual(before.passwordHashed, after.passwordHashed);
  assert.equal(await after.validatePassword('RotatedPass456!'), true);
});

test('dev seeding is skipped in production and when the flag is off', async () => {
  await ensureDevSuperAdmin({ isProduction: true });
  await ensureDevDemoUser({ isProduction: true });
  assert.equal(await User.countDocuments({}), 0);

  process.env.AUTO_SEED_SUPERADMIN = 'false';
  process.env.AUTO_SEED_DEMO_USER = 'false';
  await ensureDevSuperAdmin({ isProduction: false });
  await ensureDevDemoUser({ isProduction: false });
  assert.equal(await User.countDocuments({}), 0);
});

test('ensureDevDemoUser seeds defaults and preserves a dev-edited address', async () => {
  process.env.DEMO_USER_CITY = 'Quezon City';
  process.env.DEMO_USER_PROVINCE = 'Metro Manila';

  await ensureDevDemoUser({ isProduction: false });
  const seeded = await User.findOne({ email: DEMO_EMAIL });
  assert.equal(seeded.role, 'work');
  assert.equal(seeded.status, 'active');
  assert.equal(seeded.city, 'Quezon City');

  await User.updateOne({ email: DEMO_EMAIL }, { $set: { city: 'Cebu City' } });
  await ensureDevDemoUser({ isProduction: false });

  const after = await User.findOne({ email: DEMO_EMAIL });
  assert.equal(after.city, 'Cebu City');
  assert.equal(await User.countDocuments({ email: DEMO_EMAIL }), 1);
});

test('ensureDevDemoUser falls back to the work role when given an invalid role', async () => {
  process.env.DEMO_USER_ROLE = 'not-a-role';
  await ensureDevDemoUser({ isProduction: false });

  const user = await User.findOne({ email: DEMO_EMAIL });
  assert.equal(user.role, 'work');
  delete process.env.DEMO_USER_ROLE;
});
