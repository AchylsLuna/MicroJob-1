import express from 'express';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import { getAuthContextFromRequest, isAdminRole } from '../lib/auth.js';
import { getStoredUpload, isSafeUploadFileName } from '../lib/uploadStore.js';

const toUploadUrl = (fileName = '') => `/uploads/${fileName}`;

// Restrict sensitive uploads (resumes/KYC docs) to authorized viewers.
// Avatars can still be served publicly.
// Verification documents are owner/admin only; employers can view resumes from
// workers who applied to one of their jobs.
export const createUploadsRouter = () => {
    const router = express.Router();

    router.get('/:fileName', async (req, res) => {
        try {
            const fileName = String(req.params?.fileName || '').trim();
            if (!isSafeUploadFileName(fileName)) {
                return res.status(400).json({ message: 'Invalid file path.' });
            }
            const storedUpload = await getStoredUpload(fileName);
            if (!storedUpload) {
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
                res.setHeader('Content-Type', storedUpload.contentType || 'application/octet-stream');
                return res.send(Buffer.from(storedUpload.data || []));
            }

            return res.status(404).json({ message: 'File metadata not found.' });
        } catch (error) {
            console.error('Upload access error:', error);
            return res.status(500).json({ message: 'Failed to access file.' });
        }
    });

    return router;
};
