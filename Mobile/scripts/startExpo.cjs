#!/usr/bin/env node

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const extraArgs = process.argv.slice(2);
const requestedPort = Number(process.env.METRO_PORT || process.env.EXPO_METRO_PORT || 8081);
const maxPortScan = Number(process.env.EXPO_PORT_SCAN_LIMIT || 20);
const explicitClientModes = new Set(['--go', '--dev-client']);
const explicitHostModes = new Set(['--lan', '--localhost', '--tunnel']);

const envClientMode = (process.env.EXPO_START_CLIENT || 'go').trim().toLowerCase();
const envHostMode = (process.env.EXPO_START_HOST || '').trim().toLowerCase();

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function findFreePort(startPort, maxOffset) {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find a free Metro port between ${startPort} and ${startPort + maxOffset}.`);
}

async function main() {
  const port = await findFreePort(requestedPort, maxPortScan);

  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is already in use. Starting Expo on port ${port} instead.`);
  }

  const hasExplicitClientMode = extraArgs.some((arg) => explicitClientModes.has(arg));
  const hasExplicitHostMode = extraArgs.some((arg) => explicitHostModes.has(arg));

  const modeArgs = [];

  // Default to Expo Go QR flow unless explicitly overridden.
  if (!hasExplicitClientMode && envClientMode !== 'none') {
    modeArgs.push(envClientMode === 'dev-client' ? '--dev-client' : '--go');
  }

  // Optional host mode override via env (lan/localhost/tunnel).
  if (!hasExplicitHostMode && explicitHostModes.has(`--${envHostMode}`)) {
    modeArgs.push(`--${envHostMode}`);
  }

  const expoBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'expo.cmd' : 'expo'
  );

  const child = spawn(expoBin, ['start', '--port', String(port), ...modeArgs, ...extraArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Expo CLI shows account login prompts in interactive mode.
      // Use CI mode by default to skip login selection prompts.
      CI: process.env.CI || '1',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
