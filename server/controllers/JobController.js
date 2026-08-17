import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import { createNotification } from '../lib/notificationService.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import { getReviewSummaries } from '../lib/reviewSummary.js';
import { isSupportedJobType, parseMinimumPay } from '../lib/jobPosting.js';
import {
    APPLICANT_SELECT,
    PUBLIC_JOB_POSTER_SELECT,
    addCityFilter,
    resolveDiscoveryCity,
    serializeApplicant,
    serializePublicJob,
} from '../lib/jobDiscovery.js';

const getRequesterId = (req) => req.user?.id || req.user?.userId || null;
const getRequesterRole = (req) => String(req.user?.role || '').toLowerCase();
const isAdminRole = (role) => role === 'admin' || role === 'superadmin';
const canPostJobsRole = (role) =>
    role === 'hire' ||
    role === 'both' ||
    role === 'employer' ||
    role === 'doctor' ||
    isAdminRole(role);
const cityRequiredResponse = (res) => res.status(428).json({
    message: 'Set your city or municipality before searching for local jobs.',
    code: 'CITY_REQUIRED',
});

const getDiscoveryCity = (req) => resolveDiscoveryCity({
    userId: getRequesterId(req),
    role: getRequesterRole(req),
    requestedCity: req.query?.city,
    allowUnscoped: canPostJobsRole(getRequesterRole(req)) || isAdminRole(getRequesterRole(req)),
});

export async function getJobList(req, res) {
    try {
        const { category, jobType, search, excludeOwn } = req.query;
        const discovery = await getDiscoveryCity(req);
        if (discovery.error) return cityRequiredResponse(res);
        
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

        // Local-community discovery is scoped to the worker's city/municipality.
        filter = addCityFilter(filter, discovery.city);
        
        // Search filter
        if (search) {
            const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { title: { $regex: safeSearch, $options: 'i' } },
                { description: { $regex: safeSearch, $options: 'i' } },
                { location: { $regex: safeSearch, $options: 'i' } }
            ];
        }

        if (excludeOwn === 'true' && getRequesterId(req)) {
            filter.jobPoster = { $ne: getRequesterId(req) };
        }
        
        const jobs = await Job.find(filter)
            .populate('category', 'name')
            .populate('jobPoster', PUBLIC_JOB_POSTER_SELECT)
            .sort({ createdAt: -1 });
        res.status(200).json(jobs.map(serializePublicJob));
    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({message: "Failed to get jobs.", error: error.message});
    }
}

export async function getAvailableJobs(req, res){
    try {
        const discovery = await getDiscoveryCity(req);
        if (discovery.error) return cityRequiredResponse(res);
        const jobs = await Job.find(addCityFilter({ status: 'Available' }, discovery.city))
            .populate('category', 'name')
            .populate('jobPoster', PUBLIC_JOB_POSTER_SELECT);
        res.status(200).json(jobs.map(serializePublicJob));
    } catch (error) {
        res.status(500).json({message: "Failed to get available jobs."})
    }
}
export async function getJobByCategory(req, res) {
    try {
        const {categoryId} = req.params;
        const discovery = await getDiscoveryCity(req);
        if (discovery.error) return cityRequiredResponse(res);
        const jobs = await Job.find(addCityFilter({ category: categoryId }, discovery.city))
            .populate('category', 'name')
            .populate('jobPoster', PUBLIC_JOB_POSTER_SELECT);
        if(!jobs || jobs.length === 0) {
            return res.status(404).json({message: "No jobs were found for this category."});
        }
        res.status(200).json(jobs.map(serializePublicJob));
    } catch (error) {
        res.status(500).json({message: "Failed to get jobs."});
    }
}

export async function getJobDetails(req, res){
    try {
        const {id} = req.params;
        const job = await Job.findById(id).populate('category', 'name').populate('jobPoster', PUBLIC_JOB_POSTER_SELECT);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        res.status(200).json(serializePublicJob(job));
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
        const job = await Job.findById(jobId)
            .populate('category', 'name')
            .populate('applicants', `${APPLICANT_SELECT} workExperience jobPreferences preferredCategories`);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        if (String(job.jobPoster || '') !== String(requesterId || '') && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: "Not authorized to view applicants for this job." });
        }
        const ratings = await getReviewSummaries(job.applicants.map((item) => item._id), 'worker');
        res.status(200).json(job.applicants.map((applicant) => ({
            ...serializeApplicant(applicant),
            match: scoreJobForWorker(job, applicant),
            rating: ratings.get(String(applicant._id)) || { averageRating: 0, totalReviews: 0 },
        })));
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
        if (!category) missingFields.push('category');

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}.`
            });
        }

        if (!mongoose.Types.ObjectId.isValid(String(category))) {
            return res.status(400).json({ message: 'Please select a valid job category.' });
        }
        const categoryExists = await Category.exists({ _id: category });
        if (!categoryExists) {
            return res.status(400).json({ message: 'Selected job category was not found.' });
        }

        const salaryAmount = parseMinimumPay(salary);
        const positions = positionsNeeded ? Number(positionsNeeded) : 1;

        if (salaryAmount === null) {
            return res.status(400).json({ message: 'Minimum guaranteed pay must be greater than zero.' });
        }
        const normalizedJobType = typeof jobType === 'string' ? jobType.trim() : '';
        if (!isSupportedJobType(normalizedJobType)) {
            return res.status(400).json({ message: 'Please select a valid opportunity type.' });
        }
        if (!Number.isInteger(positions) || positions < 1) {
            return res.status(400).json({ message: 'positionsNeeded must be a positive whole number.' });
        }

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
            return res.status(400).json({
                code: 'INSUFFICIENT_BALANCE',
                message: 'You do not have enough balance to fund this job. Please top up your wallet and try again.',
                availableBalance,
                requiredBalance: totalEscrow,
                shortfall: Number((totalEscrow - availableBalance).toFixed(2)),
            });
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
            jobType: normalizedJobType,
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
            // Atomic payout/refund flow: compute remaining escrow and pay payable candidates inside
            // a MongoDB transaction to avoid partial state where refunds are issued but payouts failed.
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                // Support both canonical and legacy hired states before releasing remaining escrow.
                const hiredApplications = await JobApplication.find({
                    job: job._id,
                    status: { $in: ['Hired', 'Accepted'] },
                }).select('_id applicant agreedAmount workStatus paymentStatus').session(session);

                const payoutCandidates = [];
                const seenApplicantIds = new Set();

                for (const app of hiredApplications) {
                    const applicantId = String(app.applicant);
                    if (seenApplicantIds.has(applicantId)) continue;
                    seenApplicantIds.add(applicantId);
                    payoutCandidates.push({ applicant: app.applicant, applicationId: String(app._id), agreedAmount: Number(app.agreedAmount || job.salary || 0), hasLifecycle: Number(app.agreedAmount || 0) > 0, workStatus: app.workStatus, paymentStatus: app.paymentStatus });
                }

                if (job.selectedApplicant) {
                    const selectedApplicantId = String(job.selectedApplicant);
                    if (!seenApplicantIds.has(selectedApplicantId)) {
                        const selectedApplicantApplication = await JobApplication.findOne({
                            job: job._id,
                            applicant: job.selectedApplicant,
                        }).select('_id applicant').session(session);

                        if (selectedApplicantApplication) {
                            payoutCandidates.push({
                                applicant: selectedApplicantApplication.applicant,
                                applicationId: String(selectedApplicantApplication._id),
                            });
                        } else {
                            payoutCandidates.push({ applicant: job.selectedApplicant, applicationId: null });
                        }
                        seenApplicantIds.add(selectedApplicantId);
                    }
                }

                // Net remaining escrow = all ESCROW collected - all PAYOUT made - all REFUND issued.
                const [escrowAgg, paidAgg, refundAgg] = await Promise.all([
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'ESCROW', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]).session(session),
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'PAYOUT', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]).session(session),
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'REFUND', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]).session(session),
                ]);
                const totalEscrowed = (escrowAgg[0] && escrowAgg[0].total) || 0;
                const totalPaid    = (paidAgg[0]   && paidAgg[0].total)   || 0;
                const totalRefunded = (refundAgg[0] && refundAgg[0].total) || 0;
                const totalPaidBefore = totalPaid;
                let remainingEscrow = Math.max(0, totalEscrowed - totalPaid - totalRefunded);

                // Determine already paid receivers to avoid double paying
                const paidReceivers = await Transaction.find({
                    jobReference: job._id,
                    type: 'PAYOUT',
                    status: 'COMPLETED',
                }).select('receiver').lean().session(session);
                const paidReceiverIds = new Set(
                    paidReceivers
                        .map((tx) => (tx.receiver ? String(tx.receiver) : null))
                        .filter(Boolean)
                );

                const candidateUserIds = Array.from(new Set(payoutCandidates.map((c) => String(c.applicant))));
                const existingUsers = candidateUserIds.length
                    ? await User.find({ _id: { $in: candidateUserIds } }).select('_id').lean().session(session)
                    : [];
                const existingUserIds = new Set(existingUsers.map((u) => String(u._id)));

                const payableCandidates = payoutCandidates.filter((candidate) =>
                    existingUserIds.has(String(candidate.applicant)) && !paidReceiverIds.has(String(candidate.applicant))
                );

                const unfinishedCandidate = payableCandidates.find((candidate) => candidate.hasLifecycle && candidate.workStatus !== 'Submitted');
                if (unfinishedCandidate) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(409).json({ message: 'Each hired worker must submit finished work before the job can be completed.' });
                }

                // Debug: log payout decision variables to help diagnose why payouts may not run
                console.debug('JobCompletionDebug: totals', { totalEscrowed, totalPaid, totalRefunded, remainingEscrow });
                console.debug('JobCompletionDebug: payoutCandidates', payoutCandidates.map((c) => ({ applicant: String(c.applicant), applicationId: c.applicationId })));
                console.debug('JobCompletionDebug: paidReceiverIds', Array.from(paidReceiverIds));
                console.debug('JobCompletionDebug: existingUserIds', Array.from(existingUserIds));
                console.debug('JobCompletionDebug: payableCandidates', payableCandidates.map((c) => ({ applicant: String(c.applicant), applicationId: c.applicationId })));

                if (totalPaidBefore <= 0 && payableCandidates.length === 0) {
                    await session.abortTransaction();
                    session.endSession();
                    console.warn('JobCompletionDebug: no payable candidates, aborting - employer must hire at least one worker');
                    return res.status(400).json({
                        message: 'Cannot mark job as done yet. Move at least one worker application to Hired first.',
                    });
                }

                let payoutsProcessed = 0;
                for (const candidate of payableCandidates) {
                    const payoutAmount = Math.min(Number(candidate.agreedAmount || job.salary || 0), remainingEscrow);
                    if (payoutAmount <= 0) break;

                    const worker = await User.findById(candidate.applicant).session(session);
                    if (!worker) continue;
                    worker.workerBalance = (worker.workerBalance || 0) + payoutAmount;
                    await worker.save({ session });

                    const relatedEntityType = candidate.applicationId ? 'job_application' : 'job_worker';
                    const relatedEntityId = candidate.applicationId || String(worker._id);

                    const payoutTx = await Transaction.create([
                        {
                            sender: null, // From escrow
                            receiver: worker._id,
                            amount: payoutAmount,
                            type: 'PAYOUT',
                            status: 'COMPLETED',
                            balanceTarget: 'WORKER',
                            jobReference: job._id,
                            label: `Payout (Job ${job._id})`,
                            relatedEntityType,
                            relatedEntityId,
                        },
                    ], { session });
                    payoutsProcessed += 1;
                    remainingEscrow = Number((remainingEscrow - payoutAmount).toFixed(2));
                    if (candidate.applicationId) await JobApplication.updateOne({ _id: candidate.applicationId }, { $set: { workStatus: 'Completed', paymentStatus: 'Paid', completedAt: new Date(), paidAt: new Date() } }, { session });

                    await createNotification({
                        userId: worker._id,
                        audience: 'worker',
                        type: 'payment',
                        title: 'Job payout completed',
                        message: `A payout of PHP ${Number(payoutAmount || 0).toFixed(2)} was added to your worker balance.`,
                        entityType: 'job',
                        entityId: job._id,
                        actor: job.jobPoster || null,
                        push: true,
                        socketPayload: { transactionId: String(payoutTx[0]._id), jobId: String(job._id), amount: payoutAmount },
                    });
                    try { const monitor = await import('../lib/monitor.js'); await monitor.default.audit({ actor: null, action: 'job_payout', ip: req.ip || null, userAgent: req.get('user-agent'), amount: payoutAmount, status: 'success', meta: { job: job._id, worker: worker._id, application: candidate.applicationId || null } }); } catch (e) {}
                }

                if (totalPaidBefore <= 0 && payoutsProcessed <= 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(500).json({
                        message: 'Unable to process worker payout. Job was not marked as done.',
                    });
                }

                // Return any unused escrow back to employer when job is finalized as completed.
                if (remainingEscrow > 0) {
                    console.debug('JobCompletionDebug: issuing refund for remainingEscrow', remainingEscrow);
                    const poster = await User.findById(job.jobPoster).session(session);
                    if (poster) {
                        poster.employerBalance = (poster.employerBalance || 0) + remainingEscrow;
                        await poster.save({ session });

                        await Transaction.create([
                            {
                                sender: null,
                                receiver: poster._id,
                                amount: remainingEscrow,
                                type: 'REFUND',
                                status: 'COMPLETED',
                                balanceTarget: 'EMPLOYER',
                                jobReference: job._id,
                                label: `Unused escrow refund (Job ${job._id})`,
                                relatedEntityType: 'job',
                                relatedEntityId: String(job._id),
                                actor: poster._id,
                            },
                        ], { session });
                    }
                }

                await session.commitTransaction();
                session.endSession();
            } catch (err) {
                console.error('Job completion payout error:', err);
                try { await session.abortTransaction(); } catch(e){}
                session.endSession();
                return res.status(500).json({ message: 'Failed to process payouts for job completion.' });
            }
        }

        // Handle Refund logic if status is changing to Cancelled (refund remaining escrow)
        if (status === 'Cancelled' && job.status !== 'Cancelled' && job.status !== 'Completed') {
            const poster = await User.findById(job.jobPoster);
            if (poster) {
                // Net remaining escrow across all cycles
                const [escrowAggC, paidAggC, refundAggC] = await Promise.all([
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'ESCROW', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]),
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'PAYOUT', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]),
                    Transaction.aggregate([
                        { $match: { jobReference: job._id, type: 'REFUND', status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]),
                ]);
                const totalEscrowed = (escrowAggC[0] && escrowAggC[0].total) || 0;
                const totalCPaid    = (paidAggC[0]   && paidAggC[0].total)   || 0;
                const totalCRefunded = (refundAggC[0] && refundAggC[0].total) || 0;

                const refundAmount = Math.max(0, totalEscrowed - totalCPaid - totalCRefunded);
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
        // Record the employer's intent so hiring-state changes cannot silently
        // reopen a post that was closed by hand (or keep one closed after the
        // employer explicitly makes it available again).
        if (status === 'Closed') {
            job.closedManually = true;
        } else if (status === 'Available') {
            job.closedManually = false;
        }
        await job.save();
        if (status === 'Completed') {
            await JobApplication.updateMany(
                { job: job._id, status: { $in: ['Hired', 'Accepted'] } },
                { $set: { completedAt: new Date() } }
            );
        }

        res.status(200).json({message: "Job status updated.", job});
    } catch (error) {
        res.status(500).json({message: "Failed to change job status."});
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
        await JobApplication.findOneAndUpdate(
            { job: job._id, applicant: applicantId },
            { $set: { status: 'Hired', applicantReadAt: null } }
        );
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
                if (key === "category") {
                    if (!mongoose.Types.ObjectId.isValid(String(value)) || !(await Category.exists({ _id: value }))) {
                        return res.status(400).json({ message: "Please select a valid job category." });
                    }
                }
                if (key === "salary") {
                    const amount = parseMinimumPay(value);
                    if (amount === null) {
                        return res.status(400).json({ message: "Minimum guaranteed pay must be greater than zero." });
                    }
                    value = amount;
                }
                if (key === "jobType" && !isSupportedJobType(value)) {
                    return res.status(400).json({ message: "Please select a valid opportunity type." });
                }
                if (["skills", "responsibilities", "requirements"].includes(key) && value && !Array.isArray(value)) {
                    return res.status(400).json({ message: `${key} must be an array.` });
                }
                if (key === "urgent") {
                    value = Boolean(value);
                }
                if (key === "positionsNeeded") {
                    const n = Number(value);
                    if (!Number.isInteger(n) || n < 1) {
                        return res.status(400).json({ message: "positionsNeeded must be a positive whole number." });
                    }
                    value = n;
                }
                updates[key] = value;
            }
        }

        const nextPositions = Number(updates.positionsNeeded ?? job.positionsNeeded ?? 1);
        if (nextPositions < Number(job.hiredCount || 0) + Number(job.reservedOfferCount || 0)) {
            return res.status(400).json({
                message: 'Workers needed cannot be lower than workers already hired plus positions reserved by active formal offers.',
            });
        }

        // Available, in-progress, and closed jobs still have funds secured in escrow.
        // Keep wallet and escrow totals aligned when minimum pay or worker count changes.
        const hasActiveEscrow = !['Completed', 'Cancelled'].includes(job.status);
        const currentEscrow = Number(job.salary || 0) * Number(job.positionsNeeded || 1);
        const nextSalary = Number(updates.salary ?? job.salary ?? 0);
        const nextEscrow = nextSalary * nextPositions;
        const escrowDifference = hasActiveEscrow ? nextEscrow - currentEscrow : 0;

        if (escrowDifference !== 0) {
            const poster = await User.findById(job.jobPoster);
            if (!poster) {
                return res.status(404).json({ message: 'Job poster not found.' });
            }

            if (escrowDifference > 0) {
                const availableBalance = poster.role === 'both'
                    ? Number(poster.employerBalance || 0) + Number(poster.workerBalance || 0)
                    : Number(poster.employerBalance || 0);

                if (availableBalance < escrowDifference) {
                    return res.status(400).json({
                        code: 'INSUFFICIENT_BALANCE',
                        message: 'You do not have enough balance to increase this job funding. Please top up your wallet and try again.',
                        availableBalance,
                        requiredBalance: escrowDifference,
                        shortfall: Number((escrowDifference - availableBalance).toFixed(2)),
                    });
                }

                if (poster.role === 'both') {
                    const employerPortion = Math.min(Number(poster.employerBalance || 0), escrowDifference);
                    const workerPortion = escrowDifference - employerPortion;
                    poster.employerBalance = Number(poster.employerBalance || 0) - employerPortion;
                    poster.workerBalance = Number(poster.workerBalance || 0) - workerPortion;
                } else {
                    poster.employerBalance = Number(poster.employerBalance || 0) - escrowDifference;
                }
                await poster.save();

                await Transaction.create({
                    sender: poster._id,
                    receiver: null,
                    amount: escrowDifference,
                    type: 'ESCROW',
                    status: 'COMPLETED',
                    balanceTarget: 'ESCROW',
                    jobReference: job._id,
                    label: `Escrow adjustment on job update (Job ${job._id})`,
                    relatedEntityType: 'job',
                    relatedEntityId: String(job._id),
                    actor: poster._id,
                    meta: { previousTotal: currentEscrow, updatedTotal: nextEscrow },
                });
            } else {
                const refundAmount = Math.abs(escrowDifference);
                poster.employerBalance = Number(poster.employerBalance || 0) + refundAmount;
                await poster.save();

                await Transaction.create({
                    sender: null,
                    receiver: poster._id,
                    amount: refundAmount,
                    type: 'REFUND',
                    status: 'COMPLETED',
                    balanceTarget: 'EMPLOYER',
                    jobReference: job._id,
                    label: `Escrow refund on job update (Job ${job._id})`,
                    relatedEntityType: 'job',
                    relatedEntityId: String(job._id),
                    actor: poster._id,
                    meta: { previousTotal: currentEscrow, updatedTotal: nextEscrow },
                });
            }
        }

        const updated = await Job.findByIdAndUpdate(id, updates, { returnDocument: 'after' })
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
        const requesterRole = getRequesterRole(req);

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.jobPoster.toString() !== userId && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: 'You are not allowed to delete this job.' });
        }

        // Refund any unspent escrow before deleting (for Active / Closed jobs)
        const nonRefundedStatuses = ['Completed', 'Cancelled'];
        if (!nonRefundedStatuses.includes(job.status)) {
            const poster = await User.findById(job.jobPoster);
            if (poster) {
                const totalEscrow = Number(job.salary || 0) * Number(job.positionsNeeded || 1);
                const payouts = await Transaction.aggregate([
                    { $match: { jobReference: job._id, type: 'PAYOUT', status: 'COMPLETED' } },
                    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
                ]);
                const totalPaid = (payouts[0] && payouts[0].totalPaid) || 0;
                const refundAmount = Math.max(0, totalEscrow - totalPaid);
                if (refundAmount > 0) {
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
                        label: `Escrow refund on job delete (Job ${job._id})`,
                        relatedEntityType: 'job',
                        relatedEntityId: String(job._id),
                        actor: poster._id,
                    });
                }
            }
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

export async function reopenJob(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const requesterRole = getRequesterRole(req);

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.jobPoster.toString() !== userId && !isAdminRole(requesterRole)) {
            return res.status(403).json({ message: 'You are not allowed to reopen this job.' });
        }

        if (job.status === 'Available') {
            return res.status(400).json({ message: 'Job is already open.' });
        }

        if (job.status === 'In Progress') {
            return res.status(400).json({ message: 'Cannot reopen a job that is currently in progress.' });
        }

        // For Completed or Cancelled jobs the escrow was already released/refunded.
        // We need to re-collect the escrow from the employer.
        const needsReEscrow = job.status === 'Completed' || job.status === 'Cancelled';

        if (needsReEscrow) {
            const totalEscrow = Number(job.salary || 0) * Number(job.positionsNeeded || 1);
            const poster = await User.findById(job.jobPoster);
            if (!poster) {
                return res.status(404).json({ message: 'Job poster not found.' });
            }

            const availableBalance =
                poster.role === 'both'
                    ? (poster.employerBalance || 0) + (poster.workerBalance || 0)
                    : (poster.employerBalance || 0);

            if (availableBalance < totalEscrow) {
                return res.status(400).json({
                    message: `Insufficient balance to reopen this job. You need PHP ${totalEscrow.toFixed(2)} in escrow.`,
                });
            }

            if (poster.role === 'both') {
                const employerPortion = Math.min(poster.employerBalance || 0, totalEscrow);
                const workerPortion = totalEscrow - employerPortion;
                poster.employerBalance = (poster.employerBalance || 0) - employerPortion;
                poster.workerBalance = (poster.workerBalance || 0) - workerPortion;
            } else {
                poster.employerBalance = (poster.employerBalance || 0) - totalEscrow;
            }
            await poster.save();

            await Transaction.create({
                sender: poster._id,
                receiver: null,
                amount: totalEscrow,
                type: 'ESCROW',
                status: 'COMPLETED',
                balanceTarget: 'ESCROW',
                jobReference: job._id,
                label: `Re-escrow on job reopen (Job ${job._id})`,
                relatedEntityType: 'job',
                relatedEntityId: String(job._id),
                actor: poster._id,
            });
        }

        // Reset applicants so fresh applications can be collected
        job.applicants = [];
        job.selectedApplicant = null;
        job.status = 'Available';
        // An explicit reopen clears the manual-close flag so capacity can manage
        // Available/Closed again.
        job.closedManually = false;
        await job.save();

        // Remove old JobApplication records so workers can apply again fresh
        try {
            await JobApplication.deleteMany({ job: job._id });
        } catch (e) {
            console.warn('Failed to remove old applications on reopen', e);
        }

        return res.status(200).json({ message: 'Job reopened successfully.', job });
    } catch (error) {
        console.error('Reopen job error:', error);
        return res.status(500).json({ message: 'Failed to reopen job.', error: error.message });
    }
}
