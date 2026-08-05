import express from 'express';
import fs from 'fs';
import { resolve } from 'path';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import { getAuthContextFromRequest, isAdminRole } from '../lib/auth.js';

const isSafeUploadFileName = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    if (normalized.includes('..')) return false;
    return /^[a-zA-Z0-9._-]+$/.test(normalized);
};

const toUploadUrl = (fileName = '') => `/uploads/${fileName}`;

// Restrict sensitive uploads (resumes/KYC docs) to authorized viewers.
// Avatars can still be served publicly.
// Verification documents are owner/admin only; employers can view resumes from
// workers who applied to one of their jobs.
export const createUploadsRouter = (uploadsDir) => {
    const router = express.Router();
    const uploadsRoot = `${uploadsDir}${process.platform === 'win32' ? '\\' : '/'}`;

    router.get('/:fileName', async (req, res) => {
        try {
            const fileName = String(req.params?.fileName || '').trim();
            if (!isSafeUploadFileName(fileName)) {
                return res.status(400).json({ message: 'Invalid file path.' });
            }

            const fullPath = resolve(uploadsDir, fileName);
            if (fullPath !== uploadsDir && !fullPath.startsWith(uploadsRoot)) {
                return res.status(400).json({ message: 'Invalid file path.' });
            }
            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ message: 'File not found.' });
            }

            const uploadUrl = toUploadUrl(fileName);
            const owner = await User.findOne({
                $or: [
                    { avatarUrl: uploadUrl },
                    { resumeFileName: fileName },
                    { resumeUrl: uploadUrl },
                    { 'verification.identityDocument.documentUrl': uploadUrl },
                    { 'verification.addressDocument.documentUrl': uploadUrl },
                ],
            }).select(
                '_id avatarUrl resumeFileName resumeUrl verification.identityDocument.documentUrl verification.addressDocument.documentUrl'
            );

            if (!owner) {
                return res.status(404).json({ message: 'File metadata not found.' });
            }

            const isAvatar = owner.avatarUrl === uploadUrl;
            const isResume =
                owner.resumeFileName === fileName ||
                owner.resumeUrl === uploadUrl;
            const isVerificationDocument =
                owner.verification?.identityDocument?.documentUrl === uploadUrl ||
                owner.verification?.addressDocument?.documentUrl === uploadUrl;
            const isSensitiveFile = isResume || isVerificationDocument;

            if (isSensitiveFile) {
                const authContext = await getAuthContextFromRequest(req);
                if (!authContext?.id) {
                    return res.status(401).json({ message: 'Authentication required.' });
                }

                const isOwner = String(owner._id) === authContext.id;
                let canViewApplicantResume = false;
                if (!isOwner && !isAdminRole(authContext.role) && isResume && ['hire', 'both'].includes(authContext.role)) {
                    const employerJobIds = await Job.find({ jobPoster: authContext.id }).distinct('_id');
                    canViewApplicantResume = employerJobIds.length > 0 && Boolean(await JobApplication.exists({
                        applicant: owner._id,
                        job: { $in: employerJobIds },
                    }));
                }

                if (!isOwner && !isAdminRole(authContext.role) && !canViewApplicantResume) {
                    return res.status(403).json({ message: 'Not allowed to access this file.' });
                }
            }

            if (isAvatar || isSensitiveFile) {
                return res.sendFile(fullPath);
            }

            return res.status(404).json({ message: 'File metadata not found.' });
        } catch (error) {
            console.error('Upload access error:', error);
            return res.status(500).json({ message: 'Failed to access file.' });
        }
    });

    return router;
};
