import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { sendError } from '../lib/apiResponse.js';
import {
  buildUploadFileName,
  deleteStoredUpload,
  isSafeUploadFileName,
  safeExt,
  saveStoredUpload,
} from '../lib/uploadStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
const uploadsRoot = `${path.resolve(uploadsDir)}${process.platform === 'win32' ? '\\' : '/'}`;

const resumeStorage = multer.memoryStorage();
const avatarStorage = multer.memoryStorage();
const documentStorage = multer.memoryStorage();
const experienceMediaStorage = multer.memoryStorage();

const multerResume = multer({
  storage: resumeStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const allowedMime = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const ext = safeExt(path.extname(file.originalname));
    if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed for resumes'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Avatars and work-experience media accept exactly the same image types, so
// they share one filter rather than keeping two copies in step by hand.
const createImageFileFilter = () => (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedMime = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]);
  const ext = safeExt(path.extname(file.originalname));
  if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed'));
  }
};

const multerAvatar = multer({
  storage: avatarStorage,
  fileFilter: createImageFileFilter(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const multerExperienceMedia = multer({
  storage: experienceMediaStorage,
  fileFilter: createImageFileFilter(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const multerDocument = multer({
  storage: documentStorage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const ext = safeExt(path.extname(file.originalname));
    if (allowed.has(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed for verification documents'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const hasValidResumeFileSignature = (file) => {
  const bytes = file?.buffer ? Buffer.from(file.buffer) : null;
  if (!bytes) return false;
  const extension = safeExt(path.extname(file.originalname));
  if (extension === '.pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  if (extension === '.doc') {
    return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === '.docx') {
    const zipSignature = `${bytes[2]}:${bytes[3]}`;
    return bytes[0] === 0x50 && bytes[1] === 0x4b && ['3:4', '5:6', '7:8'].includes(zipSignature);
  }
  return false;
};

export const hasValidAvatarFileSignature = (file) => {
  const bytes = file?.buffer ? Buffer.from(file.buffer) : null;
  if (!bytes) return false;
  const extension = safeExt(path.extname(file.originalname));
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  return false;
};

export const hasValidVerificationFileSignature = (file) => {
  const bytes = file?.buffer ? Buffer.from(file.buffer) : null;
  if (!bytes) return false;
  const extension = safeExt(path.extname(file.originalname));
  if (extension === '.pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
};

const persistUpload = async (req, file, kind, defaultExt) => {
  const filename = buildUploadFileName(kind, file.originalname, req.user?.id);
  await saveStoredUpload({
    filename,
    buffer: Buffer.from(file.buffer),
    contentType: file.mimetype || 'application/octet-stream',
    metadata: {
      kind,
      userId: req.user?.id || null,
      originalName: file.originalname,
      defaultExt,
    },
  });
  file.filename = filename;
  file.path = undefined;
};

const withUploadErrors = (middleware, kind, defaultExt) => (req, res, next) => {
  middleware(req, res, async (error) => {
    if (error) {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 413, 'File is too large. Maximum size is 5 MB.');
      }
      return sendError(res, 400, error?.message || 'Invalid file upload.');
    }

    if (!req.file) return next();

    try {
      await persistUpload(req, req.file, kind, defaultExt);
      return next();
    } catch (storageError) {
      return sendError(res, 500, storageError?.message || 'Failed to store upload.');
    }
  });
};

export const uploadAvatarFile = withUploadErrors(multerAvatar.single('avatar'), 'avatar', '.jpg');
export const uploadResumeFile = withUploadErrors(multerResume.single('resume'), 'resume', '.bin');
export const uploadVerificationFile = withUploadErrors(multerDocument.single('document'), 'verification', '.bin');
// Same image rules and signature check as avatars -- see hasValidAvatarFileSignature.
export const uploadExperienceMediaFile = withUploadErrors(multerExperienceMedia.single('media'), 'experience-media', '.jpg');

export const removeUploadFile = async (value) => {
  try {
    await deleteStoredUpload(value);
  } catch (error) {
    console.warn(`Failed to remove upload ${String(value || '')}:`, error?.message || error);
  }
};

export { uploadsDir, uploadsRoot, safeExt, isSafeUploadFileName };
