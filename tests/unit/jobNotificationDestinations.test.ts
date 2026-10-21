import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationConversationTarget, getNotificationAssignmentId, getNotificationDisputeId, normalizeNotificationItem, resolveNotificationDestination } from '../../Mobile/lib/notifications.ts';

const id = '6ad61487b4e116bfb976cf0f';
const jobId = '6ad61487b4e116bfb976cf0e';
test('offer and checklist notifications open the participant conversation for the specific job', () => {
  for (const audience of ['worker', 'employer']) {
    for (const entityType of ['job_offer', 'hire_checklist']) {
      const item = normalizeNotificationItem({ _id: id, type: 'application', entityType, title: 'Update', actor: { _id: id, firstName: 'Test' }, link: `/${audience}/messages?startUser=${id}&jobId=${jobId}` });
      assert.equal(resolveNotificationDestination(item), 'messages');
      assert.deepEqual(getNotificationConversationTarget(item), { id, jobId, name: 'Test' });
    }
  }
});

test('cancellation and financial dispute destinations identify the correct assignment and case', () => {
  assert.equal(getNotificationAssignmentId({ entityType: 'application', entityId: id, link: `/employer/applications?applicationId=${id}` }), id);
  assert.equal(getNotificationAssignmentId({ entityType: 'application', entityId: id, link: `/employer/applications?applicationId=${id}&jobId=${jobId}` }), id);
  assert.equal(getNotificationAssignmentId({ entityType: 'application', entityId: jobId, link: `/employer/applications?applicationId=${id}` }), undefined);
  for (const type of ['payment', 'support']) assert.equal(resolveNotificationDestination({ type, entityType: 'financial_dispute' }), 'disputes');
  assert.equal(getNotificationDisputeId({ entityType: 'financial_dispute', entityId: id }), id);
  assert.equal(getNotificationDisputeId({ entityType: 'application', entityId: id }), undefined);
});

test('unrecognized conversation links do not select a job or external destination', () => {
  assert.equal(getNotificationConversationTarget({ link: `https://example.com/worker/messages?startUser=${id}&jobId=${jobId}` }), null);
  assert.equal(getNotificationConversationTarget({ link: '/worker/messages?startUser=invalid&jobId=invalid' }), null);
});
