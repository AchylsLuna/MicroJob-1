import test from 'node:test';
import assert from 'node:assert/strict';

import { getVercelOrigins, getWebOrigin, validateProductionRuntime } from '../../lib/runtimeConfig.js';

const CONFIG_KEYS = ['NODE_ENV', 'MONGO_URI', 'MONGODB_URI', 'JWT_SECRET', 'WEB_ORIGIN', 'CLIENT_ORIGIN', 'FRONTEND_URL', 'ORIGIN', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL'];

const withEnvironment = (values, callback) => {
  const previous = Object.fromEntries(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  for (const key of CONFIG_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    callback();
  } finally {
    for (const key of CONFIG_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

test('production configuration rejects missing secrets and origins', () => {
  withEnvironment({ NODE_ENV: 'production' }, () => {
    assert.throws(() => validateProductionRuntime(), /Missing required production configuration/);
  });
});

test('production configuration requires HTTPS application origins', () => {
  withEnvironment({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://database/microjobs',
    JWT_SECRET: 'test-only-secret',
    WEB_ORIGIN: 'http://app.example.com',
    FRONTEND_URL: 'http://app.example.com',
  }, () => {
    assert.throws(() => validateProductionRuntime(), /must use HTTPS/);
  });
});

test('production configuration accepts complete HTTPS settings', () => {
  withEnvironment({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://database/microjobs',
    JWT_SECRET: 'test-only-secret',
    WEB_ORIGIN: 'https://app.example.com',
    FRONTEND_URL: 'https://app.example.com',
  }, () => {
    assert.doesNotThrow(() => validateProductionRuntime());
  });
});

test('configured web origins remove repeated trailing slashes', () => {
  withEnvironment({
    NODE_ENV: 'production',
    WEB_ORIGIN: 'https://micro-job-1.vercel.app//',
  }, () => {
    assert.equal(getWebOrigin(), 'https://micro-job-1.vercel.app');
  });
});

test('production configuration derives the web origin from Vercel runtime metadata', () => {
  withEnvironment({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://database/microjobs',
    JWT_SECRET: 'test-only-secret',
    VERCEL_URL: 'microjobs-preview.vercel.app',
  }, () => {
    assert.equal(getWebOrigin(), 'https://microjobs-preview.vercel.app');
    assert.doesNotThrow(() => validateProductionRuntime());
  });
});

test('Vercel runtime metadata keeps deployment and production aliases available', () => {
  withEnvironment({
    NODE_ENV: 'production',
    WEB_ORIGIN: 'https://old-project.vercel.app',
    VERCEL_URL: 'microjobs-random-id.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'https://micro-job-1.vercel.app/',
  }, () => {
    assert.deepEqual(getVercelOrigins(), [
      'https://microjobs-random-id.vercel.app',
      'https://micro-job-1.vercel.app',
    ]);
    assert.equal(getWebOrigin(), 'https://old-project.vercel.app');
  });
});
