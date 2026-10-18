import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadEvidenceToAzure, getEvidenceFromAzure, deleteEvidenceFromAzure } from '../../lib/azureEvidenceStorage.js';

test('evidence uses its separate configured container, private headers, and conditional writes', async (t) => {
  const previous = { connection: process.env.AZURE_EVIDENCE_CONNECTION_STRING, container: process.env.AZURE_EVIDENCE_CONTAINER_NAME };
  t.after(() => {
    for (const [name, value] of [['AZURE_EVIDENCE_CONNECTION_STRING', previous.connection], ['AZURE_EVIDENCE_CONTAINER_NAME', previous.container]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.AZURE_EVIDENCE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  process.env.AZURE_EVIDENCE_CONTAINER_NAME = 'private-evidence';
  const calls = [];
  const blobServiceClient = { getContainerClient(container) {
    assert.equal(container, 'private-evidence');
    return { getBlockBlobClient(filename) {
      assert.equal(filename, 'completion-evidence_test.png');
      return {
        async uploadData(data, options) { calls.push({ data, options }); },
        async downloadToBuffer() { return Buffer.from('image'); },
        async getProperties() { return { contentType: 'image/png' }; },
        async deleteIfExists() { return { succeeded: true }; },
      };
    } };
  } };
  const filename = 'completion-evidence_test.png';
  await uploadEvidenceToAzure({ filename, buffer: Buffer.from('image'), contentType: 'image/png' }, { blobServiceClient });
  assert.deepEqual(calls[0].options, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'image/png', blobCacheControl: 'private, no-store' } });
  assert.equal((await getEvidenceFromAzure(filename, { blobServiceClient })).data.toString(), 'image');
  assert.equal((await deleteEvidenceFromAzure(filename, { blobServiceClient })).succeeded, true);
  await assert.rejects(getEvidenceFromAzure('../secret', { blobServiceClient }), /Invalid/);
  process.env.AZURE_EVIDENCE_CONTAINER_NAME = '';
  await assert.rejects(uploadEvidenceToAzure({ filename, buffer: Buffer.from('image') }, { blobServiceClient }), { status: 503 });
});

test('Azure upload failures return actionable errors without logging credential-bearing messages', async (t) => {
  const previous = [process.env.AZURE_EVIDENCE_CONNECTION_STRING, process.env.AZURE_EVIDENCE_CONTAINER_NAME];
  t.after(() => ['AZURE_EVIDENCE_CONNECTION_STRING', 'AZURE_EVIDENCE_CONTAINER_NAME'].forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
  }));
  process.env.AZURE_EVIDENCE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  process.env.AZURE_EVIDENCE_CONTAINER_NAME = 'evidence';
  const warn = t.mock.method(console, 'warn', () => {});
  const samples = [
    ['ContainerNotFound', 404, /container does not exist/],
    ['KeyBasedAuthenticationNotPermitted', 403, /key access is disabled/],
    ['AuthenticationFailed', 403, /rejected.*credentials/],
    ['AuthorizationFailure', 403, /network rules/],
    ['ECONNREFUSED', undefined, /unavailable/],
  ];
  for (const [code, statusCode, message] of samples) {
    const blobServiceClient = { getContainerClient: () => ({ getBlockBlobClient: () => ({ uploadData: async () => { throw Object.assign(new Error('AccountKey=NEVER_PRINT_THIS_SECRET'), { code, statusCode }); } }) }) };
    await assert.rejects(uploadEvidenceToAzure({ filename: 'test.png', buffer: Buffer.from('image'), contentType: 'image/png' }, { blobServiceClient }), (error) => error.status === 503 && message.test(error.message) && !error.message.includes('NEVER_PRINT'));
  }
  assert.equal(warn.mock.callCount(), samples.length);
  assert.ok(!JSON.stringify(warn.mock.calls).includes('NEVER_PRINT'));
  process.env.AZURE_EVIDENCE_CONNECTION_STRING = 'DefaultEndpointsProtoco&#x6C;=https;AccountKey=NEVER_PRINT_THIS_SECRET';
  await assert.rejects(uploadEvidenceToAzure({ filename: 'test.png', buffer: Buffer.from('image') }), (error) => error.status === 503 && /unmodified connection string/.test(error.message));
});
