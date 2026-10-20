import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHireChecklist } from '../../lib/hireChecklist.js';

test('hire checklist is optional and normalizes descriptions to initially unchecked tasks', () => {
  assert.deepEqual(normalizeHireChecklist(undefined), []);
  assert.deepEqual(normalizeHireChecklist([]), []);
  assert.deepEqual(normalizeHireChecklist(['  Clean the floor  ', 'Photograph the finished work']), [{ description: 'Clean the floor', completed: false }, { description: 'Photograph the finished work', completed: false }]);
  assert.equal(normalizeHireChecklist(Array(20).fill('Task')).length, 20);
});

test('hire checklist rejects forged types, blank or excessive descriptions, and excessive rows', () => {
  for (const value of [null, 'task', {}, [''], ['  '], [123], [{ description: 'task', completed: true }], ['x'.repeat(501)], Array(21).fill('Task')]) assert.throws(() => normalizeHireChecklist(value), { status: 400 });
});
