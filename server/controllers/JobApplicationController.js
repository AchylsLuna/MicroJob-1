import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { emitToUser } from '../lib/socket.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';

const CANONICAL_STATUSES = ['Pending', 'Shortlisted', 'Terms', 'Hired'];
const LEGACY_STATUS_MAP = {
    Reviewed: 'Shortlisted',
    Accepted: 'Hired',
    Rejected: 'Pending',
};

const toCanonicalStatus = (status) => {
    if (!status || typeof status !== 'string') return null;
    if (CANONICAL_STATUSES.includes(status)) return status;
    return LEGACY_STATUS_MAP[status] || null;
};

// Apply for a job
export const applyForJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { resume, coverLetter } = req.body;
        const userId = req.user.id; // From auth middleware

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return sendError(res, 404, 'Job not found');
        }

        // Check if user already applied
        const existingApplication = await JobApplication.findOne({
            job: jobId,
            applicant: userId
        });

        if (existingApplication) {
            return sendError(res, 400, 'You have already applied for this job');
        }

        // Create new application
        const application = new JobApplication({
            job: jobId,
            applicant: userId,
            resume,
            coverLetter
        });

        await application.save();

        // notify the job poster (employer) in real-time
        try {
            const jobPosterId = job.jobPoster?.toString();
            if (jobPosterId) {
                // fetch applicant's name for a nicer notification
                let applicantName = 'Applicant';
                try {
                    const applicant = await User.findById(userId).select('firstName lastName');
                    if (applicant) applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ');
                } catch (e) {
                    // ignore
                }

                const payload = {
                    id: application._id,
                    applicantId: userId,
                    applicantName,
                    jobId: job._id,
                    jobTitle: job.title,
                    createdAt: application.createdAt,
                };
                emitToUser(jobPosterId, 'new_application', payload);
            }
        } catch (e) {
            // swallow
        }

        // Add applicant to job's applicants array if not already there
        if (!job.applicants.includes(userId)) {
            job.applicants.push(userId);
            await job.save();
        }

        return sendSuccess(
            res,
            201,
            'Application submitted successfully',
            application,
            { application }
        );
    } catch (error) {
        console.error('Apply for job error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Get all applications for the logged-in user
export const getUserApplications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query; // Optional filter by status

        const filter = { applicant: userId };
        if (status && status !== 'All') {
            const canonicalStatus = toCanonicalStatus(status);
            if (!canonicalStatus) {
                return sendError(res, 400, 'Invalid status');
            }
            filter.status = canonicalStatus;
        }

        const applications = await JobApplication.find(filter)
            .populate({
                path: 'job',
                populate: [
                    { path: 'category', select: 'name' },
                    { path: 'jobPoster', select: 'firstName lastName email' },
                ],
            })
            .sort({ createdAt: -1 });

        res.status(200).json(applications);
    } catch (error) {
        console.error('Get user applications error:', error);
        sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Get application details by ID
export const getApplicationById = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.id;

        const application = await JobApplication.findOne({
            _id: applicationId,
            applicant: userId
        }).populate({
            path: 'job',
            populate: [
                { path: 'category', select: 'name' },
                { path: 'jobPoster', select: 'firstName lastName email' },
            ],
        });

        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        return sendSuccess(res, 200, 'Application retrieved successfully', application, { application });
    } catch (error) {
        console.error('Get application error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Withdraw application
export const withdrawApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.id;

        const application = await JobApplication.findOne({
            _id: applicationId,
            applicant: userId
        });

        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        // Remove applicant from job's applicants array
        await Job.findByIdAndUpdate(application.job, {
            $pull: { applicants: userId }
        });

        await JobApplication.deleteOne({ _id: applicationId });

        return sendSuccess(res, 200, 'Application withdrawn successfully', { applicationId }, { applicationId });
    } catch (error) {
        console.error('Withdraw application error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Update application status (for employers)
export const updateApplicationStatus = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status } = req.body;

        const canonicalStatus = toCanonicalStatus(status);
        if (!canonicalStatus) {
            return sendError(
                res,
                400,
                'Invalid status. Expected one of Pending, Shortlisted, Terms, Hired.'
            );
        }

        const application = await JobApplication.findById(applicationId).populate('job');

        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        // Check if the logged-in user is the job poster
        if (application.job.jobPoster.toString() !== req.user.id) {
            return sendError(res, 403, 'Not authorized to update this application');
        }

        const previousStatus = application.status;

        application.status = canonicalStatus;
        // mark applicant as unread for the new status so they get a notification
        application.applicantReadAt = null;
        await application.save();

        // If application was newly marked as Hired, increment job.hiredCount and possibly close the job
        try {
            const jobDoc = await Job.findById(application.job._id);
            if (jobDoc) {
                // adjust hiredCount when status transitions to/from Hired
                if (previousStatus !== 'Hired' && canonicalStatus === 'Hired') {
                    jobDoc.hiredCount = (jobDoc.hiredCount || 0) + 1;
                } else if (previousStatus === 'Hired' && canonicalStatus !== 'Hired') {
                    jobDoc.hiredCount = Math.max(0, (jobDoc.hiredCount || 0) - 1);
                }

                // If hires meet required positions, close the job
                if (jobDoc.hiredCount >= (jobDoc.positionsNeeded || 1)) {
                    jobDoc.status = 'Closed';
                }

                await jobDoc.save();
            }
        } catch (e) {
            console.warn('Failed to update job hire counts', e);
        }

        // Notify the applicant in real-time about status change
        try {
            const applicantId = application.applicant?.toString();
            if (applicantId) {
                const payload = {
                    id: application._id,
                    jobId: application.job?._id,
                    jobTitle: application.job?.title,
                    status: application.status,
                    updatedAt: application.updatedAt,
                };
                emitToUser(applicantId, 'application_status_updated', payload);
            }
        } catch (e) {
            // swallow
        }

        return sendSuccess(
            res,
            200,
            'Application status updated successfully',
            application,
            { application }
        );
    } catch (error) {
        console.error('Update application status error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Get all applications for jobs posted by the logged-in employer
export const getEmployerApplications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, jobId, search } = req.query;

        const postedJobs = await Job.find({ jobPoster: userId }).select('_id');
        const jobIds = postedJobs.map((job) => job._id);

        let filter = { job: { $in: jobIds }, employerHidden: { $ne: true } };
        if (status && status !== 'All') {
            const canonicalStatus = toCanonicalStatus(status);
            if (!canonicalStatus) {
                return sendError(res, 400, 'Invalid status');
            }
            filter.status = canonicalStatus;
        }
        if (jobId && jobId !== 'All') {
            filter.job = jobId;
        }

        let applications = await JobApplication.find(filter)
            .populate('job', 'title company location jobType salary status jobPoster')
            .populate('applicant', 'firstName lastName email role phoneNumber')
            .sort({ createdAt: -1 });

        applications = await JobApplication.populate(applications, {
            path: 'job.jobPoster',
            select: 'firstName lastName email',
        });

        if (search) {
            const query = search.toLowerCase();
            applications = applications.filter((app) => {
                const name = `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.toLowerCase();
                const email = (app.applicant?.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            });
        }

        res.status(200).json(applications);
    } catch (error) {
        console.error('Get employer applications error:', error);
        sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Mark employer notification as read
export const markEmployerApplicationRead = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        if (application.job.jobPoster.toString() !== req.user.id) {
            return sendError(res, 403, 'Not authorized to update this application');
        }

        application.employerReadAt = new Date();
        await application.save();

        return sendSuccess(
            res,
            200,
            'Notification marked as read',
            application,
            { application }
        );
    } catch (error) {
        console.error('Mark employer read error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Hide application from employer notifications/applications
export const hideEmployerApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        if (application.job.jobPoster.toString() !== req.user.id) {
            return sendError(res, 403, 'Not authorized to update this application');
        }

        application.employerHidden = true;
        application.employerHiddenAt = new Date();
        await application.save();

        return sendSuccess(
            res,
            200,
            'Application removed',
            application,
            { application }
        );
    } catch (error) {
        console.error('Hide employer application error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Permanently delete an application (employer only)
export const deleteEmployerApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job');
        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        // Only the job poster (employer) can delete this application
        if (application.job.jobPoster.toString() !== req.user.id) {
            return sendError(res, 403, 'Not authorized to delete this application');
        }

        // If this application was Hired, decrement hiredCount on job
        try {
            const jobDoc = await Job.findById(application.job._id);
            if (jobDoc) {
                if (application.status === 'Hired') {
                    jobDoc.hiredCount = Math.max(0, (jobDoc.hiredCount || 0) - 1);
                }
                // remove applicant from applicants array
                jobDoc.applicants = (jobDoc.applicants || []).filter((id) => id.toString() !== application.applicant.toString());
                await jobDoc.save();
            }
        } catch (e) {
            console.warn('Failed to update job after application deletion', e);
        }

        await JobApplication.deleteOne({ _id: applicationId });

        return sendSuccess(res, 200, 'Application deleted', { applicationId }, { applicationId });
    } catch (error) {
        console.error('Delete employer application error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};

// Mark applicant notification as read
export const markApplicantApplicationRead = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return sendError(res, 404, 'Application not found');
        }

        // Only the applicant can mark their application notification as read
        if (application.applicant.toString() !== req.user.id) {
            return sendError(res, 403, 'Not authorized to update this application');
        }

        application.applicantReadAt = new Date();
        await application.save();

        return sendSuccess(
            res,
            200,
            'Notification marked as read',
            application,
            { application }
        );
    } catch (error) {
        console.error('Mark applicant read error:', error);
        return sendError(res, 500, 'Server error', { error: error.message });
    }
};
