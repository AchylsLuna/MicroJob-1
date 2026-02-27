import test from 'node:test';
import assert from 'node:assert/strict';

import { sendError, sendSuccess } from '../../lib/apiResponse.js';

function createResponseMock() {
  return {
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('sendSuccess builds a success payload and excludes duplicated extra fields', () => {
  const res = createResponseMock();
  const data = { id: 'job_123', title: 'Painter' };

  sendSuccess(res, 201, 'Created', data, {
    success: false,
    message: 'ignore me',
    data,
    id: 'job_123',
    traceId: 'trace_abc',
  });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.payload, {
    success: true,
    message: 'Created',
    data,
    traceId: 'trace_abc',
  });
});

test('sendError builds an error payload and includes extra fields', () => {
  const res = createResponseMock();

  sendError(res, 400, 'Validation failed', { field: 'email' });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Validation failed',
    field: 'email',
  });
});
