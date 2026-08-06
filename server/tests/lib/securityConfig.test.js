import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTrustProxy } from '../../middleware/security/security.js';

const withEnvironment = (values, callback) => {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test('Vercel functions trust the platform proxy for HTTPS detection', () => {
  withEnvironment({ VERCEL: '1', TRUST_PROXY: undefined }, () => {
    assert.equal(parseTrustProxy(), 1);
  });
});

test('non-Vercel runtimes keep proxy trust explicit', () => {
  withEnvironment({ VERCEL: undefined, TRUST_PROXY: undefined }, () => {
    assert.equal(parseTrustProxy(), false);
  });

  withEnvironment({ VERCEL: undefined, TRUST_PROXY: '2' }, () => {
    assert.equal(parseTrustProxy(), 2);
  });
});
