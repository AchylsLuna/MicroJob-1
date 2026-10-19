import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('Vercel routes API and uploads to the Express function before the SPA fallback', () => {
  const config = JSON.parse(readFileSync(resolve(repositoryRoot, 'vercel.json'), 'utf8'));

  assert.deepEqual(config.rewrites, [
    { source: '/api/(.*)', destination: '/api' },
    { source: '/uploads/(.*)', destination: '/api' },
    { source: '/((?!api(?:/|$)|uploads(?:/|$)).*)', destination: '/index.html' },
  ]);
  assert.deepEqual(config.crons, [
    { path: '/api/cron/payment-review-reminders', schedule: '*/15 * * * *' },
    { path: '/api/cron/daily-payment-reminders', schedule: '0 */12 * * *' },
  ]);
  assert.equal(existsSync(resolve(repositoryRoot, 'api/index.js')), true);
  assert.equal(existsSync(resolve(repositoryRoot, 'api/[...path].js')), false);
});
