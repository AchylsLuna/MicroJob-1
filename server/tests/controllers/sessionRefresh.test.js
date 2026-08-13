import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import AuditLog from '../../models/AuditLog.js';
import Session from '../../models/Session.js';
import User from '../../models/User.js';
import { refreshSession } from '../../controllers/SessionController.js';

let mongoServer;

const response = () => ({
  statusCode: 200,
  payload: null,
  cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
});

const request = (refreshToken) => ({
  body: { refreshToken },
  cookies: {},
  ip: '127.0.0.1',
  get(name) {
    const key = String(name).toLowerCase();
    if (key === 'x-microjobs-client') return 'native';
    if (key === 'user-agent') return 'MicroJobs test';
    return undefined;
  },
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'session-refresh-tests' });
});

beforeEach(() => Promise.all([Session.deleteMany({}), User.deleteMany({}), AuditLog.deleteMany({})]));

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

async function createRefreshFixture(status = 'active') {
  const user = new User({ firstName: 'Ana', lastName: 'Santos', email: `ana-${crypto.randomUUID()}@example.com`, role: 'work', status });
  await user.setPassword('SecurePass123!');
  await user.save();
  const refreshToken = crypto.randomBytes(32).toString('hex');
  await Session.create({
    user: user._id,
    active: true,
    refreshTokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return { user, refreshToken };
}

test('native refresh rotates once and rejects a concurrent replay', async () => {
  const { refreshToken } = await createRefreshFixture();
  const first = response();
  const second = response();
  await Promise.all([
    refreshSession(request(refreshToken), first),
    refreshSession(request(refreshToken), second),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 401]);
  const success = first.statusCode === 200 ? first : second;
  assert.match(success.payload.token, /^ey/);
  assert.match(success.payload.refreshToken, /^[a-f0-9]{128}$/);
});

test('refresh deactivates sessions for disabled accounts', async () => {
  const { refreshToken } = await createRefreshFixture('disabled');
  const result = response();
  await refreshSession(request(refreshToken), result);
  assert.equal(result.statusCode, 401);
  assert.equal(await Session.countDocuments({ active: true }), 0);
});
