import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import AuditLog from '../../models/AuditLog.js';
import adminAuditLog from '../../middleware/adminAuditLog.js';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'admin-audit-log-tests' });
});

beforeEach(async () => {
  await AuditLog.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const makeRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const makeReq = ({ method = 'PATCH', user, params = {}, body = {} }) => ({
  method,
  user,
  params,
  body,
  baseUrl: '/api/admin',
  route: { path: '/staff/:userId' },
  originalUrl: '/api/admin/staff/abc',
  ip: '127.0.0.1',
  get: () => 'audit-log-test',
});

// The middleware writes fire-and-forget on res 'finish', so poll rather than
// sleep a fixed interval — under full-suite load a fixed wait flakes.
const waitForLogs = async (expected) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await AuditLog.countDocuments({})) >= expected) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

const STAFF_ROLES = ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff'];

test('every admin staff role has its mutating action logged', async () => {
  for (const staffRole of STAFF_ROLES) {
    await AuditLog.deleteMany({});
    const req = makeReq({ user: { id: new mongoose.Types.ObjectId().toString(), role: 'admin', staffRole }, params: { userId: 'target-1' } });
    const res = makeRes();
    adminAuditLog(req, res, () => {});
    res.json({ message: 'ok' });
    res.emit('finish');
    await waitForLogs(1);

    const logs = await AuditLog.find({}).lean();
    assert.equal(logs.length, 1, `expected one audit log for ${staffRole}`);
    assert.equal(logs[0].actorRole, staffRole);
    assert.equal(logs[0].action, 'PATCH /api/admin/staff/:userId');
    assert.equal(logs[0].target, 'target-1');
    assert.equal(logs[0].category, 'system');
  }
});

test('superadmin actions are logged with the superadmin role', async () => {
  const req = makeReq({ user: { id: new mongoose.Types.ObjectId().toString(), role: 'superadmin' }, params: { userId: 'target-2' } });
  const res = makeRes();
  adminAuditLog(req, res, () => {});
  res.json({ message: 'ok' });
  res.emit('finish');
  await waitForLogs(1);

  const logs = await AuditLog.find({}).lean();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorRole, 'superadmin');
});

test('a failed action is logged as an error with its reason', async () => {
  const req = makeReq({ user: { id: new mongoose.Types.ObjectId().toString(), role: 'admin', staffRole: 'moderator' }, params: { userId: 'target-3' } });
  const res = makeRes();
  adminAuditLog(req, res, () => {});
  res.statusCode = 403;
  res.json({ message: 'You do not have permission to perform this action.' });
  res.emit('finish');
  await waitForLogs(1);

  const logs = await AuditLog.find({}).lean();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].category, 'error');
  assert.equal(logs[0].reason, 'You do not have permission to perform this action.');
});

test('read-only requests are not logged', async () => {
  const req = makeReq({ method: 'GET', user: { id: new mongoose.Types.ObjectId().toString(), role: 'admin', staffRole: 'admin_team' } });
  const res = makeRes();
  adminAuditLog(req, res, () => {});
  res.json([]);
  res.emit('finish');
  // Nothing should ever arrive here, so give a write the chance to land and
  // confirm none did, rather than polling for something that never comes.
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(await AuditLog.countDocuments({}), 0);
});
