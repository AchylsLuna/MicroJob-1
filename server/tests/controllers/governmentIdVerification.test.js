import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import IdAnalyzer from 'idanalyzer2';
import User from '../../models/User.js';
import PendingIdScan from '../../models/PendingIdScan.js';
import GovernmentIdVerification from '../../models/GovernmentIdVerification.js';
import { savePendingScan } from '../../models/IdAnalyzerModel.js';
import { verifyIdDocument, confirmIdVerification } from '../../controllers/IdAnalyzerController.js';
import { getGovernmentIdVerifications, revokeGovernmentIdVerification } from '../../controllers/AdminGovernmentIdController.js';
import { updateAdminVerification } from '../../controllers/AdminController.js';
import { getVerificationStatus } from '../../controllers/verificationController.js';
import { anonymizeAndDeleteUser } from '../../controllers/UserController.js';

let mongo;
let user;
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const scan = (extra = {}) => ({
  decision: 'accept', profileMatch: true, accepted: true,
  selectedDocumentType: 'Philippine Passport',
  extracted: { fullName: 'Alex Maria Santos', firstName: 'Alex', lastName: 'Santos' },
  ...extra,
});
const confirm = async () => {
  const res = response();
  await confirmIdVerification({ user: { id: String(user._id) } }, res);
  return res;
};

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'government-id-verification' });
  await Promise.all([User.init(), PendingIdScan.init(), GovernmentIdVerification.init()]);
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), PendingIdScan.deleteMany({}), GovernmentIdVerification.deleteMany({})]);
  user = new User({ firstName: 'Alex', lastName: 'Santos', email: 'alex-id@example.ph', role: 'work', status: 'active', verification: { emailVerified: true, phoneVerified: true, addressVerified: true, addressDocument: { status: 'complete', documentUrl: '/uploads/address.pdf' } } });
  await user.setPassword('Password123!');
  await user.save();
});

test('only successful confirmation records the provider name/type/date, consumes the scan, and cannot be replayed', async () => {
  await savePendingScan(user._id, scan());
  assert.equal(await GovernmentIdVerification.countDocuments(), 0);
  const result = await confirm();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.verified, true);
  const record = await GovernmentIdVerification.findOne({ user: user._id }).lean();
  const savedUser = await User.findById(user._id);
  assert.equal(record.userName, 'Alex Santos');
  assert.equal(record.govIdName, 'Alex Maria Santos');
  assert.equal(record.documentType, 'Philippine Passport');
  assert.equal(record.date.getTime(), savedUser.verification.identityDocument.reviewedAt.getTime());
  assert.equal(record.verified, true);
  assert.equal(savedUser.verification.identityVerified, true);
  assert.equal(savedUser.verification.identityDocument.status, 'complete');
  assert.equal(await PendingIdScan.countDocuments(), 0);
  assert.equal((await confirm()).statusCode, 400);
  assert.equal(await GovernmentIdVerification.countDocuments(), 1);
});

test('concurrent confirmation consumes one pending scan only once', async () => {
  await savePendingScan(user._id, scan());
  const results = await Promise.all([confirm(), confirm()]);
  assert.deepEqual(results.map((res) => res.statusCode).sort(), [200, 400]);
  assert.equal(await GovernmentIdVerification.countDocuments(), 1);
  assert.equal(await PendingIdScan.countDocuments(), 0);
});

test('direct finalization records the provider full name and clears older pending scans', async () => {
  const previousKey = process.env.IDANALYZER_KEY;
  const previousProfile = process.env.KYC_PROFILE_ID;
  process.env.IDANALYZER_KEY = 'test-only-no-network';
  process.env.KYC_PROFILE_ID = 'test-profile';
  const scanner = mock.method(IdAnalyzer.Scanner.prototype, 'scan', async () => ({
    decision: 'accept', data: { fullName: 'Alex Maria Santos', firstName: 'Alex', lastName: 'Santos' },
  }));
  try {
    await savePendingScan(user._id, scan());
    const res = response();
    await verifyIdDocument({ user: { id: String(user._id) }, body: { documentType: 'PhilSys National ID', finalize: 'true' }, file: { originalname: 'test-id.png', mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.verified, true);
    const record = await GovernmentIdVerification.findOne({ user: user._id });
    assert.equal(record.govIdName, 'Alex Maria Santos');
    assert.equal(record.documentType, 'PhilSys National ID');
    assert.equal(await PendingIdScan.countDocuments(), 0);
  } finally {
    scanner.mock.restore();
    if (previousKey === undefined) delete process.env.IDANALYZER_KEY; else process.env.IDANALYZER_KEY = previousKey;
    if (previousProfile === undefined) delete process.env.KYC_PROFILE_ID; else process.env.KYC_PROFILE_ID = previousProfile;
  }
});

test('rejected, mismatched and expired scans do not create successful verification records', async () => {
  for (const fields of [{ decision: 'reject', accepted: false }, { profileMatch: false, accepted: false }]) {
    await savePendingScan(user._id, scan(fields));
    assert.equal((await confirm()).body.verified, false);
    assert.equal(await GovernmentIdVerification.countDocuments(), 0);
  }
  await savePendingScan(user._id, scan());
  await PendingIdScan.updateOne({ user: user._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await confirm()).statusCode, 400);
  assert.equal(await GovernmentIdVerification.countDocuments(), 0);
});

test('revocation retains recorded details, removes badge eligibility and cannot be undone by an old pending confirmation', async () => {
  await savePendingScan(user._id, scan());
  await confirm();
  const before = await GovernmentIdVerification.findOne({ user: user._id }).lean();
  await savePendingScan(user._id, scan());
  const res = response();
  await revokeGovernmentIdVerification({ params: { verificationId: String(before._id) }, user: { id: String(user._id) } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verified, false);
  const after = await GovernmentIdVerification.findById(before._id).lean();
  assert.equal(after.govIdName, before.govIdName);
  assert.equal(after.date.getTime(), before.date.getTime());
  assert.equal(after.verified, false);
  assert.ok(after.revokedAt);
  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.verification.identityVerified, false);
  assert.equal(savedUser.verification.identityDocument.status, 'pending');
  assert.equal(savedUser.verification.addressVerified, true);
  assert.equal(savedUser.verification.addressDocument.status, 'complete');
  const status = response();
  await getVerificationStatus({ user: { id: user._id } }, status);
  assert.equal(status.body.completionPercent, 75);
  assert.equal((await confirm()).statusCode, 400);
  await revokeGovernmentIdVerification({ params: { verificationId: String(before._id) }, user: { id: String(user._id) } }, response());
  assert.equal((await GovernmentIdVerification.findById(before._id)).revokedAt.getTime(), after.revokedAt.getTime());
  // Fresh successful verification updates the same user's record.
  await savePendingScan(user._id, scan({ selectedDocumentType: 'UMID' }));
  await confirm();
  assert.equal(await GovernmentIdVerification.countDocuments(), 1);
  const renewed = await GovernmentIdVerification.findById(before._id);
  assert.equal(renewed.verified, true);
  assert.equal(renewed.documentType, 'UMID');
  assert.equal(renewed.revokedAt, undefined);
});

test('record validation failure rolls back the user status and leaves the pending scan available', async () => {
  await savePendingScan(user._id, scan({ extracted: {} }));
  const result = await confirm();
  assert.equal(result.statusCode, 500);
  assert.equal((await User.findById(user._id)).verification.identityVerified, false);
  assert.equal(await GovernmentIdVerification.countDocuments(), 0);
  assert.equal(await PendingIdScan.countDocuments(), 1);
});

test('proof-of-address approval and rejection still use the existing document workflow', async () => {
  for (const status of ['complete', 'rejected']) {
    const res = response();
    await updateAdminVerification({ params: { userId: user._id, documentType: 'address' }, user: { id: user._id }, body: { status, rejectionReason: 'Upload a recent bill.' } }, res);
    assert.equal(res.statusCode, 200);
    const savedUser = await User.findById(user._id);
    assert.equal(savedUser.verification.addressDocument.status, status);
    assert.equal(savedUser.verification.addressVerified, status === 'complete');
    assert.equal(savedUser.verification.identityVerified, false);
  }
  assert.equal(await GovernmentIdVerification.countDocuments(), 0);
});

test('admin records exclude raw scan data and account deletion removes the separate personal data', async () => {
  await savePendingScan(user._id, scan());
  await confirm();
  const res = response();
  await getGovernmentIdVerifications({}, res);
  assert.equal(res.body.length, 1);
  assert.deepEqual(Object.keys(res.body[0]).sort(), ['_id', 'user', 'userName', 'govIdName', 'documentType', 'date', 'verified'].sort());
  assert.deepEqual(Object.keys(res.body[0].user).sort(), ['_id', 'role']);
  await savePendingScan(user._id, scan());
  await anonymizeAndDeleteUser(user._id);
  assert.equal(await GovernmentIdVerification.countDocuments(), 0);
  assert.equal(await PendingIdScan.countDocuments(), 0);
  const deleted = response();
  await getGovernmentIdVerifications({}, deleted);
  assert.equal(deleted.body.length, 0);
});

test('invalid and missing verification IDs return useful errors', async () => {
  for (const [verificationId, expected] of [['invalid', 400], [String(new mongoose.Types.ObjectId()), 404]]) {
    const res = response();
    await revokeGovernmentIdVerification({ params: { verificationId }, user: { id: String(user._id) } }, res);
    assert.equal(res.statusCode, expected);
  }
});
