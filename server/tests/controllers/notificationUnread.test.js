import test from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../../models/Notification.js';
import { markNotificationUnread } from '../../controllers/NotificationController.js';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('mark unread scopes the mutation to the authenticated user', async () => {
  const original = Notification.findOneAndUpdate;
  let received;
  Notification.findOneAndUpdate = async (...args) => {
    received = args;
    return { _id: 'notification-1', readAt: null };
  };

  try {
    const res = response();
    await markNotificationUnread({ user: { id: 'user-1', role: 'work' }, query: {}, params: { notificationId: 'notification-1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(received[0], { _id: 'notification-1', user: 'user-1', audience: { $in: ['worker', 'shared', null] } });
    assert.deepEqual(received[1], { $set: { readAt: null } });
  } finally {
    Notification.findOneAndUpdate = original;
  }
});

test('mark unread returns 404 when the owned notification does not exist', async () => {
  const original = Notification.findOneAndUpdate;
  Notification.findOneAndUpdate = async () => null;
  try {
    const res = response();
    await markNotificationUnread({ user: { id: 'user-1', role: 'work' }, query: {}, params: { notificationId: 'missing' } }, res);
    assert.equal(res.statusCode, 404);
  } finally {
    Notification.findOneAndUpdate = original;
  }
});
