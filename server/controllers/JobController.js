import jwt from 'jsonwebtoken';
import Job from '../models/Job.js'
import JobApplication from '../models/JobApplication.js';

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
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
                    if (decoded?.id) {
                        filter.jobPoster = { $ne: decoded.id };
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
        res.status(500).json({message: "Failed to get jobs.", error: error.message});
    }
}

export async function getAvailableJobs(req, res){
    try {
        const jobs = await Job.find({status: 'Available'});
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to get available jobs."})
    }
}
export async function getJobByCategory(req, res) {
    try {
        const {categoryId} = req.params;
        const jobs = await Job.find({category: categoryId});
        if(!jobs || jobs.length === 0) {
            return res.status(404).json({message: "No jobs were found for this category."});
        }
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to get jobs."});
    }
}

export async function getJobDetails(req, res){
    try {
        const {id} = req.params;
        const job = await Job.findById(id).populate('category', 'name').populate('jobPoster', 'firstName lastName email');
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        res.status(200).json(job);
    } catch (error) {
        console.error('Get job details error:', error);
        res.status(500).json({message: "Failed to get job details.", error: error.message});
    }
}

export async function getApplicantsList(req, res){
    try {
        const {jobId} = req.params;
        const job = await Job.findById(jobId).populate('applicants');
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        res.status(200).json(job.applicants);
    } catch (error) {
        res.status(500).json({message: "Failed to get applicants."});
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
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}.`
            });
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
        res.status(201).json({message: "Job created successfully.", job: newJob});
    } catch (error) {
        console.error('Create job error:', error);
        res.status(500).json({message: "Failed to create job.", error: error.message});
    }
}

export async function changeJobStatus(req, res){
    try {
        const {id} = req.params;
        const {status} = req.body;
        const statusOptions = ['Available', 'In Progress', 'Completed', 'Cancelled', 'Closed'];

        if(!statusOptions.includes(status)) {
            return res.status(400).json({message: "Invalid status value."});
        }
        const job = await Job.findByIdAndUpdate(id, {status}, {new: true});
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        res.status(200).json({message: "Job status updated."}, job);
    } catch (error) {
        res.status(500).json({message: "Failed to change job status."});
    }
}

export async function applyForJob(req, res){
    try {
        const {jobId} = req.params;
        const userId = req.user.id;

        const job = await Job.findById(jobId);

        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }

        if(job.status !== "Available") {
            return res.status(400).json({message: "Cannot apply for this job. It is not available."});
        }
        if(job.applicants.includes(userId)) {
            return res.status(400).json({message: "You have already applied for this job."});
        }
        if(job.jobPoster.toString() === userId) {
            return res.status(400).json({message: "You cannot apply for your own job."});
        }
        job.applicants.push(userId);

        return res.status(200).json({message: "Successfully applied for the job.", job});
    } catch (error) {
        res.status(500).json({message: "Failed to apply for job."});
    }
}

export async function selectApplicant(req, res){
    try {
        const {jobId, applicantId} = req.params,
        job = await Job.findById(jobId);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        if(!job.applicants.includes(applicantId)) {
            return res.status(400).json({message: "Applicant did not apply for this job."});
        }
        job.selectedApplicant = applicantId;
        job.status = "In Progress";
        await job.save();
        res.status(200).json({message: "Applicant selected successfully.", job});
    } catch (error) {
        res.status(500).json({message: "Failed to select an applicant."});
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
        res.status(500).json({ message: 'Failed to get my jobs.', error: error.message });
    }
}

export async function updateJob(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }

        if (job.jobPoster.toString() !== userId) {
            return res.status(403).json({ message: "You are not allowed to update this job." });
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
                        return res.status(400).json({ message: `${key} is required.` });
                    }
                }
                if (key === "deadline" && value) {
                    const parsed = new Date(value);
                    if (Number.isNaN(parsed.getTime())) {
                        return res.status(400).json({ message: "Invalid deadline date." });
                    }
                    value = parsed;
                }
                if (["skills", "responsibilities", "requirements"].includes(key) && value && !Array.isArray(value)) {
                    return res.status(400).json({ message: `${key} must be an array.` });
                }
                if (key === "urgent") {
                    value = Boolean(value);
                }
                if (key === "positionsNeeded") {
                    const n = Number(value);
                    if (Number.isNaN(n) || n < 1) {
                        return res.status(400).json({ message: "positionsNeeded must be a positive number." });
                    }
                    value = n;
                }
                updates[key] = value;
            }
        }

        const updated = await Job.findByIdAndUpdate(id, updates, { new: true })
            .populate('category', 'name')
            .populate('jobPoster', 'firstName lastName email');

        return res.status(200).json({ message: "Job updated successfully.", job: updated });
    } catch (error) {
        console.error('Update job error:', error);
        return res.status(500).json({ message: "Failed to update job.", error: error.message });
    }
}

export async function deleteJob(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.jobPoster.toString() !== userId) {
            return res.status(403).json({ message: 'You are not allowed to delete this job.' });
        }

        // Delete associated applications
        try {
            await JobApplication.deleteMany({ job: id });
        } catch (e) {
            console.warn('Failed to remove job applications for deleted job', e);
        }

        await Job.findByIdAndDelete(id);

        return res.status(200).json({ message: 'Job deleted successfully.' });
    } catch (error) {
        console.error('Delete job error:', error);
        return res.status(500).json({ message: 'Failed to delete job.', error: error.message });
    }
}