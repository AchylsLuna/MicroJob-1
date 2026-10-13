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

test('unified launcher starts Expo with a compatible deployed API target', async () => {
  let expoStarted = false;
  let failure;
  const output = [];
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
      else if (!expoStarted) response.statusCode = 503;
      else if (parsed.pathname === '/status') body = 'packager-status:running';
      else if (parsed.pathname.endsWith('/health')) body = JSON.stringify({ service: 'microjobs-api' });
      else body = '0{"sid":"fixture"}';
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
      queueMicrotask(() => socket.emit('error', new Error('Port is free')));
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
      setTimeout, URL,
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
    assert.ok(output.some((line) => line.includes('MicroJobs is ready')), output.join('\n'));
  } finally {
    clearTimeout(timer);
  }
});
