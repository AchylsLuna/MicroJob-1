#!/usr/bin/env node

const net = require('net');
const http = require('http');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const extraArgs = process.argv.slice(2);
const explicitClientModes = new Set(['--go', '--dev-client']);
const explicitHostModes = new Set(['--lan', '--localhost', '--tunnel']);
const iosFlags = new Set(['--ios', '-i']);

const envClientMode = (process.env.EXPO_START_CLIENT || 'go').trim().toLowerCase();
const envHostMode = (process.env.EXPO_START_HOST || '').trim().toLowerCase();

const supportedExpoSdk = 54;
const supportedReactNative = '0.81.5';

function readPackageVersion(packageName) {
  return require(`${packageName}/package.json`).version;
}

function assertExpoGoCompatibility() {
  const expoVersion = readPackageVersion('expo');
  const reactNativeVersion = readPackageVersion('react-native');
  const expoSdk = Number.parseInt(expoVersion.split('.')[0], 10);

  if (expoSdk !== supportedExpoSdk || reactNativeVersion !== supportedReactNative) {
    throw new Error(
      `Expo Go compatibility check failed: expected Expo SDK ${supportedExpoSdk} with React Native ${supportedReactNative}, `
      + `but resolved Expo ${expoVersion} with React Native ${reactNativeVersion}. Run \`npm ci\` in Mobile and try again.`,
    );
  }

  console.log(`Expo Go target: SDK ${supportedExpoSdk} (Expo ${expoVersion}, React Native ${reactNativeVersion}).`);
  console.log('If Expo Go reports an SDK mismatch, update it or install the SDK 54 client from https://expo.dev/go.');
  console.log('Older Expo Go clients can be installed on Android devices/emulators and iOS simulators, but not physical iPhones.');
}

function parseRequestedPort(args) {
  const fallbackPort = Number(process.env.METRO_PORT || process.env.EXPO_METRO_PORT || 8081);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port' || arg === '-p') {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    if (arg.startsWith('--port=')) {
      const value = Number(arg.slice('--port='.length));
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  }

  return fallbackPort;
}

function stripPortArgs(args) {
  const sanitized = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port' || arg === '-p') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      continue;
    }
    sanitized.push(arg);
  }

  return sanitized;
}

function canUseSimctl() {
  if (process.platform !== 'darwin') {
    return false;
  }

  const result = spawnSync('xcrun', ['simctl', 'help'], {
    stdio: 'ignore',
  });

  return result.status === 0;
}

function isPrivateIpv4(address) {
  if (/^10\./.test(address) || /^192\.168\./.test(address)) return true;
  const match = /^172\.(\d+)\./.exec(address);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function getLanAddress() {
  const virtualInterfacePattern = /virtual|vmware|vmnet|vbox|virtualbox|hyper-v|loopback|docker|wsl/i;
  const candidates = [];

  for (const [interfaceName, addresses] of Object.entries(os.networkInterfaces())) {
    for (const item of addresses || []) {
      if (item.family !== 'IPv4' || item.internal || !isPrivateIpv4(item.address)) continue;
      candidates.push({
        address: item.address,
        priority: virtualInterfacePattern.test(interfaceName) ? 1 : 0,
      });
    }
  }

  candidates.sort((left, right) => left.priority - right.priority);
  return candidates[0]?.address || '';
}

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

function isMetroRunning(port) {
  return new Promise((resolve) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/status', timeout: 1500 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(response.statusCode === 200 && body.includes('packager-status:running')));
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

function requestText(port, path) {
  return new Promise((resolve) => {
    const request = http.get({ hostname: '127.0.0.1', port, path, timeout: 2000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode || 0, body }));
    });
    request.on('timeout', () => { request.destroy(); resolve({ status: 0, body: '' }); });
    request.on('error', () => resolve({ status: 0, body: '' }));
  });
}

function getPortOwnerCommand(port) {
  if (process.platform === 'win32') return '';
  const pids = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    .stdout.trim().split(/\s+/).filter(Boolean);
  if (!pids.length) return '';
  return spawnSync('ps', ['-o', 'command=', '-p', pids.join(',')], { encoding: 'utf8' }).stdout.trim();
}

async function printReusableMetroQr(port) {
  const [apiHealth, socketHandshake] = await Promise.all([
    requestText(port, '/microjobs-api/api/health'),
    requestText(port, '/microjobs-socket/?EIO=4&transport=polling'),
  ]);
  if (apiHealth.status !== 200 || !apiHealth.body.includes('microjobs-api')) {
    throw new Error(`Metro is running on port ${port}, but its MicroJobs API proxy is unavailable. Stop the existing Metro process and run \`npm run dev\` from the repository root.`);
  }
  if (socketHandshake.status !== 200 || !socketHandshake.body.includes('sid')) {
    throw new Error(`Metro is running on port ${port}, but its MicroJobs realtime proxy is unavailable. Stop the existing Metro process and run \`npm run dev\` from the repository root.`);
  }

  const ownerCommand = getPortOwnerCommand(port);
  if (/(?:^|\s)--tunnel(?:\s|$)/.test(ownerCommand)) {
    console.log(`MicroJobs Metro is already healthy in tunnel mode on port ${port}.`);
    console.log('The secure tunnel QR belongs to the running Expo terminal. Stop that process and run `npm run dev:tunnel` to print a new tunnel QR here.');
    return;
  }

  const localhostMode = /(?:^|\s)--localhost(?:\s|$)/.test(ownerCommand);
  const host = localhostMode ? '127.0.0.1' : getLanAddress();
  if (!host) {
    throw new Error('Metro is healthy, but no private LAN address is available. Stop it and run `npm run dev:tunnel`.');
  }

  const expoUrl = `exp://${host}:${port}`;
  const mobileApiUrl = `http://${host}:${port}/microjobs-api/api`;
  const qrcode = require('qrcode-terminal');
  console.log('\nMicroJobs Expo Go is ready');
  console.log(`  Expo:       ${expoUrl}`);
  console.log(`  Mobile API: ${mobileApiUrl}`);
  console.log('  Realtime:   verified through /microjobs-socket');
  qrcode.generate(expoUrl, { small: true });
  console.log('Scan this QR with Expo Go. The existing Metro process will continue serving the app.');
}

async function main() {
  assertExpoGoCompatibility();

  const requestedPort = parseRequestedPort(extraArgs);
  const forwardedArgs = stripPortArgs(extraArgs);
  if (!(await isPortFree(requestedPort))) {
    if (await isMetroRunning(requestedPort)) {
      await printReusableMetroQr(requestedPort);
      return;
    }
    throw new Error(`Metro port ${requestedPort} is already in use by another process. Stop that process or set METRO_PORT explicitly.`);
  }
  const port = requestedPort;

  const hasExplicitClientMode = forwardedArgs.some((arg) => explicitClientModes.has(arg));
  const hasExplicitHostMode = forwardedArgs.some((arg) => explicitHostModes.has(arg));

  const modeArgs = [];

  // Default to Expo Go QR flow unless explicitly overridden.
  if (!hasExplicitClientMode && envClientMode !== 'none') {
    modeArgs.push(envClientMode === 'dev-client' ? '--dev-client' : '--go');
  }

  // Physical devices need LAN mode by default. Callers can still explicitly
  // select localhost (emulator/web only) or tunnel.
  if (!hasExplicitHostMode) {
    modeArgs.push(explicitHostModes.has(`--${envHostMode}`) ? `--${envHostMode}` : '--lan');
  }

  const wantsIOS = forwardedArgs.some((arg) => iosFlags.has(arg));
  const simctlAvailable = canUseSimctl();
  const childEnv = {
    ...process.env,
    EXPO_NO_METRO_WORKSPACE_ROOT: process.env.EXPO_NO_METRO_WORKSPACE_ROOT || '1',
  };

  const usesLocalhost = forwardedArgs.includes('--localhost') || modeArgs.includes('--localhost');
  if (!childEnv.EXPO_PUBLIC_API_URL && !usesLocalhost) {
    // Generic PORT is frequently set by hosting tools and belongs to the
    // process being launched, not necessarily the MicroJobs API.
    const apiPort = String(childEnv.EXPO_PUBLIC_API_PORT || childEnv.DEV_API_PORT || '5050');
    const lanAddress = getLanAddress();
    if (!lanAddress && !forwardedArgs.includes('--tunnel') && !modeArgs.includes('--tunnel')) {
      console.warn('No private LAN address was detected. Set EXPO_PUBLIC_API_URL to the API address reachable by your phone.');
    }
    childEnv.MICROJOBS_METRO_API_TARGET = `http://127.0.0.1:${apiPort}`;
    childEnv.EXPO_PUBLIC_SOCKET_PATH = '/microjobs-socket';
    childEnv.EXPO_PUBLIC_API_SOURCE = 'development-metro-proxy';
    console.log('Mobile API: derived from the Expo QR host through Metro proxy');
  } else if (childEnv.EXPO_PUBLIC_API_URL) {
    console.log(`Mobile API: ${childEnv.EXPO_PUBLIC_API_URL}`);
  }

  if (process.platform === 'darwin' && !simctlAvailable) {
    if (wantsIOS) {
      console.error('Unable to start iOS: `xcrun simctl` is not available on this machine.');
      console.error('Install Xcode and run `sudo xcode-select -s /Applications/Xcode.app`, then try again.');
      process.exit(1);
    }

    // Prevent Expo CLI from probing iOS simulators when simctl is unavailable.
    childEnv.EXPO_NO_IOS_SIMCTL_CHECK = '1';
    console.warn('xcrun simctl is unavailable; starting Expo without iOS simulator integration.');
  }

  const expoCli = require.resolve('expo/bin/cli');

  // Use Node to execute Expo CLI directly to avoid Windows .cmd spawn issues.
  const child = spawn(process.execPath, [expoCli, 'start', '--port', String(port), ...modeArgs, ...forwardedArgs], {
    stdio: 'inherit',
    env: childEnv,
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
