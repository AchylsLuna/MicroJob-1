import { BlobServiceClient } from '@azure/storage-blob';
import { isSafeUploadFileName } from './uploadStore.js';

const storageFailure = (error, operation) => {
  const rawCode = String(error?.code || error?.name || 'Unknown');
  const code = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(rawCode) ? rawCode : 'Unknown';
  // Azure errors can contain signed requests and credentials. Log only these
  // diagnostic fields, never the error object, message, URL, or connection string.
  console.warn('Azure evidence storage failure:', { operation, code, statusCode: Number(error?.statusCode) || null });
  let message = 'Azure evidence storage is unavailable. Retry shortly; check the server log for the storage error code.';
  if (operation === 'configuration') message = 'The Azure evidence connection string is invalid. Copy the unmodified connection string from Azure Storage > Access keys, then restart the API.';
  else if (code === 'ContainerNotFound') message = 'The Azure evidence container does not exist. Create the configured private container in the storage account used by the connection string.';
  else if (code === 'KeyBasedAuthenticationNotPermitted') message = 'Azure storage account key access is disabled. This integration requires account key authentication.';
  else if (code === 'AuthenticationFailed') message = 'Azure rejected the evidence storage credentials. Update the connection string from Azure Storage > Access keys and restart the API.';
  else if (Number(error?.statusCode) === 403) message = 'Azure denied evidence storage access. Check the storage account network rules and account key access settings.';
  return Object.assign(new Error(message), { status: 503, code: 'EVIDENCE_STORAGE_UNAVAILABLE' });
};

const blobClient = (filename, service) => {
  if (!isSafeUploadFileName(filename)) throw new Error('Invalid evidence file name.');
  const connection = String(process.env.AZURE_EVIDENCE_CONNECTION_STRING || '').trim();
  const container = String(process.env.AZURE_EVIDENCE_CONTAINER_NAME || '').trim();
  if (!connection || !container) throw Object.assign(new Error('Evidence storage is unavailable. Configure the Azure evidence connection and container.'), { status: 503 });
  if (/&#(?:x[0-9a-f]+|\d+);|&(?:amp|quot);/i.test(connection) || /[\r\n]/.test(connection) || connection.endsWith('\\')) throw storageFailure({ code: 'InvalidConnectionString' }, 'configuration');
  try {
    return (service || BlobServiceClient.fromConnectionString(connection)).getContainerClient(container).getBlockBlobClient(filename);
  } catch (error) {
    throw storageFailure(error, 'configuration');
  }
};

export async function uploadEvidenceToAzure({ filename, buffer, contentType }, { blobServiceClient } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Invalid evidence image.');
  const client = blobClient(filename, blobServiceClient);
  try {
    await client.uploadData(buffer, {
      conditions: { ifNoneMatch: '*' },
      blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'private, no-store' },
    });
  } catch (error) {
    throw storageFailure(error, 'upload');
  }
}

export async function getEvidenceFromAzure(filename, { blobServiceClient } = {}) {
  const client = blobClient(filename, blobServiceClient);
  try {
    const [data, properties] = await Promise.all([client.downloadToBuffer(), client.getProperties()]);
    return { data, contentType: properties.contentType };
  } catch (error) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
}

export async function deleteEvidenceFromAzure(filename, { blobServiceClient } = {}) {
  return blobClient(filename, blobServiceClient).deleteIfExists();
}
