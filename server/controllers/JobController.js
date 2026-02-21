import jwt from 'jsonwebtoken';
import Job from '../models/Job.js'
import JobApplication from '../models/JobApplication.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const jwtSecret = getJwtSecret();

export async function getJobList(req, res) {
    try {
        const { category, jobType, search, excludeOwn } = req.query;
        
        let filter = {};
        
        // Filter by category
        if (category && category !== 'All') {
            filter.category = category;
        }
        
        // Filter by job type
        if (jobType) {
            const types = jobType.split(',');
            filter.jobType = { $in: types };
        }
        
        // Search filter
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }

        if (excludeOwn === 'true') {
            const authHeader = req.headers.authorization || '';
            if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const decoded = jwt.verify(token, jwtSecret);
                    const tokenUserId = decoded?.userId || decoded?.id;
                    if (tokenUserId) {
                        filter.jobPoster = { $ne: tokenUserId };
                    }
                } catch (error) {
                    // Ignore invalid token; return unfiltered results
                }
            }
        }
        
        const jobs = await Job.find(filter)
            .populate('category', 'name')
            .populate('jobPoster', 'firstName lastName email')
            .sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (error) {
        console.error('Get jobs error:', error);
        sendError(res, 500, "Failed to get jobs.", { error: error.message });
    }
}

export async function getAvailableJobs(req, res){
    try {
        const jobs = await Job.find({status: 'Available'});
        res.status(200).json(jobs);
    } catch (error) {
        sendError(res, 500, "Failed to get available jobs.");
    }
}
export async function getJobByCategory(req, res) {
    try {
        const {categoryId} = req.params;
        const jobs = await Job.find({category: categoryId});
        if(!jobs || jobs.length === 0) {
            return sendError(res, 404, "No jobs were found for this category.");
        }
        res.status(200).json(jobs);
    } catch (error) {
        sendError(res, 500, "Failed to get jobs.");
    }
}

export async function getJobDetails(req, res){
    try {
        const {id} = req.params;
        const job = await Job.findById(id).populate('category', 'name').populate('jobPoster', 'firstName lastName email');
        if(!job) {
            return sendError(res, 404, "Job not found.");
        }
        res.status(200).json(job);
    } catch (error) {
        console.error('Get job details error:', error);
        sendError(res, 500, "Failed to get job details.", { error: error.message });
    }
}

export async function getApplicantsList(req, res){
    try {
        const {jobId} = req.params;
        const job = await Job.findById(jobId).populate('applicants');
        if(!job) {
            return sendError(res, 404, "Job not found.");
        }
        res.status(200).json(job.applicants);
    } catch (error) {
        sendError(res, 500, "Failed to get applicants.");
    }
}
export async function createJob(req, res){
    try {
        const {
            title, 
            description, 
            location,
            salary,
            jobType,
            deadline,
            skills,
            responsibilities,
            requirements,
            category, 
            image,
            urgent,
            positionsNeeded
        } = req.body;
        const jobPoster = req.user.id;
        
        const missingFields = [];
        if (!title) missingFields.push('title');
        if (!description) missingFields.push('description');
        if (!location) missingFields.push('location');
        if (!salary) missingFields.push('salary');
        if (!jobType) missingFields.push('jobType');
        if (!deadline) missingFields.push('deadline');

        if (missingFields.length > 0) {
            return sendError(res, 400, `Missing required fields: ${missingFields.join(', ')}.`);
        }

        const newJob = new Job({
            title,
            description,
            location,
            salary,
            jobType,
            deadline,
            skills: skills || [],
            responsibilities: responsibilities || [],
            requirements: requirements || [],
            category,
            image,
            jobPoster,
            urgent: Boolean(urgent)
            ,
            positionsNeeded: positionsNeeded ? Number(positionsNeeded) : 1
        });

        await newJob.save();
        return sendSuccess(res, 201, "Job created successfully.", newJob, { job: newJob });
    } catch (error) {
        console.error('Create job error:', error);
        return sendError(res, 500, "Failed to create job.", { error: error.message });
    }
}

export async function changeJobStatus(req, res){
    try {
        const {id} = req.params;
        const {status} = req.body;
        const statusOptions = ['Available', 'In Progress', 'Completed', 'Cancelled', 'Closed'];

        if(!statusOptions.includes(status)) {
            return sendError(res, 400, "Invalid status value.");
        }
        const job = await Job.findByIdAndUpdate(id, {status}, {new: true});
        if(!job) {
            return sendError(res, 404, "Job not found.");
        }
        return sendSuccess(res, 200, "Job status updated.", job, { job });
    } catch (error) {
        return sendError(res, 500, "Failed to change job status.");
    }
}

export async function applyForJob(req, res){
    try {
        const {jobId} = req.params;
        const userId = req.user.id;

        const job = await Job.findById(jobId);

        if(!job) {
            return sendError(res, 404, "Job not found.");
        }

        if(job.status !== "Available") {
            return sendError(res, 400, "Cannot apply for this job. It is not available.");
        }
        if(job.applicants.includes(userId)) {
            return sendError(res, 400, "You have already applied for this job.");
        }
        if(job.jobPoster.toString() === userId) {
            return sendError(res, 400, "You cannot apply for your own job.");
        }
        job.applicants.push(userId);
        await job.save();

        return sendSuccess(res, 200, "Successfully applied for the job.", job, { job });
    } catch (error) {
        return sendError(res, 500, "Failed to apply for job.");
    }
}

export async function selectApplicant(req, res){
    try {
        const {jobId, applicantId} = req.params,
        job = await Job.findById(jobId);
        if(!job) {
            return sendError(res, 404, "Job not found.");
        }
        if(!job.applicants.includes(applicantId)) {
            return sendError(res, 400, "Applicant did not apply for this job.");
        }
        job.selectedApplicant = applicantId;
        job.status = "In Progress";
        await job.save();
        return sendSuccess(res, 200, "Applicant selected successfully.", job, { job });
    } catch (error) {
        return sendError(res, 500, "Failed to select an applicant.");
    }
}

export async function getMyJobs(req, res) {
    try {
        const userId = req.user.id;
        const jobs = await Job.find({ jobPoster: userId })
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (error) {
        console.error('Get my jobs error:', error);
        sendError(res, 500, 'Failed to get my jobs.', { error: error.message });
    }
}

export async function updateJob(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const job = await Job.findById(id);
        if (!job) {
            return sendError(res, 404, "Job not found.");
        }

        if (job.jobPoster.toString() !== userId) {
            return sendError(res, 403, "You are not allowed to update this job.");
        }

        const allowed = [
            "title",
            "description",
            "location",
            "salary",
            "jobType",
            "deadline",
            "skills",
            "responsibilities",
            "requirements",
            "category",
            "image",
            "urgent",
            "positionsNeeded",
        ];

        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                let value = req.body[key];
                if (typeof value === "string") {
                    value = value.trim();
                    if (value === "") {
                        return sendError(res, 400, `${key} is required.`);
                    }
                }
                if (key === "deadline" && value) {
                    const parsed = new Date(value);
                    if (Number.isNaN(parsed.getTime())) {
                        return sendError(res, 400, "Invalid deadline date.");
                    }
                    value = parsed;
                }
                if (["skills", "responsibilities", "requirements"].includes(key) && value && !Array.isArray(value)) {
                    return sendError(res, 400, `${key} must be an array.`);
                }
                if (key === "urgent") {
                    value = Boolean(value);
                }
                if (key === "positionsNeeded") {
                    const n = Number(value);
                    if (Number.isNaN(n) || n < 1) {
                        return sendError(res, 400, "positionsNeeded must be a positive number.");
                    }
                    value = n;
                }
                updates[key] = value;
            }
        }

        const updated = await Job.findByIdAndUpdate(id, updates, { new: true })
            .populate('category', 'name')
            .populate('jobPoster', 'firstName lastName email');

        return sendSuccess(res, 200, "Job updated successfully.", updated, { job: updated });
    } catch (error) {
        console.error('Update job error:', error);
        return sendError(res, 500, "Failed to update job.", { error: error.message });
    }
}

export async function deleteJob(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const job = await Job.findById(id);
        if (!job) {
            return sendError(res, 404, 'Job not found.');
        }

        if (job.jobPoster.toString() !== userId) {
            return sendError(res, 403, 'You are not allowed to delete this job.');
        }

        // Delete associated applications
        try {
            await JobApplication.deleteMany({ job: id });
        } catch (e) {
            console.warn('Failed to remove job applications for deleted job', e);
        }

        await Job.findByIdAndDelete(id);

        return sendSuccess(res, 200, 'Job deleted successfully.', { id }, { id });
    } catch (error) {
        console.error('Delete job error:', error);
        return sendError(res, 500, 'Failed to delete job.', { error: error.message });
    }
}
