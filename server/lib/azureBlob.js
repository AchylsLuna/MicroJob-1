import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function ensureContainer() {
    await containerClient.createIfNotExists({
        access: 'blob',
    });
}

async function uploadAvatar(buffer, fileName, mimeType) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
    });
    return blockBlobClient.url;
}

module.exports = { ensureContainer, uploadAvatar, containerClient };