import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import { settleApplicationPayment } from '../../services/applicationSettlement.js';

let mongo;
const makeUser = async (role, email) => { const item = new User({ email, firstName: 'Test', lastName: 'User', role, status: 'active' }); await item.setPassword('Password123!'); return item.save(); };
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri(), { dbName: 'application-settlement' }); await Transaction.init(); });
beforeEach(async () => mongoose.connection.db.dropDatabase());
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

test('settles only one submitted worker and is idempotent', async () => {
  const [employer, workerA, workerB] = await Promise.all([makeUser('hire', 'settle-employer@example.com'), makeUser('work', 'settle-a@example.com'), makeUser('work', 'settle-b@example.com')]);
  const job = await Job.create({ title: 'Community cleanup', description: 'Cleanup', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date('2027-01-01'), positionsNeeded: 2, hiredCount: 2, status: 'Closed', jobPoster: employer._id });
  const [appA, appB] = await Promise.all([JobApplication.create({ job: job._id, applicant: workerA._id, status: 'Hired', agreedAmount: 600, workStatus: 'Submitted' }), JobApplication.create({ job: job._id, applicant: workerB._id, status: 'Hired', agreedAmount: 500, workStatus: 'Submitted' })]);
  await Transaction.create({ sender: employer._id, amount: 1100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  const first = await settleApplicationPayment({ applicationId: appA._id, employerId: employer._id });
  const replay = await settleApplicationPayment({ applicationId: appA._id, employerId: employer._id });
  assert.equal(first.deduplicated, false); assert.equal(replay.deduplicated, true);
  assert.equal(await Transaction.countDocuments({ reference: `application-payout:${appA._id}` }), 1);
  assert.equal((await User.findById(workerA._id)).workerBalance, 600);
  assert.equal((await User.findById(workerB._id)).workerBalance, 0);
  assert.equal((await JobApplication.findById(appB._id)).paymentStatus, 'Secured');
  assert.equal((await Job.findById(job._id)).status, 'Closed');
});
