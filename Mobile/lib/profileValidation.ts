const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;
const PH_PHONE_PATTERN = /^09\d{9}$/;

export const PROFILE_LIMITS = {
  name: 30,
  city: 100,
  province: 100,
  barangay: 100,
  address: 300,
  companyName: 120,
  jobPosition: 100,
  about: 2000,
  url: 300,
  experienceTitle: 100,
  experienceCompany: 120,
  experienceLocation: 120,
  experienceDescription: 1000,
} as const;

export const MAX_PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;

type MobileFileAsset = {
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

const AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const RESUME_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const getAssetExtension = (asset: MobileFileAsset, fallback = '') => (
  asset.fileName?.split('.').pop() || asset.mimeType?.split('/').pop() || fallback
).toLowerCase();

export function validateMobileAvatar(asset: MobileFileAsset): { extension: string; mimeType: string; error: string | null } {
  const extension = getAssetExtension(asset, 'jpg');
  const mimeType = (asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`).toLowerCase();
  if (!AVATAR_EXTENSIONS.has(extension) || !AVATAR_MIME_TYPES.has(mimeType)) {
    return { extension, mimeType, error: 'Choose a JPG, PNG, GIF, or WEBP image.' };
  }
  if (asset.fileSize && asset.fileSize > MAX_PROFILE_UPLOAD_BYTES) {
    return { extension, mimeType, error: 'Profile photos must be 5 MB or smaller.' };
  }
  return { extension, mimeType, error: null };
}

export function validateMobileResume(asset: MobileFileAsset): { extension: string; mimeType: string; error: string | null } {
  const extension = getAssetExtension(asset);
  const expectedMime = RESUME_MIME_BY_EXTENSION[extension];
  const mimeType = (asset.mimeType || expectedMime || '').toLowerCase();
  if (!expectedMime || mimeType !== expectedMime) {
    return { extension, mimeType, error: 'Choose a PDF, DOC, or DOCX résumé.' };
  }
  if (asset.fileSize && asset.fileSize > MAX_PROFILE_UPLOAD_BYTES) {
    return { extension, mimeType, error: 'Résumés must be 5 MB or smaller.' };
  }
  return { extension, mimeType, error: null };
}

export const normalizeProfileName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const isValidProfileName = (value: string) => {
  const normalized = normalizeProfileName(value);
  return Boolean(normalized) && normalized.length <= PROFILE_LIMITS.name && NAME_PATTERN.test(normalized);
};

export const normalizeProfilePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('63') ? `0${digits.slice(2)}`.slice(0, 11) : digits.slice(0, 11);
};

export const isValidProfilePhone = (value: string) => PH_PHONE_PATTERN.test(normalizeProfilePhone(value));

export const isValidOptionalProfileUrl = (value: string) => {
  const raw = value.trim();
  if (!raw) return true;
  if (raw.length > PROFILE_LIMITS.url) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    return parsed.protocol === 'https:' || localHttp;
  } catch {
    return false;
  }
};
