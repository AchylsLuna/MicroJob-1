import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import JobApplication from '../models/JobApplication.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
import { normalizeExperience } from '../lib/profileValidation.js';
import {
  hasValidAvatarFileSignature,
  hasValidResumeFileSignature,
  removeUploadFile,
  isSafeUploadFileName,
} from '../middleware/uploadConfig.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select(
      'firstName lastName email phoneNumber role status deletedAt redactedAt city country province barangay addressType address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName resumeUrl avatarUrl about linkedin website totalExperience projectsCompleted jobsApplied successRate skills workExperience preferredCategories jobPreferences employerBalance workerBalance hideHiredCandidates verification'
    ).populate(
      'preferredCategories',
      'name'
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

export const updateJobPreferences = async (req, res) => {
  try {
    const { preferredCategories = [], jobPreferences = [] } = req.body || {};
    if (!Array.isArray(preferredCategories) || !Array.isArray(jobPreferences)) {
      return sendError(res, 400, 'Preferred categories and job preferences must be arrays.');
    }
    if (preferredCategories.length > 10 || jobPreferences.length > 10) {
      return sendError(res, 400, 'You can save up to 10 preferred categories and 10 job preferences.');
    }

    const categoryIds = [...new Set(preferredCategories.map(String))];
    if (categoryIds.some((id) => !mongoose.isValidObjectId(id))) {
      return sendError(res, 400, 'One or more preferred categories are invalid.');
    }
    const categoryCount = await Category.countDocuments({ _id: { $in: categoryIds } });
    if (categoryCount !== categoryIds.length) {
      return sendError(res, 400, 'One or more preferred categories were not found.');
    }

    const normalizedPreferences = [...new Set(jobPreferences.map((value) => String(value).trim()).filter(Boolean))];
    if (normalizedPreferences.some((value) => value.length > 120)) {
      return sendError(res, 400, 'Each job preference must be 120 characters or fewer.');
    }

    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $set: { preferredCategories: categoryIds, jobPreferences: normalizedPreferences } },
      { returnDocument: 'after', runValidators: true }
    ).populate('preferredCategories', 'name');
    if (!user) return sendError(res, 404, 'User not found');

    return sendSuccess(res, 200, 'Job preferences updated successfully', {
      preferredCategories: user.preferredCategories,
      jobPreferences: user.jobPreferences,
    });
  } catch (error) {
    console.error('Update job preferences error:', error);
    return sendError(res, 500, 'Failed to update job preferences.');
  }
};

export const uploadAvatar = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }
    if (!hasValidAvatarFileSignature(req.file)) {
      await removeUploadFile(req.file.filename);
      return sendError(res, 400, 'Image content does not match its JPG, PNG, GIF, or WEBP file type.');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      await removeUploadFile(req.file.filename);
      return sendError(res, 404, 'User not found');
    }

    const previousAvatarUrl = user.avatarUrl;
    user.avatarUrl = `/uploads/${req.file.filename}`;
    await user.save();
    persisted = true;
    if (previousAvatarUrl && previousAvatarUrl !== user.avatarUrl) {
      await removeUploadFile(previousAvatarUrl);
    }

    return sendSuccess(res, 200, 'Avatar uploaded successfully', {
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    if (!persisted && req.file?.filename) await removeUploadFile(req.file.filename);
    console.error('Avatar upload error:', error);
    return sendError(res, 500, 'Failed to upload avatar');
  }
};

export const uploadResume = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }
    if (!hasValidResumeFileSignature(req.file)) {
      await removeUploadFile(req.file.filename);
      return sendError(res, 400, 'Resume content does not match its PDF, DOC, or DOCX file type.');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      await removeUploadFile(req.file.filename);
      return sendError(res, 404, 'User not found');
    }

    const previousResumeFileName = user.resumeFileName;
    user.resumeFileName = req.file.filename;
    user.resumeUrl = `/uploads/${req.file.filename}`;
    await user.save();
    persisted = true;
    if (previousResumeFileName && previousResumeFileName !== req.file.filename) {
      await removeUploadFile(previousResumeFileName);
    }

    return sendSuccess(res, 200, 'Resume uploaded successfully', {
      resumeUrl: user.resumeUrl,
      resumeFileName: user.resumeFileName,
    });
  } catch (error) {
    if (!persisted && req.file?.filename) await removeUploadFile(req.file.filename);
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
    await removeUploadFile(previousAvatarUrl);

    return sendSuccess(res, 200, 'Avatar deleted successfully', {
      avatarUrl: null,
    });
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

    if (!user.resumeFileName) {
      return sendError(res, 400, 'No resume found');
    }

    const previousResumeFileName = user.resumeFileName;
    user.resumeUrl = null;
    user.resumeFileName = null;
    await user.save();
    await removeUploadFile(previousResumeFileName);

    return sendSuccess(res, 200, 'Resume deleted successfully', {
      resumeUrl: null,
      resumeFileName: null,
    });
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
  updateJobPreferences,
  normalizeExperience,
};
