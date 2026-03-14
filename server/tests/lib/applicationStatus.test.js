import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_APPLICATION_STATUSES,
  APPLICATION_STATUSES,
  getApplicationTimelineLabel,
  isCanonicalApplicationStatus,
  isTerminalApplicationStatus,
  toCanonicalApplicationStatus,
} from '../../lib/applicationStatus.js';

test('application status helpers map legacy values into canonical statuses', () => {
  assert.deepEqual(APPLICATION_STATUSES, [
    'Applied',
    'Shortlisted',
    'Interview Scheduled',
    'Interviewed',
    'Offer Sent',
    'Hired',
    'Rejected',
    'Withdrawn',
  ]);

  assert.equal(toCanonicalApplicationStatus('Pending'), 'Applied');
  assert.equal(toCanonicalApplicationStatus('Reviewed'), 'Shortlisted');
  assert.equal(toCanonicalApplicationStatus('Terms'), 'Offer Sent');
  assert.equal(toCanonicalApplicationStatus('Accepted'), 'Hired');
  assert.equal(toCanonicalApplicationStatus('Interviewed'), 'Interviewed');
  assert.equal(toCanonicalApplicationStatus('Offer Sent'), 'Offer Sent');
  assert.equal(toCanonicalApplicationStatus('Unknown'), null);
  assert.equal(toCanonicalApplicationStatus(null), null);
});

test('application status helpers identify canonical and terminal states', () => {
  assert.equal(isCanonicalApplicationStatus('Applied'), true);
  assert.equal(isCanonicalApplicationStatus('Pending'), false);
  assert.equal(isTerminalApplicationStatus('Hired'), true);
  assert.equal(isTerminalApplicationStatus('Rejected'), true);
  assert.equal(isTerminalApplicationStatus('Withdrawn'), true);
  assert.equal(isTerminalApplicationStatus('Shortlisted'), false);

  assert.deepEqual(ACTIVE_APPLICATION_STATUSES, [
    'Applied',
    'Shortlisted',
    'Interview Scheduled',
    'Interviewed',
    'Offer Sent',
  ]);

  assert.equal(getApplicationTimelineLabel('Pending'), 'Applied');
  assert.equal(getApplicationTimelineLabel('Offer Sent'), 'Offer Sent');
  assert.equal(getApplicationTimelineLabel('Custom'), 'Updated');
});
