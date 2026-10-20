import { BlobServiceClient } from '@azure/storage-blob';
import { isSafeUploadFileName, normalizeStoredUploadName } from './uploadStore.js';

const DEFAULT_AVATAR_CONTAINER = 'avatars';

const getConfiguration = () => {
  const connectionString = String(process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  if (!connectionString) return null;

  return {
    connectionString,
    containerName: String(process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_AVATAR_CONTAINER).trim(),
  };
};

const getContainerClient = (configuration, blobServiceClient) => {
  const serviceClient = blobServiceClient || BlobServiceClient.fromConnectionString(configuration.connectionString);
  return serviceClient.getContainerClient(configuration.containerName);
};

const requireSafeAvatarFileName = (value) => {
  const filename = normalizeStoredUploadName(value);
  if (!isSafeUploadFileName(filename)) throw new Error('Invalid avatar file name');
  return filename;
};

/**
 * Stores an avatar in Azure when configured. The caller keeps the Mongo-backed
 * StoredUpload as a backup, so a disabled Azure integration is not an error.
 */
export async function uploadAvatarToAzure({ filename, buffer, contentType }, { blobServiceClient } = {}) {
  const configuration = getConfiguration();
  if (!configuration) return { uploaded: false, configured: false };

  const safeFilename = requireSafeAvatarFileName(filename);
  if (!Buffer.isBuffer(buffer)) throw new Error('Invalid avatar data');

  const blockBlobClient = getContainerClient(configuration, blobServiceClient).getBlockBlobClient(safeFilename);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType || 'application/octet-stream',
      blobCacheControl: 'public, max-age=3600',
    },
  });

  return { uploaded: true, configured: true };
}

/**
 * Returns null for an absent blob or disabled Azure integration. Other Azure
 * failures are deliberately surfaced so callers can use their backup store.
 */
export async function getAvatarFromAzure(value, { blobServiceClient } = {}) {
  const configuration = getConfiguration();
  if (!configuration) return null;

  const safeFilename = requireSafeAvatarFileName(value);
  const blockBlobClient = getContainerClient(configuration, blobServiceClient).getBlockBlobClient(safeFilename);
  try {
    const [data, properties] = await Promise.all([
      blockBlobClient.downloadToBuffer(),
      blockBlobClient.getProperties(),
    ]);
    return {
      data,
      contentType: properties.contentType || 'application/octet-stream',
    };
  } catch (error) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
}

export async function deleteAvatarFromAzure(value, { blobServiceClient } = {}) {
  const configuration = getConfiguration();
  if (!configuration) return false;

  const safeFilename = requireSafeAvatarFileName(value);
  const blockBlobClient = getContainerClient(configuration, blobServiceClient).getBlockBlobClient(safeFilename);
  const result = await blockBlobClient.deleteIfExists();
  return Boolean(result.succeeded);
}
