import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { emitToUser } from '../lib/socket.js';

// Apply for a job
export const applyForJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { resume, coverLetter } = req.body;
        const userId = req.user.id; // From auth middleware

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Check if user already applied
        const existingApplication = await JobApplication.findOne({
            job: jobId,
            applicant: userId
        });

        if (existingApplication) {
            return res.status(400).json({ message: 'You have already applied for this job' });
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

        res.status(201).json({
            message: 'Application submitted successfully',
            application
        });
    } catch (error) {
        console.error('Apply for job error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all applications for the logged-in user
export const getUserApplications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query; // Optional filter by status

        const filter = { applicant: userId };
        if (status && status !== 'All') {
            filter.status = status;
        }

        const applications = await JobApplication.find(filter)
            .populate({
                path: 'job',
                populate: {
                    path: 'category',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 });

        res.status(200).json(applications);
    } catch (error) {
        console.error('Get user applications error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
        }).populate('job');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.status(200).json(application);
    } catch (error) {
        console.error('Get application error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
            return res.status(404).json({ message: 'Application not found' });
        }

        // Remove applicant from job's applicants array
        await Job.findByIdAndUpdate(application.job, {
            $pull: { applicants: userId }
        });

        await JobApplication.deleteOne({ _id: applicationId });

        res.status(200).json({ message: 'Application withdrawn successfully' });
    } catch (error) {
        console.error('Withdraw application error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update application status (for employers)
export const updateApplicationStatus = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status } = req.body;

        if (!['Pending', 'Reviewed', 'Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const application = await JobApplication.findById(applicationId).populate('job');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Check if the logged-in user is the job poster
        if (application.job.jobPoster.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this application' });
        }

        application.status = status;
        // mark applicant as unread for the new status so they get a notification
        application.applicantReadAt = null;
        await application.save();

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

        res.status(200).json({
            message: 'Application status updated successfully',
            application
        });
    } catch (error) {
        console.error('Update application status error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
            filter.status = status;
        }
        if (jobId && jobId !== 'All') {
            filter.job = jobId;
        }

        let applications = await JobApplication.find(filter)
            .populate('job', 'title company location jobType salary status')
            .populate('applicant', 'firstName lastName email role phoneNumber')
            .sort({ createdAt: -1 });

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mark employer notification as read
export const markEmployerApplicationRead = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (application.job.jobPoster.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this application' });
        }

        application.employerReadAt = new Date();
        await application.save();

        res.status(200).json({
            message: 'Notification marked as read',
            application
        });
    } catch (error) {
        console.error('Mark employer read error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Hide application from employer notifications/applications
export const hideEmployerApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (application.job.jobPoster.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this application' });
        }

        application.employerHidden = true;
        application.employerHiddenAt = new Date();
        await application.save();

        res.status(200).json({
            message: 'Application removed',
            application
        });
    } catch (error) {
        console.error('Hide employer application error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mark applicant notification as read
export const markApplicantApplicationRead = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await JobApplication.findById(applicationId).populate('job', 'jobPoster');
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Only the applicant can mark their application notification as read
        if (application.applicant.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this application' });
        }

        application.applicantReadAt = new Date();
        await application.save();

        res.status(200).json({
            message: 'Notification marked as read',
            application
        });
    } catch (error) {
        console.error('Mark applicant read error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
