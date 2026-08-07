import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../../index.js', import.meta.url);
const appUrl = new URL('../../app.js', import.meta.url);

test('server index remains a thin lifecycle entrypoint', async () => {
  const source = await readFile(indexUrl, 'utf8');

  assert.match(source, /import app from ['"]\.\/app\.js['"]/);
  assert.match(source, /export const startServer/);
  assert.match(source, /export const shutdown/);
  assert.match(source, /initSocket\(server, \{ allowedOrigins \}\)/);
  assert.doesNotMatch(source, /from ['"]express['"]/);
  assert.doesNotMatch(source, /app\.use\(/);
  assert.ok(source.split(/\r?\n/).length < 120, 'server/index.js should stay focused on process lifecycle');
});

test('shared app owns HTTP middleware and route composition', async () => {
  const source = await readFile(appUrl, 'utf8');

  assert.match(source, /applySecurityMiddleware\(/);
  assert.match(source, /csrfForCookieSession/);
  assert.match(source, /createUploadsRouter\(/);
  assert.match(source, /registerRoutes\(app\)/);
  assert.match(source, /errorHandler\(isProduction\)/);
});
