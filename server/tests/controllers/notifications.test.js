import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import {
  applyForJob,
  scheduleInterview,
  updateApplicationStatus,
} from '../../controllers/JobApplicationController.js';
import MessageController from '../../controllers/MessageController.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Message from '../../models/Message.js';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';

let mongoServer;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const createUser = (email, role, firstName) => User.create({
  email,
  firstName,
  lastName: 'User',
  role,
  status: 'active',
  passwordHashed: 'not-used',
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'microjobs-notifications-test' });
  await Promise.all([JobApplication.init(), Message.init(), Notification.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([
    JobApplication.syncIndexes(),
    Message.syncIndexes(),
    Notification.syncIndexes(),
  ]);
});

test('application and interview events persist once with clear worker and employer messages', async () => {
  const [employer, worker] = await Promise.all([
    createUser('notify-employer@example.com', 'hire', 'Employer'),
    createUser('notify-worker@example.com', 'work', 'Juan'),
  ]);
  const job = await Job.create({
    title: 'Electrician Helper',
    description: 'Assist an electrician with a short installation.',
    location: 'Quezon City, Metro Manila',
    salary: 2500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01T00:00:00.000Z'),
    jobPoster: employer._id,
  });

  const applyResponse = createResponse();
  await applyForJob(
    { user: { id: worker._id }, params: { jobId: job._id }, body: {} },
    applyResponse,
  );
  assert.equal(applyResponse.statusCode, 201);
  const application = await JobApplication.findOne({ job: job._id, applicant: worker._id });
  assert.ok(application);

  const employerNotification = await Notification.findOne({ user: employer._id, type: 'application' });
  assert.ok(employerNotification);
  assert.equal(employerNotification.message, 'Juan User applied for Electrician Helper.');
  assert.equal(employerNotification.dedupeKey, `application:${application._id}:created`);

  const duplicateApplyResponse = createResponse();
  await applyForJob(
    { user: { id: worker._id }, params: { jobId: job._id }, body: {} },
    duplicateApplyResponse,
  );
  assert.equal(duplicateApplyResponse.statusCode, 400);
  assert.equal(await Notification.countDocuments({ user: employer._id, type: 'application' }), 1);

  const hiredResponse = createResponse();
  await updateApplicationStatus(
    { user: { id: employer._id }, params: { applicationId: application._id }, body: { status: 'Hired' } },
    hiredResponse,
  );
  assert.equal(hiredResponse.statusCode, 200);
  const hiredNotification = await Notification.findOne({ user: worker._id, type: 'application' });
  assert.ok(hiredNotification);
  assert.equal(hiredNotification.message, 'You have been hired for Electrician Helper.');

  const repeatedHiredResponse = createResponse();
  await updateApplicationStatus(
    { user: { id: employer._id }, params: { applicationId: application._id }, body: { status: 'Hired' } },
    repeatedHiredResponse,
  );
  assert.equal(repeatedHiredResponse.statusCode, 200);
  assert.equal(await Notification.countDocuments({ user: worker._id, type: 'application' }), 1);

  const rejectedResponse = createResponse();
  await updateApplicationStatus(
    { user: { id: employer._id }, params: { applicationId: application._id }, body: { status: 'Rejected' } },
    rejectedResponse,
  );
  assert.equal(rejectedResponse.statusCode, 200);
  const rejectedNotification = await Notification.findOne({
    user: worker._id,
    type: 'application',
    message: 'Your application for Electrician Helper has been rejected.',
  });
  assert.ok(rejectedNotification);

  const interviewResponse = createResponse();
  await scheduleInterview(
    {
      user: { id: employer._id },
      params: { applicationId: application._id },
      body: { scheduledAt: '2026-12-15T02:30:00.000Z', mode: 'virtual' },
    },
    interviewResponse,
  );
  assert.equal(interviewResponse.statusCode, 201);
  const interviewNotification = await Notification.findOne({ user: worker._id, type: 'interview' });
  assert.ok(interviewNotification);
  assert.equal(interviewNotification.message, 'You have been invited for an interview for Electrician Helper.');
});

test('each actual incoming message creates one persistent sender-named notification', async () => {
  const [sender, receiver] = await Promise.all([
    createUser('message-sender@example.com', 'work', 'John'),
    createUser('message-receiver@example.com', 'hire', 'Client'),
  ]);
  const body = {
    receiverId: String(receiver._id),
    content: 'Hello, I have a question.',
    clientMessageId: 'mobile-message-1',
  };

  const firstResponse = createResponse();
  await MessageController.sendMessage({ user: { id: sender._id }, body }, firstResponse);
  assert.equal(firstResponse.statusCode, 201);

  const notification = await Notification.findOne({ user: receiver._id, type: 'message' });
  assert.ok(notification);
  assert.equal(notification.message, 'John User sent you a message.');
  assert.equal(String(notification.metadata.senderId), String(sender._id));
  assert.equal(await Message.countDocuments({ sender: sender._id, receiver: receiver._id }), 1);

  const repeatedResponse = createResponse();
  await MessageController.sendMessage({ user: { id: sender._id }, body }, repeatedResponse);
  assert.equal(repeatedResponse.statusCode, 200);
  assert.equal(await Message.countDocuments({ sender: sender._id, receiver: receiver._id }), 1);
  assert.equal(await Notification.countDocuments({ user: receiver._id, type: 'message' }), 1);
});
