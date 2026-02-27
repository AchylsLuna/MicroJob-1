import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAllowedOrigins, isAllowedOrigin, splitOrigins } from '../../lib/corsOrigins.js';

test('splitOrigins parses and trims comma-separated values', () => {
  assert.deepEqual(splitOrigins(' https://a.com, https://b.com ,, '), [
    'https://a.com',
    'https://b.com',
  ]);
});

test('buildAllowedOrigins merges defaults with configured origins', () => {
  const allowed = buildAllowedOrigins({
    clientOrigin: 'https://client.example.com',
    extraOrigins: 'https://admin.example.com,https://client.example.com',
    defaults: ['http://localhost:3000'],
  });

  assert.equal(allowed.has('http://localhost:3000'), true);
  assert.equal(allowed.has('https://client.example.com'), true);
  assert.equal(allowed.has('https://admin.example.com'), true);
  assert.equal(allowed.size, 3);
});

test('isAllowedOrigin allows same-origin requests and checks known origins', () => {
  const allowed = new Set(['https://allowed.example.com']);

  assert.equal(isAllowedOrigin(undefined, allowed), true);
  assert.equal(isAllowedOrigin('https://allowed.example.com', allowed), true);
  assert.equal(isAllowedOrigin('https://blocked.example.com', allowed), false);
});
