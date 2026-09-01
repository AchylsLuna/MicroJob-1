import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmployerProfileRequirementError, getWorkerProfileRequirementError } from '../../lib/profileCompleteness.js';

test('an employer with a company name and logo passes', () => {
  assert.equal(getEmployerProfileRequirementError({ companyName: 'Acme Corp', avatarUrl: 'https://x/logo.png' }), null);
});

test('an employer missing a company name is blocked', () => {
  const error = getEmployerProfileRequirementError({ companyName: '', avatarUrl: 'https://x/logo.png' });
  assert.equal(error?.status, 409);
  assert.equal(error?.code, 'EMPLOYER_PROFILE_INCOMPLETE');
  assert.deepEqual(error?.missing, ['companyName']);
});

test('an employer missing a logo is blocked', () => {
  const error = getEmployerProfileRequirementError({ companyName: 'Acme Corp', avatarUrl: '' });
  assert.deepEqual(error?.missing, ['avatarUrl']);
});

test('an employer missing both reports both', () => {
  const error = getEmployerProfileRequirementError({});
  assert.deepEqual(error?.missing, ['companyName', 'avatarUrl']);
});

test('whitespace-only fields count as missing', () => {
  const error = getEmployerProfileRequirementError({ companyName: '   ', avatarUrl: '   ' });
  assert.deepEqual(error?.missing, ['companyName', 'avatarUrl']);
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
