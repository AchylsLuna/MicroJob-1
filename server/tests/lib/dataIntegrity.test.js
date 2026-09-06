import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { checkObjectIdValidators } from '../../lib/dataIntegrity.js';
import { objectIdPaths } from '../../lib/schemaObjectIdPaths.js';
import User from '../../models/User.js';
import Message from '../../models/Message.js';

let mongoServer;

const OBJECT_ID_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id'],
    properties: { _id: { bsonType: 'objectId' } },
  },
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'microjobs-integrity-test' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

test('objectIdPaths finds scalar, array, and subdocument ObjectId fields', () => {
  const messagePaths = objectIdPaths(Message.schema).map((entry) => entry.path);
  assert.ok(messagePaths.includes('sender'));
  assert.ok(messagePaths.includes('receiver'));

  const userPaths = objectIdPaths(User.schema);
  const blocked = userPaths.find((entry) => entry.path === 'blockedUsers');
  assert.ok(blocked, 'blockedUsers should be detected');
  assert.equal(blocked.array, true);

  assert.ok(
    userPaths.some((entry) => entry.path.includes('identityDocument.reviewedBy')),
    'nested reviewedBy should be detected'
  );
  assert.ok(!userPaths.some((entry) => entry.path === '_id'));
});

test('a collection validator rejects a string _id but accepts an ObjectId', async () => {
  const db = mongoose.connection.db;
  await db.createCollection('guarded', { validator: OBJECT_ID_VALIDATOR });

  await assert.rejects(
    () => db.collection('guarded').insertOne({ _id: '6a68e6639c600895167adc4c', name: 'imported' }),
    (error) => error.code === 121,
    'a string _id must be refused by the database'
  );

  const ok = await db.collection('guarded').insertOne({ _id: new mongoose.Types.ObjectId(), name: 'fine' });
  assert.ok(ok.acknowledged);
});

test('checkObjectIdValidators reports collections that lost their guard', async () => {
  const db = mongoose.connection.db;
  await db.createCollection('guarded', { validator: OBJECT_ID_VALIDATOR });
  await db.createCollection('bare');

  const result = await checkObjectIdValidators(mongoose.connection);

  assert.ok(result.unguarded.includes('bare'), 'an unguarded collection must be reported');
  assert.ok(!result.unguarded.includes('guarded'), 'a guarded collection must not be reported');
  assert.ok(result.checked >= 2);
});

test('checkObjectIdValidators reports nothing when every collection is guarded', async () => {
  const db = mongoose.connection.db;
  await db.createCollection('one', { validator: OBJECT_ID_VALIDATOR });
  await db.createCollection('two', { validator: OBJECT_ID_VALIDATOR });

  const result = await checkObjectIdValidators(mongoose.connection);
  assert.ok(!result.unguarded.includes('one'));
  assert.ok(!result.unguarded.includes('two'));
});

test('checkObjectIdValidators degrades quietly without a connection', async () => {
  const result = await checkObjectIdValidators({});
  assert.deepEqual(result, { checked: 0, unguarded: [] });
});
