import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import FinancialDispute from '../models/FinancialDispute.js';
import SupportTicket from '../models/SupportTicket.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const truthy = (value) => ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const enabled = truthy(process.env.ENABLE_PAYMENT_DISPUTE_DEMO_SEED);
const password = String(process.env.PAYMENT_DISPUTE_DEMO_PASSWORD || '');
const employerEmail = String(process.env.PAYMENT_DISPUTE_DEMO_EMPLOYER_EMAIL || 'payment-demo-employer@microjobs.local').trim().toLowerCase();
const workerEmail = String(process.env.PAYMENT_DISPUTE_DEMO_WORKER_EMAIL || 'payment-demo-worker@microjobs.local').trim().toLowerCase();
const reset = process.argv.includes('--reset');
const jobTitle = '[TEST] Payment dispute demo - 3 of 5 days completed';

function assertCanSeed() {
  if (isProduction) throw new Error('Payment dispute demo data cannot be seeded in production.');
  if (!enabled) throw new Error('Set ENABLE_PAYMENT_DISPUTE_DEMO_SEED=true to explicitly enable this development-only seeder.');
  if (!password) throw new Error('Set PAYMENT_DISPUTE_DEMO_PASSWORD to a password for the dedicated test accounts.');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required. The demo seeder will not use an in-memory or implicit database.');
  if (employerEmail === workerEmail) throw new Error('Employer and worker demo accounts must use different email addresses.');
}

async function ensureDemoUser({ email, username, firstName, role }) {
  let user = await User.findOne({ email });
  if (user) {
    if (user.username !== username || user.role !== role) {
      throw new Error(`Refusing to use ${email}; it is not the dedicated ${role} demo account.`);
    }
    if (user.status !== 'active') {
      user.status = 'active';
    }
    if (!(await user.validatePassword(password))) await user.setPassword(password);
    await user.save();
    return user;
  }

  user = new User({
    email,
    username,
    firstName,
    lastName: 'Payment Demo',
    role,
    status: 'active',
    city: 'Quezon City',
    province: 'Metro Manila',
  });
  await user.setPassword(password);
  await user.save();
  return user;
}

async function resetDemoAssignment({ job, application, employer, worker }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const disputes = await FinancialDispute.find({ application: application._id }).select('_id').session(session).lean();
      const disputeIds = disputes.map((dispute) => String(dispute._id));
      const escrowReference = `payment-dispute-demo:escrow:${job._id}`;
      const demoReferences = [
        escrowReference,
        ...disputeIds.flatMap((disputeId) => [
          `financial-dispute:${disputeId}:worker`,
          `financial-dispute:${disputeId}:employer`,
        ]),
      ];
      const completedResolutions = await Transaction.find({
        jobReference: job._id,
        relatedEntityType: 'financial_dispute',
        relatedEntityId: { $in: disputeIds },
        status: 'COMPLETED',
        type: { $in: ['PAYOUT', 'REFUND'] },
      }).session(session).lean();
      const workerCredit = completedResolutions
        .filter((transaction) => transaction.type === 'PAYOUT' && String(transaction.receiver) === String(worker._id))
        .reduce((total, transaction) => total + transaction.amount, 0);
      const employerCredit = completedResolutions
        .filter((transaction) => transaction.type === 'REFUND' && String(transaction.receiver) === String(employer._id))
        .reduce((total, transaction) => total + transaction.amount, 0);

      const currentWorker = await User.findById(worker._id).select('workerBalance').session(session).lean();
      const currentEmployer = await User.findById(employer._id).select('employerBalance').session(session).lean();
      if ((currentWorker?.workerBalance || 0) < workerCredit || (currentEmployer?.employerBalance || 0) < employerCredit) {
        throw new Error('Cannot reset demo balances because some demo settlement funds are no longer in the demo accounts.');
      }

      if (workerCredit) await User.updateOne({ _id: worker._id }, { $inc: { workerBalance: -workerCredit } }, { session });
      if (employerCredit) await User.updateOne({ _id: employer._id }, { $inc: { employerBalance: -employerCredit } }, { session });
      await SupportTicket.deleteMany({ financialDispute: { $in: disputes.map((dispute) => dispute._id) } }, { session });
      await FinancialDispute.deleteMany({ application: application._id }, { session });
      await Transaction.deleteMany({ jobReference: job._id, reference: { $in: demoReferences } }, { session });
      await JobApplication.updateOne(
        { _id: application._id },
        {
          $set: {
            status: 'Hired',
            workStatus: 'Submitted',
            paymentStatus: 'Secured',
            workSubmittedAt: new Date(),
            paidAt: null,
            completedAt: null,
            timeline: [{
              type: 'demo_work_submitted',
              note: 'Demo only: worker completed 3 of the agreed 5 days and submitted the work.',
              actor: worker._id,
              createdAt: new Date(),
            }],
          },
          $unset: { paymentReminderClaimedAt: 1, paymentReminderSentAt: 1 },
        },
        { session },
      );
      await Job.updateOne({ _id: job._id }, { $set: { status: 'In Progress', hiredCount: 1 } }, { session });
    });
  } finally {
    await session.endSession();
  }
}

async function seed() {
  assertCanSeed();
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME || 'MicroJob',
    serverSelectionTimeoutMS: 5000,
  });

  const [employer, worker] = await Promise.all([
    ensureDemoUser({
      email: employerEmail,
      username: 'payment-dispute-demo-employer',
      firstName: 'Demo Employer',
      role: 'hire',
    }),
    ensureDemoUser({
      email: workerEmail,
      username: 'payment-dispute-demo-worker',
      firstName: 'Demo Worker',
      role: 'work',
    }),
  ]);

  let job = await Job.findOne({ jobPoster: employer._id, title: jobTitle });
  if (!job) {
    job = await Job.create({
      title: jobTitle,
      description: 'DEMO ONLY. Test the payment dispute process using the dedicated demo accounts. No real work or payment is involved.',
      location: 'Quezon City (Demo)',
      salary: 500,
      jobType: 'Short-term',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      responsibilities: ['Review a submitted five-day job scenario', 'Test dispute resolution only'],
      requirements: ['Demo scenario; no real work required'],
      status: 'In Progress',
      hiredCount: 1,
      jobPoster: employer._id,
      selectedApplicant: worker._id,
      applicants: [worker._id],
    });
  }

  let application = await JobApplication.findOne({ job: job._id, applicant: worker._id });
  if (!application) {
    application = await JobApplication.create({
      job: job._id,
      applicant: worker._id,
      status: 'Hired',
      agreedAmount: 500,
      workStatus: 'Submitted',
      paymentStatus: 'Secured',
      workSubmittedAt: new Date(),
      timeline: [{
        type: 'demo_work_submitted',
        note: 'Demo only: worker completed 3 of the agreed 5 days and submitted the work.',
        actor: worker._id,
        createdAt: new Date(),
      }],
    });
  }

  if (reset) {
    await resetDemoAssignment({ job, application, employer, worker });
  }

  const escrowReference = `payment-dispute-demo:escrow:${job._id}`;
  const existingEscrow = await Transaction.exists({ reference: escrowReference });
  if (!existingEscrow) {
    await Transaction.create({
      sender: employer._id,
      amount: 500,
      type: 'ESCROW',
      status: 'COMPLETED',
      balanceTarget: 'ESCROW',
      jobReference: job._id,
      reference: escrowReference,
      label: 'DEMO ONLY: payment dispute escrow',
      relatedEntityType: 'payment_dispute_demo',
      relatedEntityId: String(application._id),
      actor: employer._id,
    });
  }

  console.log('\nPayment dispute demo is ready (dedicated test data only).');
  console.log(`Employer login: ${employerEmail}`);
  console.log(`Worker login:   ${workerEmail}`);
  console.log('Password:       the value of PAYMENT_DISPUTE_DEMO_PASSWORD');
  console.log('Agreed amount:  PHP 500.00 (synthetic escrow; no real payment)');
  console.log('\nTest the flow:');
  console.log('1. Sign in as the demo worker and open Applied Jobs. Open a payment dispute for the submitted demo job.');
  console.log('2. Sign in as the demo employer and confirm the dispute notice and payment hold.');
  console.log('3. Sign in as Support, assign the case, complete the investigation report, and forward it to Finance.');
  console.log('4. Sign in as Finance, select Full Refund, Complete Payment, or Partial Payment and enter a reason.');
  console.log('5. Sign in as a different authorized Finance user to approve and process the settlement.');
  console.log('6. To restart the scenario, run: npm --prefix server run seed:payment-dispute-demo -- --reset');
  console.log('   Reset only affects the marked demo job, its dispute ledger entries, and settlement credits still held in the demo accounts.');
}

seed()
  .catch((error) => {
    console.error('Failed to seed payment dispute demo:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
