import jwt from 'jsonwebtoken';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
import { createNotification } from '../lib/notificationService.js';

const getRequesterId = (req) => req.user?.id || req.user?.userId || null;
const getRequesterRole = (req) => String(req.user?.role || '').toLowerCase();
const isAdminRole = (role) => role === 'admin' || role === 'superadmin';
const canPostJobsRole = (role) =>
    role === 'hire' ||
    role === 'both' ||
    role === 'employer' ||
    role === 'doctor' ||
    isAdminRole(role);
const canApplyRole = (role) =>
    role === 'work' ||
    role === 'both' ||
    role === 'user' ||
    role === 'worker' ||
    role === 'patient';

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
            const safeSearch = escapeRegExp(String(search).trim());
            filter.$or = [
                { title: { $regex: safeSearch, $options: 'i' } },
                { description: { $regex: safeSearch, $options: 'i' } },
                { location: { $regex: safeSearch, $options: 'i' } }
            ];
        }

        if (excludeOwn === 'true') {
            const authHeader = req.headers.authorization || '';
            if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const decoded = jwt.verify(token, getJwtSecret());
                    const tokenUserId = decoded?.userId || decoded?.id || decoded?._id;
                    if (tokenUserId) {
                        filter.jobPoster = { $ne: tokenUserId };
                    }
                } catch (error) {
                    console.warn('Token verification failed for excludeOwn:', error.message);
                    // Ignore invalid token; return unfiltered results
                }
            }
        }
        
        const jobs = await Job.find(filter)
            .populate('category', 'name')
            .populate('jobPoster', '_id firstName lastName email')
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
        const job = await Job.findById(id).populate('category', 'name').populate('jobPoster', '_id firstName lastName email');
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
        const requesterId = getRequesterId(req);
        const requesterRole = getRequesterRole(req);
        const job = await Job.findById(jobId).populate('applicants');
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        if (job.jobPoster?.toString() !== requesterId && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: "Not authorized to view applicants for this job." });
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
        const requesterRole = getRequesterRole(req);
        const jobPosterId = getRequesterId(req);

        if (!jobPosterId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!canPostJobsRole(requesterRole)) {
            return res.status(403).json({ message: "Only employer accounts can create jobs." });
        }
        
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

        const salaryAmount = Number(salary);
        const positions = positionsNeeded ? Number(positionsNeeded) : 1;

        // total escrow required (salary per worker * positions)
        const totalEscrow = salaryAmount * positions;

        // 1. Check if user has enough balance
        const poster = await User.findById(jobPosterId);
        if (!poster) return res.status(404).json({ message: 'Job poster not found.' });
        
        // For "both" role users, allow using combined balance; otherwise only use employer balance
        const availableBalance = poster.role === 'both' 
            ? (poster.employerBalance || 0) + (poster.workerBalance || 0)
            : (poster.employerBalance || 0);
        
        if (availableBalance < totalEscrow) {
            return res.status(400).json({ message: 'Insufficient balance. Please top up your wallet.' });
        }

        // 2. Deduct the balance (move to escrow)
        // For "both" role users, deduct from employer balance first, then worker balance
        if (poster.role === 'both') {
            const employerPortion = Math.min(poster.employerBalance || 0, totalEscrow);
            const workerPortion = totalEscrow - employerPortion;
            poster.employerBalance = (poster.employerBalance || 0) - employerPortion;
            poster.workerBalance = (poster.workerBalance || 0) - workerPortion;
        } else {
            poster.employerBalance = (poster.employerBalance || 0) - totalEscrow;
        }
        await poster.save();

        // 3. Create the job (funds are now effectively in "escrow")
        const newJob = new Job({
            title,
            description,
            location,
            salary: salaryAmount,
            jobType,
            deadline,
            skills: skills || [],
            responsibilities: responsibilities || [],
            requirements: requirements || [],
            category,
            image,
            jobPoster: jobPosterId,
            urgent: Boolean(urgent),
            positionsNeeded: positions
        });
        await newJob.save();

        // 4. Record the transaction in the ledger (ESCROW)
        await Transaction.create({
            sender: poster._id,
            receiver: null, // Escrow
            amount: totalEscrow,
            type: 'ESCROW',
            status: 'COMPLETED',
            balanceTarget: 'ESCROW',
            jobReference: newJob._id,
            label: `Escrow (Job ${newJob._id})`,
            relatedEntityType: 'job',
            relatedEntityId: String(newJob._id),
            actor: poster._id,
        });
        try { const monitor = await import('../lib/monitor.js'); await monitor.default.audit({ actor: poster._id, action: 'job_escrow', ip: req.ip || null, userAgent: req.get('user-agent'), amount: totalEscrow, status: 'success', meta: { job: newJob._id } }); } catch (e) {}

        res.status(201).json({message: "Job created and funds secured.", job: newJob});
    } catch (error) {
        console.error('Create job error:', error);
        res.status(500).json({message: "Failed to create job.", error: error.message});
    }
}

export async function changeJobStatus(req, res){
    try {
        const {id} = req.params;
        const {status} = req.body;
        const requesterId = getRequesterId(req);
        const requesterRole = getRequesterRole(req);
        const statusOptions = ['Available', 'In Progress', 'Completed', 'Cancelled', 'Closed'];

        if(!statusOptions.includes(status)) {
            return res.status(400).json({message: "Invalid status value."});
        }
        const job = await Job.findById(id);
        if(!job) return res.status(404).json({message: "Job not found."});
        if (job.jobPoster?.toString() !== requesterId && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: "You are not allowed to update this job status." });
        }

        if (status === 'Completed' && job.status !== 'Completed') {
            // When completing a job, pay out all applicants that were marked as Hired
            const hiredApplications = await JobApplication.find({ job: job._id, status: 'Hired' });
            if (!hiredApplications || hiredApplications.length === 0) {
                return res.status(400).json({ message: 'No hired applicants to pay out.' });
            }

            for (const app of hiredApplications) {
                try {
                    const worker = await User.findById(app.applicant);
                    if (!worker) continue;
                    worker.workerBalance = (worker.workerBalance || 0) + job.salary;
                    await worker.save();

                    const payoutTx = await Transaction.create({
                        sender: null, // From escrow
                        receiver: worker._id,
                        amount: job.salary,
                        type: 'PAYOUT',
                        status: 'COMPLETED',
                        balanceTarget: 'WORKER',
                        jobReference: job._id,
                        label: `Payout (Job ${job._id})`,
                        relatedEntityType: 'job',
                        relatedEntityId: String(job._id),
                    });
                    await createNotification({
                        userId: worker._id,
                        type: 'payment',
                        title: 'Job payout completed',
                        message: `A payout of PHP ${Number(job.salary || 0).toFixed(2)} was added to your worker balance.`,
                        entityType: 'job',
                        entityId: job._id,
                        actor: job.jobPoster || null,
                        push: true,
                        socketPayload: { transactionId: String(payoutTx._id), jobId: String(job._id), amount: job.salary },
                    });
                    try { const monitor = await import('../lib/monitor.js'); await monitor.default.audit({ actor: null, action: 'job_payout', ip: req.ip || null, userAgent: req.get('user-agent'), amount: job.salary, status: 'success', meta: { job: job._id, worker: worker._id } }); } catch (e) {}
                } catch (e) {
                    console.warn('Failed to payout worker for job completion', e);
                }
            }
        }

        // Handle Refund logic if status is changing to Cancelled (refund remaining escrow)
        if (status === 'Cancelled' && job.status !== 'Cancelled' && job.status !== 'Completed') {
            const poster = await User.findById(job.jobPoster);
            if (poster) {
                // Calculate total escrow originally held for this job
                const totalEscrow = job.salary * (job.positionsNeeded || 1);

                // Sum payouts already made for this job
                const payouts = await Transaction.aggregate([
                    { $match: { jobReference: job._id, type: 'PAYOUT' } },
                    { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
                ]);
                const totalPaid = (payouts[0] && payouts[0].totalPaid) || 0;

                const refundAmount = Math.max(0, totalEscrow - totalPaid);
                if (refundAmount > 0) {
                    // Always refund to employer balance since escrow is job-posting related
                    poster.employerBalance = (poster.employerBalance || 0) + refundAmount;
                    await poster.save();

                    await Transaction.create({
                        sender: null,
                        receiver: poster._id,
                        amount: refundAmount,
                        type: 'REFUND',
                        status: 'COMPLETED',
                        balanceTarget: 'EMPLOYER',
                        jobReference: job._id,
                        label: `Refund (Job ${job._id})`,
                        relatedEntityType: 'job',
                        relatedEntityId: String(job._id),
                        actor: poster._id,
                    });
                    try { const monitor = await import('../lib/monitor.js'); await monitor.default.audit({ actor: poster._id, action: 'job_refund', ip: req.ip || null, userAgent: req.get('user-agent'), amount: refundAmount, status: 'success', meta: { job: job._id } }); } catch (e) {}
                }
            }
        }

        job.status = status;
        await job.save();

        res.status(200).json({message: "Job status updated.", job});
    } catch (error) {
        res.status(500).json({message: "Failed to change job status."});
    }
}

export async function applyForJob(req, res){
    try {
        const {jobId} = req.params;
        const userId = getRequesterId(req);
        const requesterRole = getRequesterRole(req);

        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!canApplyRole(requesterRole)) {
            return res.status(403).json({ message: "Only worker accounts can apply to jobs." });
        }

        const job = await Job.findById(jobId).populate('jobPoster');

        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }

        if(job.status !== "Available") {
            return res.status(400).json({message: "Cannot apply for this job. It is not available."});
        }
        if(job.applicants.includes(userId)) {
            return res.status(400).json({message: "You have already applied for this job."});
        }
        
        // Prevent applying to own job regardless of role
        if(job.jobPoster.toString() === userId) {
            return res.status(400).json({message: "You cannot apply for your own job."});
        }
        
        job.applicants.push(userId);

        await job.save();

        return res.status(200).json({message: "Successfully applied for the job.", job});
    } catch (error) {
        res.status(500).json({message: "Failed to apply for job."});
    }
}

export async function selectApplicant(req, res){
    try {
        const {jobId, applicantId} = req.params,
        job = await Job.findById(jobId);
        const requesterId = getRequesterId(req);
        const requesterRole = getRequesterRole(req);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        if (job.jobPoster?.toString() !== requesterId && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: "You are not allowed to select applicants for this job." });
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
