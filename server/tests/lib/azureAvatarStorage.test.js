import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteAvatarFromAzure,
  getAvatarFromAzure,
  uploadAvatarToAzure,
} from '../../lib/azureAvatarStorage.js';

const withAzureEnvironment = async (callback) => {
  const originalConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const originalContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'avatars';
  try {
    await callback();
  } finally {
    if (originalConnectionString === undefined) delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    else process.env.AZURE_STORAGE_CONNECTION_STRING = originalConnectionString;
    if (originalContainerName === undefined) delete process.env.AZURE_STORAGE_CONTAINER_NAME;
    else process.env.AZURE_STORAGE_CONTAINER_NAME = originalContainerName;
  }
};

test('Azure avatar storage uses the configured avatars container and preserves content type', async () => {
  const calls = [];
  const blobClient = {
    async uploadData(data, options) { calls.push({ type: 'upload', data, options }); },
    async downloadToBuffer() { calls.push({ type: 'download' }); return Buffer.from('azure-avatar'); },
    async getProperties() { calls.push({ type: 'properties' }); return { contentType: 'image/png' }; },
    async deleteIfExists() { calls.push({ type: 'delete' }); return { succeeded: true }; },
  };
  const serviceClient = {
    getContainerClient(name) {
      calls.push({ type: 'container', name });
      return { getBlockBlobClient: (filename) => { calls.push({ type: 'blob', filename }); return blobClient; } };
    },
  };

  await withAzureEnvironment(async () => {
    const uploaded = await uploadAvatarToAzure({
      filename: 'avatar_user_1.png',
      buffer: Buffer.from('avatar'),
      contentType: 'image/png',
    }, { blobServiceClient: serviceClient });
    const avatar = await getAvatarFromAzure('avatar_user_1.png', { blobServiceClient: serviceClient });
    const deleted = await deleteAvatarFromAzure('/uploads/avatar_user_1.png', { blobServiceClient: serviceClient });

    assert.deepEqual(uploaded, { uploaded: true, configured: true });
    assert.equal(avatar.data.toString(), 'azure-avatar');
    assert.equal(avatar.contentType, 'image/png');
    assert.equal(deleted, true);
  });

  assert.ok(calls.some((call) => call.type === 'container' && call.name === 'avatars'));
  assert.ok(calls.some((call) => call.type === 'blob' && call.filename === 'avatar_user_1.png'));
  assert.deepEqual(calls.find((call) => call.type === 'upload').options.blobHTTPHeaders, {
    blobContentType: 'image/png',
    blobCacheControl: 'public, max-age=3600',
  });
});

test('Azure avatar storage is disabled without a connection string', async () => {
  const originalConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  try {
    assert.deepEqual(await uploadAvatarToAzure({ filename: 'avatar_user_1.png', buffer: Buffer.from('avatar') }), {
      uploaded: false,
      configured: false,
    });
    assert.equal(await getAvatarFromAzure('avatar_user_1.png'), null);
    assert.equal(await deleteAvatarFromAzure('avatar_user_1.png'), false);
  } finally {
    if (originalConnectionString !== undefined) process.env.AZURE_STORAGE_CONNECTION_STRING = originalConnectionString;
  }
});
