import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import TrustedDevice from '../../models/TrustedDevice.js';
import {
  issueTrustedDevice,
  consumeTrustedDevice,
  hashDeviceToken,
  clearTrustedDevicesForUser,
  listTrustedDevicesForUser,
} from '../../lib/trustedDevice.js';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'trusted-device-tests' });
  await TrustedDevice.init();
});

beforeEach(() => TrustedDevice.deleteMany({}));

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const fakeUser = () => ({ _id: new mongoose.Types.ObjectId() });

test('issued tokens are stored only as a hash', async () => {
  const user = fakeUser();
  const { device, token } = await issueTrustedDevice(user, { ip: '127.0.0.1', label: 'Test UA' });

  const stored = await TrustedDevice.findById(device._id).select('+tokenHash').lean();
  assert.equal(stored.tokenHash, hashDeviceToken(token));
  assert.notEqual(stored.tokenHash, token);
  assert.equal(stored.label, 'Test UA');
});

test('consuming a valid token succeeds and rotates it', async () => {
  const user = fakeUser();
  const { token } = await issueTrustedDevice(user);

  const first = await consumeTrustedDevice({ token, userId: user._id });
  assert.ok(first);
  assert.notEqual(first.token, token);

  // The old token no longer works once rotated.
  const replay = await consumeTrustedDevice({ token, userId: user._id });
  assert.equal(replay, null);

  // The newly issued token does.
  const second = await consumeTrustedDevice({ token: first.token, userId: user._id });
  assert.ok(second);
});

test('consuming rejects a token for the wrong user', async () => {
  const user = fakeUser();
  const otherUser = fakeUser();
  const { token } = await issueTrustedDevice(user);

  const result = await consumeTrustedDevice({ token, userId: otherUser._id });
  assert.equal(result, null);
});

test('consuming rejects an expired device', async () => {
  const user = fakeUser();
  const { device, token } = await issueTrustedDevice(user);
  await TrustedDevice.updateOne({ _id: device._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

  const result = await consumeTrustedDevice({ token, userId: user._id });
  assert.equal(result, null);
});

test('clearTrustedDevicesForUser removes only that user\'s devices', async () => {
  const user = fakeUser();
  const otherUser = fakeUser();
  await issueTrustedDevice(user);
  await issueTrustedDevice(otherUser);

  await clearTrustedDevicesForUser(user._id);

  assert.equal(await TrustedDevice.countDocuments({ user: user._id }), 0);
  assert.equal(await TrustedDevice.countDocuments({ user: otherUser._id }), 1);
});

test('listTrustedDevicesForUser excludes expired devices and the token hash', async () => {
  const user = fakeUser();
  const { device: fresh } = await issueTrustedDevice(user, { label: 'Fresh' });
  const { device: expired } = await issueTrustedDevice(user, { label: 'Expired' });
  await TrustedDevice.updateOne({ _id: expired._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

  const list = await listTrustedDevicesForUser(user._id);
  assert.equal(list.length, 1);
  assert.equal(String(list[0]._id), String(fresh._id));
  assert.equal(list[0].tokenHash, undefined);
});
