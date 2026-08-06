#!/usr/bin/env node

const net = require('net');
const { spawn, spawnSync } = require('child_process');

const extraArgs = process.argv.slice(2);
const maxPortScan = Number(process.env.EXPO_PORT_SCAN_LIMIT || 20);
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

    if (await isPortFree(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find a free Metro port between ${startPort} and ${startPort + maxOffset}.`);
}

async function main() {
  assertExpoGoCompatibility();

  const requestedPort = parseRequestedPort(extraArgs);
  const forwardedArgs = stripPortArgs(extraArgs);
  const port = await findFreePort(requestedPort, maxPortScan);

  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is already in use. Starting Expo on port ${port} instead.`);
  }

  const hasExplicitClientMode = forwardedArgs.some((arg) => explicitClientModes.has(arg));
  const hasExplicitHostMode = forwardedArgs.some((arg) => explicitHostModes.has(arg));

  const modeArgs = [];

  // Default to Expo Go QR flow unless explicitly overridden.
  if (!hasExplicitClientMode && envClientMode !== 'none') {
    modeArgs.push(envClientMode === 'dev-client' ? '--dev-client' : '--go');
  }

  // Optional host mode override via env (lan/localhost/tunnel).
  if (!hasExplicitHostMode && explicitHostModes.has(`--${envHostMode}`)) {
    modeArgs.push(`--${envHostMode}`);
  }

  const wantsIOS = forwardedArgs.some((arg) => iosFlags.has(arg));
  const simctlAvailable = canUseSimctl();
  const childEnv = {
    ...process.env,
  };

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
