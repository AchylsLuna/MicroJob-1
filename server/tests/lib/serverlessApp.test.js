import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import app from '../../app.js';

const stopServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test('serverless health endpoint responds without HTTPS redirects or a database connection', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      redirect: 'manual',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'microjobs-api');
    assert.match(body.databaseId, /^[a-f0-9]{12}$/);
    assert.equal(typeof body.environment, 'string');
    assert.equal(typeof body.revision, 'string');
  } finally {
    await stopServer(server);
  }
});
