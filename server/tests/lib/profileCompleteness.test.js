import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmployerProfileRequirementError, getWorkerProfileRequirementError } from '../../lib/profileCompleteness.js';

test('an employer with a logo passes, company name is no longer required', () => {
  assert.equal(getEmployerProfileRequirementError({ companyName: '', avatarUrl: 'https://x/logo.png' }), null);
});

test('an employer missing a logo is blocked', () => {
  const error = getEmployerProfileRequirementError({ companyName: 'Acme Corp', avatarUrl: '' });
  assert.equal(error?.status, 409);
  assert.equal(error?.code, 'EMPLOYER_PROFILE_INCOMPLETE');
  assert.deepEqual(error?.missing, ['avatarUrl']);
});

test('an employer missing everything reports the logo', () => {
  const error = getEmployerProfileRequirementError({});
  assert.deepEqual(error?.missing, ['avatarUrl']);
});

test('a whitespace-only avatarUrl counts as missing', () => {
  const error = getEmployerProfileRequirementError({ companyName: '   ', avatarUrl: '   ' });
  assert.deepEqual(error?.missing, ['avatarUrl']);
});

test('a worker with a profile photo passes', () => {
  assert.equal(getWorkerProfileRequirementError({ avatarUrl: 'https://x/photo.jpg' }), null);
});

test('a worker with no profile photo is blocked', () => {
  const error = getWorkerProfileRequirementError({ avatarUrl: '' });
  assert.equal(error?.status, 409);
  assert.equal(error?.code, 'WORKER_PROFILE_INCOMPLETE');
  assert.deepEqual(error?.missing, ['avatarUrl']);
});

test('a missing user document is treated as incomplete, not a crash', () => {
  assert.ok(getEmployerProfileRequirementError(null));
  assert.ok(getWorkerProfileRequirementError(undefined));
});
