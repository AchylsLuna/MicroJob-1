import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { reportConversation } from '../../controllers/MessageReportController.js';
import { listAdminModerationReports, updateAdminModerationReport } from '../../controllers/AdminModerationController.js';
import Message from '../../models/Message.js';
import ModerationReport from '../../models/ModerationReport.js';
import User from '../../models/User.js';
import { encodePublicId } from '../../lib/publicId.js';

let mongoServer;
const response = () => ({
  statusCode: 200, payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});
const participant = (name, role = 'work') => User.create({
  email: `${name}@report-test.example`, firstName: name, lastName: 'User',
  role, status: 'active', passwordHashed: 'not-used',
});
const submit = async (reporter, target, body = {}) => {
  const res = response();
  await reportConversation({ user: reporter ? { id: reporter._id } : undefined, body: {
    otherUserId: String(target._id), category: 'abuse', details: '', ...body,
  } }, res);
  return res;
};
before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'message-reports-test' });
  await Promise.all([User.init(), Message.init(), ModerationReport.init()]);
});
after(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), Message.deleteMany({}), ModerationReport.deleteMany({})]); });

for (const role of ['work', 'hire', 'admin']) {
  test(`${role} participants can report anyone without changing their account status`, async () => {
    const reporter = await participant('Reporter', role);
    const target = await participant('Target', 'admin');
    await Message.create({ sender: target._id, receiver: reporter._id, content: 'Send me your verification code.' });
    const res = await submit(reporter, target, { category: 'scam', details: 'Asked for my OTP.', otherUserId: encodePublicId(target._id) });
    assert.equal(res.statusCode, 201);
    const report = await ModerationReport.findById(res.payload.data.reportId).lean();
    assert.equal(report.targetName, 'Target User');
    assert.equal(String(report.reportedBy), String(reporter._id));
    assert.equal(report.reason, 'Suspected scam or fraud: Asked for my OTP.');
    assert.equal(report.status, 'pending');
    assert.equal(report.evidence[0].author, 'reportedUser');
    assert.equal((await User.findById(target._id)).status, 'active');
  });
}

test('requires authentication, a valid reason, and bounded text', async () => {
  const reporter = await participant('Reporter');
  const target = await participant('Target');
  assert.equal((await submit(null, target)).statusCode, 401);
  assert.equal((await submit(reporter, reporter)).statusCode, 400);
  for (const body of [{ otherUserId: 'invalid' }, { jobId: 'invalid' }, { category: 'fake' }, { category: ['abuse'] }, { details: {} }, { details: 'x'.repeat(1501) }]) {
    assert.equal((await submit(reporter, target, body)).statusCode, 400);
  }
  assert.equal(await ModerationReport.countDocuments(), 0);
});

test('rejects strangers and hidden chats and keeps job threads separate', async () => {
  const reporter = await participant('Reporter');
  const target = await participant('Target');
  const stranger = await participant('Stranger');
  const job = new mongoose.Types.ObjectId();
  const differentJob = new mongoose.Types.ObjectId();
  await Message.create({ sender: target._id, receiver: reporter._id, job, content: 'Job-scoped evidence.' });
  assert.equal((await submit(stranger, target, { jobId: String(job) })).statusCode, 403);
  assert.equal((await submit(reporter, target)).statusCode, 403);
  assert.equal((await submit(reporter, target, { jobId: String(differentJob) })).statusCode, 403);
  const res = await submit(reporter, target, { jobId: encodePublicId(job) });
  assert.equal(res.statusCode, 201);
  assert.equal(String((await ModerationReport.findOne()).conversationJob), String(job));
  await Message.updateMany({}, { $addToSet: { deletedFor: reporter._id } });
  assert.equal((await submit(reporter, target, { jobId: String(job) })).statusCode, 403);
});

test('snapshots only the latest visible messages, ignoring forged client evidence', async () => {
  const reporter = await participant('Reporter');
  const target = await participant('Target');
  await Message.insertMany(Array.from({ length: 25 }, (_, i) => ({
    sender: i % 2 ? reporter._id : target._id,
    receiver: i % 2 ? target._id : reporter._id,
    content: `Original ${i}`, createdAt: new Date(2026, 0, 1, 0, i),
  })));
  await Message.create({ sender: target._id, receiver: reporter._id, content: 'Hidden text', deletedFor: [reporter._id] });
  await Message.create({ sender: target._id, receiver: reporter._id, job: new mongoose.Types.ObjectId(), content: 'Unrelated job text' });
  const res = await submit(reporter, target, { targetName: 'Forged name', reportedBy: target._id, evidence: [{ content: 'Forged evidence' }] });
  assert.equal(res.statusCode, 201);
  await Message.updateMany({}, { $set: { content: 'Edited text' } });
  await Message.deleteMany({});
  const admin = response();
  await listAdminModerationReports({}, admin);
  const report = admin.payload[0];
  assert.equal(report.source, 'message');
  assert.equal(report.targetName, 'Target User');
  assert.equal(report.reportedBy, 'Reporter User');
  assert.equal(report.evidence.length, 20);
  assert.equal(report.evidence[0].content, 'Original 5');
  assert.equal(report.evidence[0].author, 'reporter');
  assert.equal(report.evidence[19].content, 'Original 24');
});

test('deduplicates concurrent pending reports and permits a report after review', async () => {
  const reporter = await participant('Reporter');
  const target = await participant('Target');
  const admin = await participant('Admin', 'admin');
  await Message.create({ sender: target._id, receiver: reporter._id, content: 'Abusive message' });
  const responses = await Promise.all([submit(reporter, target), submit(reporter, target)]);
  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [200, 201]);
  assert.equal(String(responses[0].payload.data.reportId), String(responses[1].payload.data.reportId));
  assert.equal(await ModerationReport.countDocuments(), 1);
  const resolved = response();
  await updateAdminModerationReport({ user: { id: admin._id }, params: { reportId: responses[0].payload.data.reportId }, body: { status: 'dismissed' } }, resolved);
  assert.equal(resolved.statusCode, 200);
  assert.equal((await submit(reporter, target)).statusCode, 201);
  assert.equal(await ModerationReport.countDocuments(), 2);
});
