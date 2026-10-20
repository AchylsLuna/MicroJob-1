import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import Message from '../../models/Message.js';
import Notification from '../../models/Notification.js';
import '../../models/QrSettlementRequest.js';
import '../../models/JobOffer.js';
import MessageRoute from '../../routes/MessageRoute.js';
import { createSessionWithTokens, createAccessToken } from '../../lib/authSession.js';

let mongoServer;
let httpServer;
let baseUrl;
before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'message-recipients-tests' });
  const app = express();
  app.use(express.json());
  app.use('/messages', MessageRoute);
  httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});
after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});
beforeEach(() => Promise.all([User.deleteMany({}), Session.deleteMany({}), Message.deleteMany({}), Notification.deleteMany({})]));

const person = (email, extra = {}) => User.create({ email, firstName: 'Test', lastName: 'Person', role: 'work', status: 'active', passwordHashed: 'not-used', ...extra });
async function sessionFor(user) {
  return createSessionWithTokens({ ip: '127.0.0.1', get: () => 'Directory test' }, user);
}
async function directory(session, query = '') {
  const res = await fetch(`${baseUrl}/messages/recipients${query}`, { headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {} });
  return { status: res.status, payload: await res.json() };
}

test('the HTTP directory requires authenticated staff access and rejects forged role claims', async () => {
  assert.equal((await directory()).status, 401);
  for (const [role, staffRole] of [['work', null], ['hire', null], ['both', null], ['work', 'admin_team']]) {
    const user = await person(`${role}-${staffRole}@directory.example`, { role, staffRole });
    const session = await sessionFor(user);
    assert.equal((await directory(session)).status, 403);
    const forgedSession = { ...session, accessToken: createAccessToken({ _id: user._id, role: 'superadmin' }, session.sessionId) };
    assert.equal((await directory(forgedSession)).status, 403, 'the persisted role takes precedence over the token claim');
  }
});

test('every admin staff role can find recipients and send warnings with recipient notifications', async () => {
  const recipients = await Promise.all(['work', 'hire', 'both'].map((role) => person(`${role}@directory.example`, { role })));
  const staffRoles = ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff', null];
  for (const staffRole of staffRoles) {
    const sender = await person(`${staffRole || 'legacy'}@directory.example`, { role: 'admin', staffRole });
    const session = await sessionFor(sender);
    const result = await directory(session, '?audience=users');
    assert.equal(result.status, 200, `directory access for ${staffRole || 'legacy admin'}`);
    assert.deepEqual(new Set(result.payload.data.recipients.map((row) => row.id)), new Set(recipients.map((user) => String(user._id))));
    for (const recipient of recipients) {
      const content = 'Possible scam: please review the suspicious job message.';
      const response = await fetch(`${baseUrl}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: String(recipient._id), content }) });
      const payload = await response.json();
      assert.equal(response.status, 201, payload.error || payload.message);
      const message = await Message.findOne({ sender: sender._id, receiver: recipient._id });
      assert.equal(message.content, content);
      const notification = await Notification.findOne({ user: recipient._id, actor: sender._id, type: 'message' });
      assert.ok(notification, `notification from ${staffRole || 'legacy admin'} to ${recipient.role}`);
      assert.equal(notification.message, content);
      assert.equal(notification.entityId, String(message._id));
      assert.equal(notification.metadata.senderId, String(sender._id));
      assert.equal(notification.audience, recipient.role === 'work' ? 'worker' : recipient.role === 'hire' ? 'employer' : 'shared');
      assert.equal(notification.readAt, null);
    }
  }
});

test('superadmin finds staff and marketplace recipients without exposing private account fields', async () => {
  const owner = await person('owner@directory.example', { role: 'superadmin' });
  const staff = await person('finance@directory.example', { role: 'admin', staffRole: 'finance_team', firstName: 'Ana', lastName: 'Finance', phoneNumber: '09171234567' });
  const worker = await person('maria@directory.example', { firstName: 'Maria', lastName: 'Santos', username: 'maria.worker' });
  const employer = await person('shop@directory.example', { role: 'hire', companyName: 'Local Shop' });
  for (const status of ['pending', 'disabled', 'banned', 'deleted']) await person(`${status}@directory.example`, { status });
  const session = await sessionFor(owner);
  const all = await directory(session);
  assert.equal(all.status, 200);
  assert.equal(all.payload.data.total, 3);
  const rows = all.payload.data.recipients;
  assert.equal(rows.some((row) => row.id === String(owner._id)), false);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['email', 'id', 'isStaff', 'name', 'role']);
  assert.equal(rows.find((row) => row.id === String(staff._id)).role, 'finance_team');
  assert.equal(rows.find((row) => row.id === String(staff._id)).isStaff, true);
  const admins = await directory(session, '?audience=admins');
  assert.deepEqual(admins.payload.data.recipients.map((row) => row.id), [String(staff._id)]);
  const users = await directory(session, '?audience=users');
  assert.equal(users.payload.data.total, 2);
  assert.equal(users.payload.data.recipients.every((row) => !row.isStaff), true);
  assert.ok(users.payload.data.recipients.some((row) => row.id === String(employer._id)));
  const fullName = await directory(session, '?search=Maria%20Santos');
  assert.deepEqual(fullName.payload.data.recipients.map((row) => row.id), [String(worker._id)]);
  assert.equal((await directory(session, '?search=MARIA%40directory.example')).payload.data.total, 1);
  assert.equal((await directory(session, '?search=maria.worker')).payload.data.total, 1);
  assert.equal((await directory(session, '?search=Local%20Shop')).payload.data.total, 1);
  assert.equal((await directory(session, '?search=.*')).payload.data.total, 0, 'search metacharacters are literal text');
  assert.equal((await directory(session, '?audience=unsupported')).status, 400);
});

test('recipient pagination stays bounded and clamps out-of-range pages', async () => {
  const owner = await person('owner@directory.example', { role: 'superadmin' });
  await User.insertMany(Array.from({ length: 23 }, (_, index) => ({ email: `person-${index}@directory.example`, firstName: `Person ${String(index).padStart(2, '0')}`, lastName: 'User', role: 'work', status: 'active', passwordHashed: 'not-used' })));
  const session = await sessionFor(owner);
  const first = (await directory(session)).payload.data;
  const last = (await directory(session, '?page=999999')).payload.data;
  assert.equal(first.recipients.length, 20);
  assert.equal(first.total, 23);
  assert.equal(last.page, 2);
  assert.equal(last.recipients.length, 3);
  assert.equal(new Set([...first.recipients, ...last.recipients].map((row) => row.id)).size, 23);
  assert.equal((await directory(session, '?page=-10')).payload.data.page, 1);
});

test('superadmin can use the existing delivery endpoint with every staff and marketplace role', async () => {
  const owner = await person('owner@directory.example', { role: 'superadmin' });
  const session = await sessionFor(owner);
  const roles = [
    ...['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff'].map((staffRole) => ({ role: 'admin', staffRole })),
    ...['work', 'hire', 'both', 'superadmin'].map((role) => ({ role })),
  ];
  for (const [index, extra] of roles.entries()) {
    const recipient = await person(`recipient-${index}@directory.example`, extra);
    const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: String(recipient._id), content: 'Test-only direct message.' }) });
    const payload = await res.json();
    assert.equal(res.status, 201, payload.error || payload.message);
    const stored = await Message.findOne({ sender: owner._id, receiver: recipient._id });
    assert.equal(stored.content, 'Test-only direct message.');
  }
});
