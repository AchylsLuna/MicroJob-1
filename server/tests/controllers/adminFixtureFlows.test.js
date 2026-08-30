import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';
import StaffAccount from '../../models/StaffAccount.js';
import ModerationReport from '../../models/ModerationReport.js';
import FinancialDispute from '../../models/FinancialDispute.js';
import {
  listStaffAccounts,
  createStaffAccount,
  updateStaffAccountRole,
  toggleStaffAccountStatus,
} from '../../controllers/StaffController.js';
import {
  listModerationReports,
  enforceModerationReport,
  dismissModerationReport,
} from '../../controllers/ModerationController.js';
import {
  listFinancialDisputes,
  investigateFinancialDispute,
  resolveFinancialDispute,
  rejectFinancialDispute,
} from '../../controllers/FinancialDisputeController.js';

let replicaSet;

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const request = ({ user, body = {}, params = {}, query = {} }) => ({
  user,
  body,
  params,
  query,
  ip: '127.0.0.1',
  get: () => 'admin-fixture-flow-test',
});

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri(), { dbName: 'admin-fixture-tests' });
  await Promise.all([
    User.init(),
    StaffAccount.init(),
    ModerationReport.init(),
    FinancialDispute.init(),
    AuditLog.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    StaffAccount.deleteMany({}),
    ModerationReport.deleteMany({}),
    FinancialDispute.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

test('staff accounts can be created and toggled with audit logs', async () => {
  const actor = await User.create({
    email: 'owner@example.com',
    firstName: 'Owner',
    lastName: 'Admin',
    role: 'superadmin',
    status: 'active',
    passwordHashed: 'placeholder',
  });

  const createRes = response();
  await createStaffAccount(
    request({
      user: { id: String(actor._id), role: 'superadmin' },
      body: {
        firstName: 'Ana',
        lastName: 'Cruz',
        email: 'ana.cruz@example.com',
        staffRole: 'finance_team',
      },
    }),
    createRes,
  );

  assert.equal(createRes.statusCode, 201);
  assert.equal((await User.countDocuments({ staffRole: 'finance_team' })), 1);

  const staffId = createRes.payload.staff._id;
  const staffId2 = createRes.payload.staff.id || staffId;
  const toggleRes = response();
  await toggleStaffAccountStatus(
    request({
      user: { id: String(actor._id), role: 'superadmin' },
      params: { staffId: staffId2 },
      body: { status: 'disabled' },
    }),
    toggleRes,
  );

  assert.equal(toggleRes.statusCode, 200);
  const toggledUser = await User.findById(staffId);
  assert.equal(toggledUser.status, 'disabled');
  assert.ok((await AuditLog.countDocuments({ action: 'staff_status_changed' })) >= 1);
});

test('moderation reports can be enforced and dismissed with audit entries', async () => {
  const actor = await User.create({
    email: 'mod@example.com',
    firstName: 'Mod',
    lastName: 'Admin',
    role: 'admin',
    staffRole: 'moderator',
    status: 'active',
    passwordHashed: 'placeholder',
  });

  const report = await ModerationReport.create({
    targetType: 'user',
    targetId: new mongoose.Types.ObjectId(),
    targetName: 'Carlo Ibanez',
    reportedBy: 'employer@acme.ph',
    reason: 'Abusive behavior',
    status: 'pending',
  });

  const enforceRes = response();
  await enforceModerationReport(
    request({
      user: { id: String(actor._id), role: 'admin' },
      params: { reportId: String(report._id) },
      body: { action: 'banned', reason: 'Policy violation' },
    }),
    enforceRes,
  );

  assert.equal(enforceRes.statusCode, 200);
  const updated = await ModerationReport.findById(report._id);
  assert.equal(updated.status, 'resolved');
  assert.ok((await AuditLog.countDocuments({ action: 'moderation_report_enforced' })) >= 1);

  const second = await ModerationReport.create({
    targetType: 'job',
    targetId: new mongoose.Types.ObjectId(),
    targetName: 'Test listing',
    reportedBy: 'worker@example.com',
    reason: 'Spam listing',
    status: 'pending',
  });

  const dismissRes = response();
  await dismissModerationReport(
    request({
      user: { id: String(actor._id), role: 'admin' },
      params: { reportId: String(second._id) },
      body: { reason: 'Not actionable' },
    }),
    dismissRes,
  );

  assert.equal(dismissRes.statusCode, 200);
  assert.equal((await ModerationReport.findById(second._id)).status, 'dismissed');
  assert.ok((await AuditLog.countDocuments({ action: 'moderation_report_dismissed' })) >= 1);
});

test('financial disputes can be investigated and resolved with audit entries', async () => {
  const actor = await User.create({
    email: 'finance@example.com',
    firstName: 'Finance',
    lastName: 'Lead',
    role: 'admin',
    staffRole: 'finance_team',
    status: 'active',
    passwordHashed: 'placeholder',
  });

  const dispute = await FinancialDispute.create({
    subject: 'Payout missing',
    raisedBy: 'worker@example.com',
    amount: 1250,
    reason: 'No payout received',
    status: 'open',
  });

  const investigateRes = response();
  await investigateFinancialDispute(
    request({
      user: { id: String(actor._id), role: 'admin' },
      params: { disputeId: String(dispute._id) },
    }),
    investigateRes,
  );

  assert.equal(investigateRes.statusCode, 200);
  assert.equal((await FinancialDispute.findById(dispute._id)).status, 'investigating');

  const resolveRes = response();
  await resolveFinancialDispute(
    request({
      user: { id: String(actor._id), role: 'admin' },
      params: { disputeId: String(dispute._id) },
      body: { resolutionNotes: 'Top-up verified and refunded.' },
    }),
    resolveRes,
  );

  assert.equal(resolveRes.statusCode, 200);
  assert.equal((await FinancialDispute.findById(dispute._id)).status, 'resolved');
  assert.ok((await AuditLog.countDocuments({ action: 'finance_dispute_resolved' })) >= 1);
});
