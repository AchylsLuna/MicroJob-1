#!/usr/bin/env node

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const extraArgs = process.argv.slice(2);
const requestedPort = Number(process.env.METRO_PORT || process.env.EXPO_METRO_PORT || 8081);
const maxPortScan = Number(process.env.EXPO_PORT_SCAN_LIMIT || 20);

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

  const expoBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'expo.cmd' : 'expo'
  );

  const child = spawn(expoBin, ['start', '--port', String(port), ...extraArgs], {
    stdio: 'inherit',
    env: process.env,
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
