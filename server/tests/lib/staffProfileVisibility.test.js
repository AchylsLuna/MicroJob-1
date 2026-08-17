import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canViewProfileOf,
  getPublicProfileAccessError,
  isSameUser,
  isStaffRole,
} from '../../lib/staffProfileVisibility.js';

const ADMIN_ID = '64b7f9c2e1a4d5f6a7b8c9e0';
const WORKER_ID = '64b7f9c2e1a4d5f6a7b8c9e1';
const EMPLOYER_ID = '64b7f9c2e1a4d5f6a7b8c9e2';

test('isStaffRole matches admin roles case-insensitively and ignores marketplace roles', () => {
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('superadmin'), true);
  assert.equal(isStaffRole(' ADMIN '), true);
  assert.equal(isStaffRole('SuperAdmin'), true);
  assert.equal(isStaffRole('work'), false);
  assert.equal(isStaffRole('hire'), false);
  assert.equal(isStaffRole('both'), false);
  assert.equal(isStaffRole(''), false);
  assert.equal(isStaffRole(undefined), false);
});

test('isSameUser compares ids across raw strings and ObjectId-like values', () => {
  assert.equal(isSameUser(ADMIN_ID, ADMIN_ID), true);
  assert.equal(isSameUser({ toHexString: () => ADMIN_ID }, ADMIN_ID), true);
  assert.equal(isSameUser({ _id: ADMIN_ID }, ADMIN_ID), true);
  assert.equal(isSameUser(ADMIN_ID, WORKER_ID), false);
  assert.equal(isSameUser(null, null), false);
  assert.equal(isSameUser('', ''), false);
});

test('workers and employers cannot read an admin profile', () => {
  for (const requesterRole of ['work', 'hire', 'both']) {
    const error = getPublicProfileAccessError({
      targetRole: 'admin',
      requesterRole,
      targetId: ADMIN_ID,
      requesterId: WORKER_ID,
    });
    assert.deepEqual(error, { status: 404, message: 'Profile not found.' });
  }
});

test('admin profiles answer 404 so support chats cannot enumerate staff accounts', () => {
  const error = getPublicProfileAccessError({
    targetRole: 'superadmin',
    requesterRole: 'work',
    targetId: ADMIN_ID,
    requesterId: WORKER_ID,
  });
  // 404 (not 403) keeps the response indistinguishable from a missing user.
  assert.equal(error.status, 404);
  assert.equal(error.message, 'Profile not found.');
});

test('marketplace profiles stay readable for normal participants', () => {
  assert.equal(
    getPublicProfileAccessError({
      targetRole: 'hire',
      requesterRole: 'work',
      targetId: EMPLOYER_ID,
      requesterId: WORKER_ID,
    }),
    null,
  );
  assert.equal(
    getPublicProfileAccessError({
      targetRole: 'work',
      requesterRole: 'hire',
      targetId: WORKER_ID,
      requesterId: EMPLOYER_ID,
    }),
    null,
  );
});

test('staff keep access to staff profiles and to their own record', () => {
  assert.equal(
    getPublicProfileAccessError({
      targetRole: 'admin',
      requesterRole: 'superadmin',
      targetId: ADMIN_ID,
      requesterId: WORKER_ID,
    }),
    null,
  );
  assert.equal(
    getPublicProfileAccessError({
      targetRole: 'admin',
      requesterRole: 'admin',
      targetId: ADMIN_ID,
      requesterId: ADMIN_ID,
    }),
    null,
  );
});

test('canViewProfileOf mirrors the access decision for UI gating', () => {
  assert.equal(
    canViewProfileOf({
      targetRole: 'admin',
      requesterRole: 'work',
      targetId: ADMIN_ID,
      requesterId: WORKER_ID,
    }),
    false,
  );
  assert.equal(
    canViewProfileOf({
      targetRole: 'hire',
      requesterRole: 'work',
      targetId: EMPLOYER_ID,
      requesterId: WORKER_ID,
    }),
    true,
  );
});
