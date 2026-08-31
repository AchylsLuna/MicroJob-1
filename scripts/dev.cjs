const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');

const args = process.argv.slice(2);
const tunnelMode = args.includes('--tunnel');
const mobileOnly = args.includes('--mobile-only');
const apiPort = Number(process.env.DEV_API_PORT || process.env.PORT || 5050);
const webPort = Number(process.env.DEV_CLIENT_PORT || 8082);
const metroPort = Number(process.env.METRO_PORT || process.env.EXPO_METRO_PORT || 8081);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://localhost:${webPort}`;
const metroOrigin = `http://127.0.0.1:${metroPort}`;
const ownedProcesses = [];
let shuttingDown = false;

const request = (url, timeout = 2500) => new Promise((resolve) => {
  const call = http.get(url, { timeout }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 0, body }));
  });
  call.on('timeout', () => { call.destroy(); resolve({ ok: false, status: 0, body: '' }); });
  call.on('error', () => resolve({ ok: false, status: 0, body: '' }));
});

const isPortOpen = (port) => new Promise((resolve) => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  const finish = (open) => {
    socket.removeAllListeners();
    socket.destroy();
    resolve(open);
  };
  socket.setTimeout(1000);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});

const waitFor = async (label, probe, timeout = 60_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const result = await probe();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready within ${Math.round(timeout / 1000)} seconds.`);
};

const describePortOwner = (port) => {
  if (process.platform === 'win32') return `another process on port ${port}`;
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  return result.stdout.trim() || `another process on port ${port}`;
};

const getPortOwnerCommand = (port) => {
  if (process.platform === 'win32') return '';
  const pids = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    .stdout.trim().split(/\s+/).filter(Boolean);
  if (!pids.length) return '';
  return spawnSync('ps', ['-o', 'command=', '-p', pids.join(',')], { encoding: 'utf8' }).stdout.trim();
};

const getLanAddress = () => {
  const virtual = /virtual|vmware|vmnet|vbox|virtualbox|hyper-v|loopback|docker|wsl/i;
  const candidates = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const item of addresses || []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      const privateAddress = /^10\./.test(item.address) || /^192\.168\./.test(item.address) || /^172\.(1[6-9]|2\d|3[01])\./.test(item.address);
      if (privateAddress) candidates.push({ address: item.address, priority: virtual.test(name) ? 1 : 0 });
    }
  }
  candidates.sort((left, right) => left.priority - right.priority);
  return candidates[0]?.address || '';
};

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of ownedProcesses) {
    if (!child.pid || child.killed) continue;
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') console.error(`Unable to stop process ${child.pid}: ${error.message}`);
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
};

const start = (label, command, commandArgs, environment) => {
  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  ownedProcesses.push(child);
  child.on('error', (error) => {
    console.error(`[${label}] Failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${label}] Exited with ${signal ? `signal ${signal}` : `code ${code ?? 1}`}.`);
    shutdown(code || 1);
  });
  return child;
};

const ensureApi = async (environment, npmCommand) => {
  const healthProbe = async () => {
    const response = await request(`${apiOrigin}/api/health`);
    if (!response.ok) return null;
    try {
      const payload = JSON.parse(response.body);
      return payload.service === 'microjobs-api' ? payload : null;
    } catch { return null; }
  };
  const existing = await healthProbe();
  if (existing) return { identity: existing, reused: true };
  if (await isPortOpen(apiPort)) throw new Error(`API port ${apiPort} is occupied by a non-MicroJobs service.\n${describePortOwner(apiPort)}\nRecovery: stop that process, then run npm run dev again.`);
  start('api', npmCommand, ['--prefix', 'server', 'run', 'dev'], environment);
  return { identity: await waitFor('MicroJobs API', healthProbe), reused: false };
};

const ensureWeb = async (environment) => {
  const webProbe = async () => {
    const response = await request(webOrigin);
    return response.ok && /<title>MicroJobs<\/title>/i.test(response.body) ? true : null;
  };
  if (await webProbe()) return { reused: true };
  if (await isPortOpen(webPort)) throw new Error(`Web port ${webPort} is occupied by a non-MicroJobs service.\n${describePortOwner(webPort)}\nRecovery: stop that process, then run npm run dev again.`);
  const commandArgs = ['scripts/run-with-node.cjs', 'vite', '--config', 'client/vite.config.ts', '--port', String(webPort)];
  if (!['1', 'true', 'yes'].includes(String(process.env.NO_OPEN || '').toLowerCase())) commandArgs.push('--open', '/admin-sign-in');
  start('web', process.execPath, commandArgs, environment);
  await waitFor('MicroJobs web app', webProbe, 30_000);
  return { reused: false };
};

const ensureMetro = async (environment, npmCommand) => {
  const metroProbe = async () => {
    const [status, api, socket] = await Promise.all([
      request(`${metroOrigin}/status`),
      request(`${metroOrigin}/microjobs-api/api/health`),
      request(`${metroOrigin}/microjobs-socket/?EIO=4&transport=polling`),
    ]);
    if (!status.ok || !status.body.includes('packager-status:running')) return null;
    if (!api.ok || !api.body.includes('microjobs-api')) return null;
    if (!socket.ok || !socket.body.includes('sid')) return null;
    return true;
  };
  if (await metroProbe()) {
    const ownerCommand = getPortOwnerCommand(metroPort);
    const existingTunnel = /(?:^|\s)--tunnel(?:\s|$)/.test(ownerCommand);
    if (existingTunnel !== tunnelMode) {
      throw new Error(`Metro port ${metroPort} is already running in ${existingTunnel ? 'tunnel' : 'LAN'} mode, but ${tunnelMode ? 'tunnel' : 'LAN'} mode was requested.\n${describePortOwner(metroPort)}\nRecovery: stop the existing Expo process, then rerun npm run ${tunnelMode ? 'dev:tunnel' : 'dev'}.`);
    }
    return { reused: true };
  }
  if (await isPortOpen(metroPort)) throw new Error(`Metro port ${metroPort} is occupied or has a stale MicroJobs proxy.\n${describePortOwner(metroPort)}\nRecovery: stop that process, then run npm run dev again.`);
  start('expo', npmCommand, ['--prefix', 'Mobile', 'run', 'start', '--', tunnelMode ? '--tunnel' : '--lan'], environment);
  await waitFor('Expo Metro and its API proxy', metroProbe, tunnelMode ? 120_000 : 60_000);
  return { reused: false };
};

const main = async () => {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const environment = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: String(apiPort),
    DEV_API_PORT: String(apiPort),
    DEV_CLIENT_PORT: String(webPort),
    METRO_PORT: String(metroPort),
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || webOrigin,
    VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET || apiOrigin,
    MICROJOBS_METRO_API_TARGET: apiOrigin,
    AUTO_SEED_SUPERADMIN: process.env.AUTO_SEED_SUPERADMIN || 'true',
    SUPERADMIN_RESET_PASSWORD: process.env.SUPERADMIN_RESET_PASSWORD || 'true',
  };

  console.log(`Starting MicroJobs development environment (${tunnelMode ? 'tunnel' : 'LAN'} mode)…`);
  const api = await ensureApi(environment, npmCommand);
  const web = mobileOnly ? null : await ensureWeb(environment);
  const metro = await ensureMetro(environment, npmCommand);
  const lanAddress = getLanAddress();
  const phoneApi = tunnelMode
    ? 'derived from the Expo tunnel QR host (/microjobs-api/api)'
    : lanAddress ? `http://${lanAddress}:${metroPort}/microjobs-api/api` : 'unavailable: no private LAN address detected';
  console.log('\nMicroJobs is ready');
  if (web) console.log(`  Web:       ${webOrigin}${web.reused ? ' (reused)' : ''}`);
  console.log(`  API:       ${apiOrigin}/api${api.reused ? ' (reused)' : ''}`);
  console.log(`  Database:  ${api.identity.environment}:${api.identity.databaseId}`);
  console.log(`  Expo:      ${tunnelMode ? 'scan the tunnel QR shown above' : lanAddress ? `exp://${lanAddress}:${metroPort}` : 'LAN address unavailable; use npm run dev:tunnel'}${metro.reused ? ' (reused)' : ''}`);
  console.log(`  Mobile API: ${phoneApi}`);
  if (metro.reused) console.log('  QR: reuse the QR in the existing Expo terminal; press r there to reload.');
  console.log('Press Ctrl+C to stop only the services started by this command.');
};

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
main().catch((error) => {
  console.error(`\nUnable to start MicroJobs:\n${error.message || error}`);
  shutdown(1);
});
