import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const metroSource = readFileSync(path.join(root, 'Mobile/metro.config.js'), 'utf8');

function loadMetro(env = {}, requests = []) {
  const module = { exports: {} };
  runInNewContext(metroSource, {
    module,
    __dirname: path.join(root, 'Mobile'),
    process: { env },
    URL,
    require(name) {
      if (name === 'expo/metro-config') return { getDefaultConfig: () => ({ resolver: {}, server: {} }) };
      if (name === 'path') return path;
      if (name === 'http' || name === 'https') {
        return {
          request(options) {
            if (options.protocol !== `${name}:`) throw new Error(`Wrong transport: ${name} for ${options.protocol}`);
            requests.push(options);
            return new EventEmitter();
          },
        };
      }
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return module.exports;
}

test('Metro uses HTTPS for deployed API and Socket.IO proxy requests', () => {
  const requests = [];
  const config = loadMetro({}, requests);
  const middleware = config.server.enhanceMiddleware(() => assert.fail('Unexpected Metro fallback'));
  for (const url of ['/microjobs-api/api/health', '/microjobs-socket/?EIO=4&transport=polling']) {
    middleware({ url, method: 'GET', headers: {}, pipe() {} }, {});
  }
  assert.equal(requests[0].hostname, 'microjobs-api-test.azurewebsites.net');
  assert.equal(requests[0].path, '/api/health');
  assert.equal(requests[1].path, '/socket.io/?EIO=4&transport=polling');
});

test('Metro continues to reject local API targets', () => {
  assert.throws(() => loadMetro({ MICROJOBS_METRO_API_TARGET: 'http://127.0.0.1:5050' }), /Local Metro API targets are disabled/);
});

test('Metro readiness identifies the project without contacting the deployed API', () => {
  const requests = [];
  const config = loadMetro({}, requests);
  const middleware = config.server.enhanceMiddleware(() => assert.fail('Unexpected Metro fallback'));
  let status;
  let body;
  middleware({ url: '/microjobs-dev/health' }, {
    writeHead(code) { status = code; },
    end(value) { body = value; },
  });
  assert.equal(status, 200);
  assert.deepEqual(JSON.parse(body), { service: 'microjobs-metro' });
  assert.equal(requests.length, 0);
});

async function runLauncher({ upstreamStatus = 200, reused = false, metroService = 'microjobs-metro' } = {}) {
  let expoStarted = false;
  let failure;
  const output = [];
  const paths = [];
  let elapsed = 0;
  let finish;
  const completed = new Promise((resolve) => { finish = resolve; });
  const timer = setTimeout(() => finish(), 1000);
  const processStub = {
    argv: ['node', 'scripts/dev.cjs'], env: {}, platform: 'linux', execPath: 'node',
    cwd: () => root, once() {}, exit() { finish(); },
  };
  const childProcess = {
    spawn(_command, args, options) {
      assert.ok(args.includes('Mobile'), 'Only Expo should start when API and web are healthy');
      try { loadMetro(options.env); } catch (error) { failure = error; throw error; }
      expoStarted = true;
      return new EventEmitter();
    },
    spawnSync: () => ({ stdout: '' }),
  };
  const http = {
    get(url, _options, callback) {
      const request = new EventEmitter();
      const response = new EventEmitter();
      response.statusCode = 200;
      response.setEncoding = () => {};
      const parsed = new URL(url);
      let body = '';
      if (parsed.port === '5050') body = JSON.stringify({ service: 'microjobs-api', environment: 'test', databaseId: 'fixture' });
      else if (parsed.port === '8082') body = '<title>MicroJobs</title>';
      else if (!expoStarted && !reused) response.statusCode = 503;
      else if (parsed.pathname === '/status') body = 'packager-status:running';
      else if (parsed.pathname === '/microjobs-dev/health') body = JSON.stringify({ service: metroService });
      else {
        response.statusCode = upstreamStatus;
        body = upstreamStatus === 200
          ? parsed.pathname.endsWith('/health') ? JSON.stringify({ service: 'microjobs-api' }) : '0{"sid":"fixture"}'
          : 'The deployed API is unavailable';
      }
      paths.push(parsed.pathname);
      queueMicrotask(() => {
        callback(response);
        response.emit('data', body);
        response.emit('end');
      });
      return request;
    },
  };
  const net = {
    createConnection() {
      const socket = new EventEmitter();
      socket.setTimeout = () => {};
      socket.destroy = () => {};
      queueMicrotask(() => socket.emit(reused ? 'connect' : 'error', new Error('Port is free')));
      return socket;
    },
  };
  try {
    runInNewContext(readFileSync(path.join(root, 'scripts/dev.cjs'), 'utf8'), {
      process: processStub,
      console: {
        log(message) { output.push(message); if (message.includes('Press Ctrl+C')) finish(); },
        error(message) { output.push(message); finish(); },
      },
      Date: { now: () => elapsed },
      setTimeout(callback, delay) {
        if (delay !== 500) return setTimeout(callback, delay);
        elapsed += delay;
        queueMicrotask(callback);
      },
      URL,
      require(name) {
        if (name === 'node:child_process') return childProcess;
        if (name === 'node:http') return http;
        if (name === 'node:net') return net;
        if (name === 'node:os') return { networkInterfaces: () => ({}) };
        throw new Error(`Unexpected module: ${name}`);
      },
    });
    await completed;
    assert.ifError(failure);
    return { output, paths, expoStarted };
  } finally {
    clearTimeout(timer);
  }
}

test('unified launcher starts Expo with a compatible deployed API target', async () => {
  const { output } = await runLauncher();
  assert.ok(output.some((line) => line.includes('MicroJobs is ready')), output.join('\n'));
});

test('deployed API outage does not time out and stop healthy local services', async () => {
  const { output, paths } = await runLauncher({ upstreamStatus: 403 });
  assert.ok(output.some((line) => line.includes('MicroJobs is ready')), output.join('\n'));
  assert.ok(paths.includes('/microjobs-dev/health'));
  assert.ok(!paths.some((path) => path.startsWith('/microjobs-api') || path.startsWith('/microjobs-socket')));
});

test('unified launcher reuses its Metro during a deployed API outage', async () => {
  const { output, expoStarted } = await runLauncher({ upstreamStatus: 403, reused: true });
  assert.ok(output.some((line) => line.includes('MicroJobs is ready')), output.join('\n'));
  assert.equal(expoStarted, false);
});

test('unified launcher rejects another project on the Metro port', async () => {
  const { output, expoStarted } = await runLauncher({ reused: true, metroService: 'other-project' });
  assert.ok(output.some((line) => line.includes('Metro port 8081 is occupied')), output.join('\n'));
  assert.ok(!output.some((line) => line.includes('MicroJobs is ready')));
  assert.equal(expoStarted, false);
});

async function runExpoReuse(identity) {
  const output = [];
  const paths = [];
  let qr;
  let finish;
  const completed = new Promise((resolve) => { finish = resolve; });
  const timer = setTimeout(() => finish(), 1000);
  try {
    runInNewContext(readFileSync(path.join(root, 'Mobile/scripts/startExpo.cjs'), 'utf8'), {
      process: {
        argv: ['node', 'scripts/startExpo.cjs'], env: {}, platform: 'linux',
        exit(code) { output.push(`exit:${code}`); finish(); },
      },
      console: {
        log(message) { output.push(message); if (message.includes('Scan this QR')) finish(); },
        error(message) { output.push(message); finish(); },
      },
      require(name) {
        if (name === 'expo/package.json') return { version: '57.0.28' };
        if (name === 'react-native/package.json') return { version: '0.86.3' };
        if (name === 'child_process') return {
          spawn() { assert.fail('Existing Metro should be reused'); },
          spawnSync() { return { stdout: '' }; },
        };
        if (name === 'qrcode') return { async toString(url) { qr = url; return 'QR fixture'; } };
        if (name === 'os') return { networkInterfaces: () => ({ eth0: [{ family: 'IPv4', address: '192.168.1.10', internal: false }] }) };
        if (name === 'net') return {
          createServer() {
            const server = new EventEmitter();
            server.listen = () => queueMicrotask(() => server.emit('error', new Error('Port occupied')));
            return server;
          },
        };
        if (name === 'http') return {
          get({ path }, callback) {
            paths.push(path);
            const request = new EventEmitter();
            const response = new EventEmitter();
            response.statusCode = path === '/status' || path === '/microjobs-dev/health' ? 200 : 403;
            response.setEncoding = () => {};
            queueMicrotask(() => {
              callback(response);
              response.emit('data', path === '/status' ? 'packager-status:running' : JSON.stringify({ service: identity }));
              response.emit('end');
            });
            return request;
          },
        };
        throw new Error(`Unexpected module: ${name}`);
      },
    });
    await completed;
    return { output, paths, qr };
  } finally { clearTimeout(timer); }
}

test('standalone Expo launcher prints an existing Metro QR without deployed API checks', async () => {
  const { output, paths, qr } = await runExpoReuse('microjobs-metro');
  assert.equal(qr, 'exp://192.168.1.10:8081', output.join('\n'));
  assert.deepEqual(paths, ['/status', '/microjobs-dev/health']);
  assert.ok(output.includes('Mobile API: https://microjobs-api-test.azurewebsites.net/api'));
  assert.ok(!output.some((line) => line.includes('verified through')));
});

test('standalone Expo launcher rejects another project on the Metro port', async () => {
  const { output, qr } = await runExpoReuse('other-project');
  assert.equal(qr, undefined);
  assert.ok(output.some((line) => line.includes('belongs to another project')), output.join('\n'));
});
