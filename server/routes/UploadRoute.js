import express from 'express';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import FinancialDispute from '../models/FinancialDispute.js';
import { getAuthContextFromRequest, isAdminRole } from '../lib/auth.js';
import { getStoredUpload, isSafeUploadFileName } from '../lib/uploadStore.js';
import { getAvatarFromAzure } from '../lib/azureAvatarStorage.js';
import { getEvidenceFromAzure } from '../lib/azureEvidenceStorage.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';

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
            const uploadUrl = toUploadUrl(fileName);
            const application = await JobApplication.findOne({ 'completionEvidence.fileUrl': uploadUrl }).select('applicant job completionEvidence');
            if (application) {
                const authContext = await getAuthContextFromRequest(req);
                if (!authContext?.id) return res.status(401).json({ message: 'Authentication required.' });
                const job = application && await Job.findById(application.job).select('jobPoster');
                if (!application || !job) return res.sendStatus(404);
                const participant = [String(application.applicant), String(job.jobPoster)].includes(String(authContext.id));
                if (!participant && !hasPermission(resolveStaffRole(authContext), 'finance.disputes.view')) return res.sendStatus(403);
                const evidence = application.completionEvidence.find((item) => item.fileUrl === uploadUrl);
                const storedUpload = evidence.storage === 'azure' ? await getEvidenceFromAzure(fileName) : await getStoredUpload(fileName);
                if (!storedUpload) return res.sendStatus(404);
                res.setHeader('Content-Type', storedUpload.contentType || 'application/octet-stream');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'private, no-store');
                res.setHeader('Content-Disposition', `${String(storedUpload.contentType).startsWith('image/') ? 'inline' : 'attachment'}; filename="${fileName.replace(/["\\\r\n]/g, '_')}"`);
                return res.send(Buffer.from(storedUpload.data || []));
            }
            const storedUpload = await getStoredUpload(fileName);
            if (storedUpload?.metadata?.kind === 'dispute-evidence') {
                const authContext = await getAuthContextFromRequest(req);
                if (!authContext?.id) return res.status(401).json({ message: 'Authentication required.' });
                const dispute = await FinancialDispute.findOne({ 'evidence.fileUrl': uploadUrl }).select('worker employer');
                if (!dispute) return res.status(404).json({ message: 'Evidence metadata not found.' });
                const isParticipant = [String(dispute.worker), String(dispute.employer)].includes(authContext.id);
                const canReview = hasPermission(resolveStaffRole(authContext), 'finance.disputes.view');
                if (!isParticipant && !canReview) return res.status(403).json({ message: 'Not allowed to access this evidence.' });
                res.setHeader('Content-Type', storedUpload.contentType || 'application/octet-stream');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'private, no-store');
                res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/["\\\r\n]/g, '_')}"`);
                return res.send(Buffer.from(storedUpload.data || []));
            }
            const owner = await User.findOne({
                $or: [
                    { avatarUrl: uploadUrl },
                    { resumeFileName: fileName },
                    { resumeUrl: uploadUrl },
                    { 'verification.identityDocument.documentUrl': uploadUrl },
                    { 'verification.addressDocument.documentUrl': uploadUrl },
                    { 'workExperience.media.url': uploadUrl },
                ],
            }).select(
                '_id avatarUrl resumeFileName resumeUrl verification.identityDocument.documentUrl verification.addressDocument.documentUrl workExperience.media.url'
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
            // Work-sample photos exist specifically to be shown on the public
            // profile ("Public View"), so they're public like avatars, not
            // gated like resumes/verification docs.
            const isPortfolioMedia = (owner.workExperience || []).some((experience) =>
                (experience.media || []).some((item) => item.url === uploadUrl)
            );

            // Azure is the primary avatar store. Any unavailable/missing blob
            // falls back to the Mongo-backed upload written by multer.
            let azureAvatar = null;
            if (isAvatar) {
                try {
                    azureAvatar = await getAvatarFromAzure(fileName);
                } catch (azureError) {
                    console.warn('Azure avatar read failed; using the default upload backup:', azureError?.message || azureError);
                }
            }

            const fallbackStoredUpload = azureAvatar ? null : storedUpload;
            if (!azureAvatar && !fallbackStoredUpload) {
                return res.status(404).json({ message: 'File not found.' });
            }

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

            if (isAvatar || isPortfolioMedia || isSensitiveFile) {
                res.setHeader('Content-Type', azureAvatar?.contentType || fallbackStoredUpload.contentType || 'application/octet-stream');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', isSensitiveFile ? 'private, no-store' : 'public, max-age=3600');
                if (isSensitiveFile) {
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/["\\\r\n]/g, '_')}"`);
                }
                return res.send(azureAvatar?.data || Buffer.from(fallbackStoredUpload.data || []));
            }

            return res.status(404).json({ message: 'File metadata not found.' });
        } catch (error) {
            console.error('Upload access error:', error);
            return res.status(500).json({ message: 'Failed to access file.' });
        }
    });

    return router;
};
