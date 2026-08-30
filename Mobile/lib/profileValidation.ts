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

export type ProfileUrlValidation = {
  isValid: boolean;
  normalized: string;
  error: string | null;
  reason: 'tooLong' | 'invalidScheme' | 'insecure' | 'invalidDomain' | 'invalidFormat' | null;
};

export function validateProfileUrl(value: string, label: string): ProfileUrlValidation {
  const raw = value.trim();
  if (!raw) return { isValid: true, normalized: '', error: null, reason: null };
  if (raw.length > PROFILE_LIMITS.url) {
    return { isValid: false, normalized: raw, error: `${label} must be ${PROFILE_LIMITS.url} characters or fewer.`, reason: 'tooLong' };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return { isValid: false, normalized: raw, error: `${label} must be a valid web address starting with https://`, reason: 'invalidScheme' };
  }
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (!['http:', 'https:'].includes(parsed.protocol) || (!isLocal && parsed.protocol !== 'https:')) {
      return { isValid: false, normalized: raw, error: `${label} must be a secure HTTPS link.`, reason: 'insecure' };
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && !isLocal)) {
      return { isValid: false, normalized: raw, error: `Please enter a valid web domain for ${label.toLowerCase()} (e.g. example.com).`, reason: 'invalidDomain' };
    }
    return { isValid: true, normalized: withScheme, error: null, reason: null };
  } catch {
    return { isValid: false, normalized: raw, error: `Please enter a valid URL format for ${label.toLowerCase()}.`, reason: 'invalidFormat' };
  }
}

export const normalizeProfileUrl = (value: string): string => {
  const validation = validateProfileUrl(value, 'Link');
  return validation.isValid && validation.normalized ? validation.normalized : value.trim();
};

export const isValidOptionalProfileUrl = (value: string) => validateProfileUrl(value, 'Link').isValid;
