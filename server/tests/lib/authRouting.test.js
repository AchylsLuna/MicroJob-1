import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import { registerRoutes } from '../../routes/index.js';

const startTestServer = async () => {
  const app = express();
  app.use(express.json());
  registerRoutes(app);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
};

const stopTestServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test('authentication endpoints are mounted below /api/auth', async () => {
  const server = await startTestServer();
  const { port } = server.address();

  try {
    const [loginResponse, registerResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      fetch(`http://127.0.0.1:${port}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    ]);

    assert.equal(loginResponse.status, 400);
    assert.equal(registerResponse.status, 400);
    assert.equal((await loginResponse.json()).message, 'Password is required');
    assert.equal((await registerResponse.json()).message, 'Email is required');
  } finally {
    await stopTestServer(server);
  }
});
