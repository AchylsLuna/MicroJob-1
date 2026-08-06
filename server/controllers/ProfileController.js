import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
import {
  removeUploadFile,
  isSafeUploadFileName,
} from '../middleware/uploadConfig.js';

const parseExperienceDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}(?:-\d{2}(?:T.*)?)?$/.test(raw)) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeExperience = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Work experience must be a JSON object' };
  }
  for (const requiredField of ['title', 'company', 'startDate']) {
    if (typeof payload[requiredField] !== 'string' && !(requiredField === 'startDate' && payload[requiredField] instanceof Date)) {
      return { error: `${requiredField} must be a string` };
    }
  }
  for (const optionalField of ['location', 'description']) {
    if (payload[optionalField] !== undefined && payload[optionalField] !== null && typeof payload[optionalField] !== 'string') {
      return { error: `${optionalField} must be a string` };
    }
  }
  if (![true, false, 'true', 'false'].includes(payload.current)) {
    return { error: 'current must be a boolean' };
  }
  if (
    payload.endDate !== undefined &&
    payload.endDate !== null &&
    typeof payload.endDate !== 'string' &&
    !(payload.endDate instanceof Date)
  ) {
    return { error: 'endDate must be a string' };
  }
  const title = String(payload.title || '').trim();
  const company = String(payload.company || '').trim();
  const location = String(payload.location || '').trim();
  const description = String(payload.description || '').trim();
  const startDate = parseExperienceDate(payload.startDate);
  const current = payload.current === true || payload.current === 'true';
  const endDate = current ? null : parseExperienceDate(payload.endDate);

  if (!title) return { error: 'Job title is required' };
  if (!company) return { error: 'Company or client name is required' };
  if (title.length > 100) return { error: 'Job title must be 100 characters or fewer' };
  if (company.length > 120) return { error: 'Company or client name must be 120 characters or fewer' };
  if (location.length > 120) return { error: 'Location must be 120 characters or fewer' };
  if (description.length > 1000) return { error: 'Description must be 1000 characters or fewer' };
  if (!startDate) return { error: 'A valid start date is required' };
  if (!current && !endDate) return { error: 'End date is required unless this is your current role' };
  if (endDate && endDate < startDate) return { error: 'End date cannot be before start date' };
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (startDate > endOfToday) return { error: 'Start date cannot be in the future' };
  if (endDate && endDate > endOfToday) return { error: 'End date cannot be in the future' };

  return {
    value: { title, company, location, description, startDate, endDate, current },
  };
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select(
      'firstName lastName email phoneNumber role status deletedAt redactedAt city country province barangay addressType address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName resumeUrl avatarUrl about linkedin website totalExperience projectsCompleted jobsApplied successRate skills workExperience employerBalance workerBalance hideHiredCandidates verification'
    );
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const [jobsApplied, jobsCompleted] = await Promise.all([
      JobApplication.countDocuments({ applicant: req.user?.id }),
      JobApplication.countDocuments({ applicant: req.user?.id, status: 'Hired' }),
    ]);
    const successRate = jobsApplied > 0
      ? `${Math.round((jobsCompleted / jobsApplied) * 100)}%`
      : '0%';

    const profile = user.toObject();
    profile.jobsApplied = jobsApplied;
    profile.projectsCompleted = jobsCompleted;
    profile.successRate = successRate;

    if (
      user.jobsApplied !== jobsApplied ||
      user.projectsCompleted !== jobsCompleted ||
      user.successRate !== successRate
    ) {
      void User.updateOne(
        { _id: user._id },
        { $set: { jobsApplied, projectsCompleted: jobsCompleted, successRate } }
      ).catch((statsError) => {
        console.warn('Failed to cache profile statistics:', statsError?.message || statsError);
      });
    }

    return sendSuccess(res, 200, 'Profile retrieved', profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Server error');
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No avatar file provided');
    }
    if (!req.file.mimetype.startsWith('image/')) {
      return sendError(res, 400, 'Avatar must be an image');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const previousAvatarUrl = user.avatarUrl;
    user.avatarUrl = avatarUrl;
    await user.save();
    if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      removeUploadFile(previousAvatarUrl);
    }

    return sendSuccess(res, 200, 'Avatar uploaded successfully', { avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return sendError(res, 500, 'Failed to upload avatar');
  }
};

export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No resume file provided');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const resumeUrl = `/uploads/${req.file.filename}`;
    const previousResumeUrl = user.resumeUrl;
    user.resumeUrl = resumeUrl;
    user.resumeFileName = req.file.filename;
    await user.save();
    if (previousResumeUrl && previousResumeUrl !== resumeUrl) {
      removeUploadFile(previousResumeUrl);
    }

    return sendSuccess(res, 200, 'Resume uploaded successfully', {
      resumeUrl,
      resumeFileName: req.file.filename,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return sendError(res, 500, 'Failed to upload resume');
  }
};

export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.avatarUrl) {
      return sendError(res, 400, 'No avatar found');
    }

    const previousAvatarUrl = user.avatarUrl;
    user.avatarUrl = null;
    await user.save();
    removeUploadFile(previousAvatarUrl);

    return sendSuccess(res, 200, 'Avatar deleted successfully', { avatarUrl: null });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return sendError(res, 500, 'Failed to delete avatar');
  }
};

export const deleteResume = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.resumeUrl) {
      return sendError(res, 400, 'No resume found');
    }

    const previousResumeUrl = user.resumeUrl;
    user.resumeUrl = null;
    user.resumeFileName = null;
    await user.save();
    removeUploadFile(previousResumeUrl);

    return sendSuccess(res, 200, 'Resume deleted successfully', { resumeUrl: null, resumeFileName: null });
  } catch (error) {
    console.error('Resume delete error:', error);
    return sendError(res, 500, 'Failed to delete resume');
  }
};

export const createFileAccessLink = async (req, res) => {
  const { fileName } = req.params;
  if (!isSafeUploadFileName(fileName)) {
    return sendError(res, 400, 'Invalid file name');
  }

  const downloadToken = jwt.sign(
    {
      userId: req.user.id,
      role: req.user.role,
      sessionId: req.user.sessionId,
      purpose: 'upload-download',
      fileName,
    },
    getJwtSecret(),
    { expiresIn: '2m' }
  );
  return sendSuccess(res, 200, 'Temporary file link created', {
    url: `/uploads/${encodeURIComponent(fileName)}?downloadToken=${encodeURIComponent(downloadToken)}`,
  });
};

export default {
  getProfile,
  uploadAvatar,
  uploadResume,
  deleteAvatar,
  deleteResume,
  createFileAccessLink,
  normalizeExperience,
};
