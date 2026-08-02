import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import test from 'node:test';

const reservePort = async () => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
};

test('development launcher overrides production mode and starts the local API', { timeout: 30_000 }, async () => {
  const port = await reservePort();
  const child = spawn(process.execPath, ['scripts/start-development.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WEB_ORIGIN: '',
      CLIENT_ORIGIN: '',
      MONGO_URI: '',
      MONGODB_URI: '',
      ENABLE_IN_MEMORY_MONGO: 'true',
      AUTO_SEED_DEMO_USER: 'false',
      AUTO_SEED_SUPERADMIN: 'false',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Server did not start. Output:\n${output}`)), 25_000);
      const inspect = () => {
        if (!output.includes(`Server is running on http://localhost:${port}`)) return;
        clearTimeout(timeout);
        resolve();
      };
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}. Output:\n${output}`));
      });
    });

    assert.doesNotMatch(output, /WEB_ORIGIN or CLIENT_ORIGIN must be configured/);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
});
