import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';

import handler from '../../../api/index.js';

const stopServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test('Vercel API entrypoint serves the serverless app without redirecting', async () => {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      redirect: 'manual',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-microjobs-handler'), 'api-index-v2');
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'microjobs-api');
    assert.match(body.databaseId, /^[a-f0-9]{12}$/);
  } finally {
    await stopServer(server);
  }
});
