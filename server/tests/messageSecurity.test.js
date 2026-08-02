import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_MAX_LENGTH,
  isValidObjectId,
  normalizeMessageContent,
  validateMessageContent,
} from '../lib/messageSecurity.js';

test('message content is trimmed and bounded', () => {
  assert.equal(normalizeMessageContent('  hello  '), 'hello');
  assert.equal(validateMessageContent('   ').error, 'Message content is required.');
  assert.equal(validateMessageContent('x'.repeat(MESSAGE_MAX_LENGTH)).error, null);
  assert.match(validateMessageContent('x'.repeat(MESSAGE_MAX_LENGTH + 1)).error, /cannot exceed/);
});

test('message identifiers must be MongoDB object ids', () => {
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectId('not-an-id'), false);
});
