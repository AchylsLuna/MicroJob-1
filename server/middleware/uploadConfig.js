import fs from 'fs';
import multer from 'multer';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { sendError } from '../lib/apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '..', 'uploads');
const uploadsRoot = `${resolve(uploadsDir)}${process.platform === 'win32' ? '\\' : '/'}`;

const safeExt = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9.]/g, '');

const isSafeUploadFileName = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized !== basename(normalized)) return false;
  if (normalized.includes('..')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(normalized);
};

const resolveUploadPath = (fileName = '') => {
  if (!isSafeUploadFileName(fileName)) return null;
  const fullPath = resolve(uploadsDir, fileName);
  if (fullPath !== resolve(uploadsDir) && !fullPath.startsWith(uploadsRoot)) return null;
  return fullPath;
};

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.bin';
    cb(null, `resume_${userId}_${timestamp}${ext}`);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.jpg';
    cb(null, `avatar_${userId}_${timestamp}${ext}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.bin';
    cb(null, `verification_${userId}_${timestamp}${ext}`);
  },
});

const multerResume = multer({
  storage: resumeStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const allowedMime = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const ext = safeExt(extname(file.originalname));
    if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed for resumes'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const multerAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMime = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const ext = safeExt(extname(file.originalname));
    if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const multerDocument = multer({
  storage: documentStorage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const ext = safeExt(extname(file.originalname));
    if (allowed.has(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed for verification documents'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const removeUploadFile = (value) => {
  const fileName = basename(String(value || '').replace(/\\/g, '/'));
  const filePath = resolveUploadPath(fileName);
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`Failed to remove upload ${fileName}:`, error?.message || error);
  }
};

const hasValidVerificationFileSignature = (file) => {
  if (!file?.path) return false;
  let bytes;
  try {
    bytes = fs.readFileSync(file.path).subarray(0, 12);
  } catch {
    return false;
  }
  const extension = safeExt(extname(file.originalname));
  if (extension === '.pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
};

const readUploadHeader = (file, length = 16) => {
  try {
    return file?.path ? fs.readFileSync(file.path).subarray(0, length) : null;
  } catch {
    return null;
  }
};

export const hasValidResumeFileSignature = (file) => {
  const bytes = readUploadHeader(file);
  if (!bytes) return false;
  const extension = safeExt(extname(file.originalname));
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
  const bytes = readUploadHeader(file);
  if (!bytes) return false;
  const extension = safeExt(extname(file.originalname));
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  return false;
};

const withUploadErrors = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    if (req.file?.filename) removeUploadFile(req.file.filename);
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'File is too large. Maximum size is 5 MB.');
    }
    return sendError(res, 400, error?.message || 'Invalid file upload.');
  });
};

export const uploadAvatarFile = withUploadErrors(multerAvatar.single('avatar'));
export const uploadResumeFile = withUploadErrors(multerResume.single('resume'));
export const uploadVerificationFile = withUploadErrors(multerDocument.single('document'));

export { uploadsDir, uploadsRoot, safeExt, isSafeUploadFileName, resolveUploadPath, hasValidVerificationFileSignature, removeUploadFile };
