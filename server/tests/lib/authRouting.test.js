import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import authRoutes from '../../routes/authRoutes.js';
import profileRoutes from '../../routes/ProfileRoute.js';
import { registerRoutes } from '../../routes/index.js';

const routePaths = (router) => router.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path]);

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

test('profile endpoints are composed by the dedicated profile router', () => {
  const authPaths = routePaths(authRoutes);
  const profilePaths = routePaths(profileRoutes);

  assert.equal(authPaths.includes('/login'), true);
  assert.equal(authPaths.some((path) => path === '/profile' || path.startsWith('/profile/')), false);
  assert.equal(profilePaths.includes('/profile'), true);
  assert.equal(profilePaths.includes('/profile/skills'), true);
  assert.equal(profilePaths.includes('/profile/experience'), true);
});

test('legacy and modular file access-link paths remain mounted', async () => {
  const server = await startTestServer();
  const { port } = server.address();

  try {
    const responses = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/auth/files/resume.pdf/access-link`),
      fetch(`http://127.0.0.1:${port}/api/auth/profile/files/resume.pdf/access-link`),
    ]);

    assert.deepEqual(responses.map((response) => response.status), [401, 401]);
  } finally {
    await stopTestServer(server);
  }
});
