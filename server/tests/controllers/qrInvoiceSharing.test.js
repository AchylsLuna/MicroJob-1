import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Message from '../../models/Message.js';
import Notification from '../../models/Notification.js';
import QrSettlementRequest from '../../models/QrSettlementRequest.js';
import StoredUpload from '../../models/StoredUpload.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import { createQrSettlementRequest, getQrSettlementImage } from '../../controllers/QrSettlementController.js';

let mongoServer;
const response = () => ({ statusCode: 200, payload: null, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; }, set(key, value) { this.headers[key] = value; return this; }, type(value) { this.headers['Content-Type'] = value; return this; }, send(value) { this.payload = value; return this; } });
const user = async (role, email) => { const item = new User({ email, firstName: role === 'work' ? 'Juan' : 'Maria', lastName: 'Santos', role, status: 'active' }); await item.setPassword('Password123!'); return item.save(); };

before(async () => { mongoServer = await MongoMemoryServer.create(); await mongoose.connect(mongoServer.getUri(), { dbName: 'qr-invoice-sharing' }); await Promise.all([QrSettlementRequest.init(), Message.init(), StoredUpload.init()]); });
beforeEach(async () => mongoose.connection.db.dropDatabase());
after(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

test('invoice creation stores one private QR chat card and one employer notification', async () => {
  const [worker, employer] = await Promise.all([user('work', 'worker-qr@example.com'), user('hire', 'employer-qr@example.com')]);
  const job = await Job.create({ title: 'Barangay cleanup', description: 'Clean the covered court.', location: 'Pasig City, Metro Manila', salary: 750, jobType: 'Short-term', deadline: new Date('2027-01-01'), positionsNeeded: 1, hiredCount: 1, status: 'In Progress', jobPoster: employer._id, applicants: [worker._id] });
  await Promise.all([
    JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', agreedAmount: 750, workStatus: 'Submitted', paymentStatus: 'Secured' }),
    Transaction.create({ sender: employer._id, amount: 750, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id }),
  ]);

  const first = response();
  await createQrSettlementRequest({ user: { id: String(worker._id) }, body: { jobId: String(job._id) } }, first);
  assert.equal(first.statusCode, 201);
  assert.match(first.payload.qrPayload, /^microjobs:\/\/wallet\/settle\?token=/);
  assert.equal(first.payload.preview.totalAmount, 750);

  const [request, messages, notifications, uploads] = await Promise.all([
    QrSettlementRequest.findById(first.payload.requestId).select('+shortCodeCipher'),
    Message.find({ 'attachment.type': 'settlement_request' }),
    Notification.find({ user: employer._id, entityType: 'payment_request' }),
    StoredUpload.find({ 'metadata.kind': 'settlement_request' }),
  ]);
  assert.equal(messages.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(uploads.length, 1);
  assert.notEqual(request.shortCodeCipher, first.payload.shortCode);
  assert.equal(JSON.stringify(request.toObject()).includes(first.payload.qrPayload), false);

  const duplicate = response();
  await createQrSettlementRequest({ user: { id: String(worker._id) }, body: { jobId: String(job._id) } }, duplicate);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.payload.deduplicated, true);
  assert.equal(await Message.countDocuments({ 'attachment.type': 'settlement_request' }), 1);
  assert.equal(await Notification.countDocuments({ user: employer._id, entityType: 'payment_request' }), 1);

  const authorizedImage = response();
  await getQrSettlementImage({ user: { id: String(employer._id) }, params: { requestId: first.payload.requestId } }, authorizedImage);
  assert.equal(authorizedImage.statusCode, 200);
  assert.equal(Buffer.isBuffer(authorizedImage.payload), true);

  const outsider = await user('hire', 'outsider-qr@example.com');
  const deniedImage = response();
  await getQrSettlementImage({ user: { id: String(outsider._id) }, params: { requestId: first.payload.requestId } }, deniedImage);
  assert.equal(deniedImage.statusCode, 404);
});
