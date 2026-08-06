import test from 'node:test';
import assert from 'node:assert/strict';

import sanitize from '../../middleware/sanitize.js';

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('sanitizer removes dangerous nested keys', () => {
  const req = {
    query: { safe: 'yes', '$where': 'danger' },
    params: {},
    body: { nested: { normal: true, 'profile.name': 'danger', '$ne': null } },
  };
  let nextCalled = false;
  sanitize(req, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.query, { safe: 'yes' });
  assert.deepEqual(req.body, { nested: { normal: true } });
});

test('sanitizer fails closed when request data cannot be inspected', () => {
  const req = { params: {}, body: {} };
  Object.defineProperty(req, 'query', {
    get() {
      throw new Error('unreadable query');
    },
  });
  const res = response();
  let nextCalled = false;
  sanitize(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.code, 'INVALID_REQUEST_PAYLOAD');
});
