import { basename, extname } from 'path';
import StoredUpload from '../models/StoredUpload.js';

export const safeExt = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9.]/g, '');

export const isSafeUploadFileName = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized !== basename(normalized)) return false;
  if (normalized.includes('..')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(normalized);
};

export const buildUploadFileName = (prefix, originalName, userId) => {
  const extension = safeExt(extname(originalName)) || (prefix === 'avatar' ? '.jpg' : '.bin');
  const timestamp = Date.now();
  return `${prefix}_${userId || 'anonymous'}_${timestamp}${extension}`;
};

export const normalizeStoredUploadName = (value = '') => basename(String(value || '').replace(/\\/g, '/'));

export async function saveStoredUpload({ filename, buffer, contentType, metadata = {} }) {
  if (!isSafeUploadFileName(filename)) {
    throw new Error('Invalid upload file name');
  }
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid upload data');
  }

  return StoredUpload.findOneAndUpdate(
    { filename },
    {
      $set: {
        filename,
        contentType: contentType || 'application/octet-stream',
        data: buffer,
        metadata,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

export async function getStoredUpload(value) {
  const filename = normalizeStoredUploadName(value);
  if (!isSafeUploadFileName(filename)) return null;
  return StoredUpload.findOne({ filename }).lean(false);
}

export async function deleteStoredUpload(value) {
  const filename = normalizeStoredUploadName(value);
  if (!isSafeUploadFileName(filename)) return false;
  const result = await StoredUpload.deleteOne({ filename });
  return Boolean(result.deletedCount);
}