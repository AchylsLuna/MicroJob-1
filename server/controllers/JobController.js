import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import { createNotification } from '../lib/notificationService.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import { getReviewSummaries } from '../lib/reviewSummary.js';
import {
    getJobPostingCosts,
    isSupportedJobType,
    parseMinimumPay,
} from '../lib/jobPosting.js';
import { recordJobView } from '../lib/jobViews.js';
import { getEmployerProfileRequirementError } from '../lib/profileCompleteness.js';
import {
    APPLICANT_SELECT,
    getDiscoveryPriority,
    PUBLIC_JOB_POSTER_SELECT,
    proximityOf,
    resolveDiscoveryCity,
    sortByProximity,
    serializeApplicant,
    serializePublicJob,
    serializeOwnedJob,
} from '../lib/jobDiscovery.js';
import { resolveCategoryId } from '../lib/categoryPresentation.js';
import { resolvePublicId } from '../lib/publicId.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';

const getRequesterId = (req) => req.user?.id || req.user?.userId || null;
const getRequesterRole = (req) => String(req.user?.role || '').toLowerCase();
const canManageAnyJob = (req) => hasPermission(resolveStaffRole(req.user), 'jobs.manage');
const canPostJobsRole = (role) =>
    role === 'hire' ||
    role === 'both' ||
    role === 'employer' ||
    role === 'doctor';
const getDiscoveryCity = (req) => resolveDiscoveryCity({
    userId: getRequesterId(req),
    role: getRequesterRole(req),
    requestedCity: typeof req.query?.location === 'string'
        ? req.query.location === 'nationwide' ? '' : req.query.location
        : req.query?.city,
});

/** Attaches the proximity tag the client uses to group "nearest in your city". */
const withProximity = (jobs, locality, rankingOptions = {}) =>
    jobs.map((job) => ({
        ...serializePublicJob(job, { viewerId: rankingOptions.viewerId }),
        discoveryPriority: getDiscoveryPriority(job, rankingOptions),
        proximity: proximityOf(job, locality),
    }));

const withApplicationStatus = async (jobs, requesterId) => {
    if (!requesterId || !jobs.length) return jobs;
    const applications = await JobApplication.find({
        applicant: requesterId,
        job: { $in: jobs.map((job) => job._id) },
    }).select('job status').lean();
    const statusByJobId = new Map(applications.map((application) => [String(application.job), application.status]));
    return jobs.map((job) => ({
        ...job,
        applicationStatus: statusByJobId.get(String(job._id)) || null,
    }));
};


export async function getJobList(req, res) {
    try {
        const { category, jobType, search, excludeOwn, location } = req.query;
        const discovery = await getDiscoveryCity(req);

        // Discovery must not surface work that has already been completed or
        // closed to new applicants.
        // Keep this at the query boundary so every Find Jobs filter and sort
        // operates only on postings that a worker can still discover.
        let filter = { status: { $nin: ['Completed', 'Closed', 'Full refund', 'Resolved'] } };
        if (typeof location === 'string' && location.trim() && location !== 'nationwide') {
            const safeLocation = location.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.location = { $regex: safeLocation, $options: 'i' };
        }
        
        // Filter by category. The client sends the opaque public id, so it is
        // decoded here; an unresolvable one must not fall through to an
        // unfiltered list, which would silently show every job instead.
        if (category && category !== 'All') {
            const categoryId = resolveCategoryId(category);
            if (!categoryId) {
                return res.status(400).json({ message: 'Please select a valid job category.' });
            }
            filter.category = categoryId;
        }
        
        // Filter by job type
        if (jobType) {
            const types = jobType.split(',');
            filter.jobType = { $in: types };
        }

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
        
        // Rank the selected location, or the national feed when none is chosen.
        const jobs = await Job.find(filter)
            .populate('category', 'name')
            // Verification fields are used only for worker-feed ranking and
            // are removed by serializePublicJob before the response is sent.
            .populate('jobPoster', `${PUBLIC_JOB_POSTER_SELECT} verification`)
            .sort({ createdAt: -1 })
            .lean();
        const jobsWithApplicationStatus = await withApplicationStatus(jobs, getRequesterId(req));
        const prioritizeVerifiedEmployers = ['work', 'worker', 'both'].includes(getRequesterRole(req));
        res.status(200).json(withProximity(
            sortByProximity(jobsWithApplicationStatus, discovery, { prioritizeVerifiedEmployers }),
            discovery,
            { prioritizeVerifiedEmployers, viewerId: getRequesterId(req) },
        ));
    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({message: "Failed to get jobs.", error: error.message});
    }
}

export async function getAvailableJobs(req, res){
    try {
        const discovery = await getDiscoveryCity(req);
        const jobs = await Job.find({ status: 'Available' })
            .populate('category', 'name')
            .populate('jobPoster', PUBLIC_JOB_POSTER_SELECT)
            .lean();
        const jobsWithStatus = await withApplicationStatus(jobs, getRequesterId(req));
        res.status(200).json(withProximity(sortByProximity(jobsWithStatus, discovery), discovery, { viewerId: getRequesterId(req) }));
    } catch (error) {
        res.status(500).json({message: "Failed to get available jobs."})
    }
}
export async function getJobByCategory(req, res) {
    try {
        const {categoryId} = req.params;
        const resolvedCategoryId = resolveCategoryId(categoryId);
        if (!resolvedCategoryId) {
            return res.status(400).json({message: "Please select a valid job category."});
        }
        const discovery = await getDiscoveryCity(req);
        const jobs = await Job.find({ category: resolvedCategoryId })
            .populate('category', 'name')
            .populate('jobPoster', PUBLIC_JOB_POSTER_SELECT)
            .lean();
        if(!jobs || jobs.length === 0) {
            return res.status(404).json({message: "No jobs were found for this category."});
        }
        const jobsWithStatus = await withApplicationStatus(jobs, getRequesterId(req));
        res.status(200).json(withProximity(sortByProximity(jobsWithStatus, discovery), discovery, { viewerId: getRequesterId(req) }));
    } catch (error) {
        res.status(500).json({message: "Failed to get jobs."});
    }
}

export async function getJobDetails(req, res){
    try {
        const id = resolvePublicId(req.params.id);
        if (!id) return res.status(400).json({ message: 'A valid job id is required.' });
        const job = await Job.findById(id)
            .populate('category', 'name')
            .populate('jobPoster', `${PUBLIC_JOB_POSTER_SELECT} verification`);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        const serializedJob = serializePublicJob(job, { viewerId: getRequesterId(req) });
        if (getRequesterId(req)) {
            const application = await JobApplication.findOne({
                job: job._id,
                applicant: getRequesterId(req),
            }).select('status').lean();
            serializedJob.applicationStatus = application?.status || null;
        }
        // Fire and forget: a view is analytics, and must never delay or fail the
        // job detail response. recordJobView swallows its own errors.
        void recordJobView(job, {
            viewerId: req.user?.id || null,
            ip: req.ip || null,
            userAgent: req.get?.('user-agent') || null,
        });
        res.status(200).json(serializedJob);
    } catch (error) {
        console.error('Get job details error:', error);
        res.status(500).json({message: "Failed to get job details.", error: error.message});
    }
}

export async function getApplicantsList(req, res){
    try {
        const jobId = resolvePublicId(req.params.jobId);
        if (!jobId) return res.status(400).json({ message: 'A valid job id is required.' });
        const requesterId = getRequesterId(req);
        const job = await Job.findById(jobId)
            .populate('category', 'name')
            .populate('applicants', `${APPLICANT_SELECT} workExperience jobPreferences preferredCategories`);
        if(!job) {
            return res.status(404).json({message: "Job not found."});
        }
        if (String(job.jobPoster || '') !== String(requesterId || '') && !canManageAnyJob(req)) {
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
            positionsNeeded,
            highlighted,
        } = req.body;
        const requesterRole = getRequesterRole(req);
        const jobPosterId = getRequesterId(req);

        if (!jobPosterId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!canPostJobsRole(requesterRole)) {
            return res.status(403).json({ message: "Only employer accounts can create jobs." });
        }

        const employerProfile = await User.findById(jobPosterId).select('companyName avatarUrl');
        const profileError = getEmployerProfileRequirementError(employerProfile);
        if (profileError) {
            return res.status(profileError.status).json({
                message: profileError.message,
                code: profileError.code,
                missing: profileError.missing,
            });
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

        // The client submits the opaque public id, so decode before validating.
        // resolveCategoryId returns null for a malformed or foreign-key token,
        // which the ObjectId check below then rejects.
        const resolvedCategory = resolveCategoryId(category);
        if (!resolvedCategory || !mongoose.Types.ObjectId.isValid(String(resolvedCategory))) {
            return res.status(400).json({ message: 'Please select a valid job category.' });
        }
        const categoryExists = await Category.exists({ _id: resolvedCategory });
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

        // Worker pay stays fully secured in escrow. Posting and highlight
        // charges are collected separately and are never refundable.
        const costs = getJobPostingCosts({
            payPerWorker: salaryAmount,
            positionsNeeded: positions,
            highlighted: Boolean(highlighted),
        });
        const totalEscrow = costs.workerPay;

        // 1. Check if user has enough balance
        const poster = await User.findById(jobPosterId);
        if (!poster) return res.status(404).json({ message: 'Job poster not found.' });

        // For "both" role users, allow using combined balance; otherwise only use employer balance
        const availableBalance = poster.role === 'both'
            ? (poster.employerBalance || 0) + (poster.workerBalance || 0)
            : (poster.employerBalance || 0);

        // A cheap pre-check purely so the caller gets the itemised
        // INSUFFICIENT_BALANCE body below rather than a bare conflict. It is
        // *not* what protects the balance -- the conditional debit inside the
        // transaction is. Checking here and deducting later is precisely the
        // read-modify-write that allowed the double-spend described below.
        if (availableBalance < costs.total) {
            return res.status(400).json({
                code: 'INSUFFICIENT_BALANCE',
                message: 'You do not have enough balance to fund this job. Please top up your wallet and try again.',
                availableBalance,
                requiredBalance: costs.total,
                shortfall: Number((costs.total - availableBalance).toFixed(2)),
            });
        }

        // 2. Deduct the balance (move to escrow) and create the job atomically.
        //
        // This used to read the poster, compare `availableBalance` against the
        // cost, mutate `poster.employerBalance` in memory and `save()` -- a
        // textbook lost update. Concurrent POST /api/jobs calls all read the
        // same starting balance, all passed the check, and each wrote its own
        // computed result, so N jobs were created while the wallet was debited
        // once. Cancelling or deleting each job then refunded its escrow, for a
        // net gain of roughly (N-1) x workerPay per round, repeatable.
        //
        // The guarded `$inc` below is the fix: the balance condition lives in
        // the update filter, so only one of N racing requests can match and the
        // rest get a clean 409. Same shape as JobOfferController.createJobOffer.
        const session = await mongoose.startSession();
        let newJob;
        try {
            await session.withTransaction(async () => {
                // For "both" role users, draw from the employer balance first,
                // then the worker balance. Each leg carries its own `$gte`
                // guard so neither can be driven negative by a concurrent post.
                if (poster.role === 'both') {
                    const employerPortion = Math.min(poster.employerBalance || 0, costs.total);
                    const workerPortion = Number((costs.total - employerPortion).toFixed(2));
                    if (employerPortion > 0) {
                        const debit = await User.updateOne(
                            { _id: jobPosterId, employerBalance: { $gte: employerPortion } },
                            { $inc: { employerBalance: -employerPortion } },
                            { session },
                        );
                        if (!debit.modifiedCount) throw Object.assign(new Error('Your wallet balance changed before this job could be funded. Please try again.'), { status: 409, code: 'INSUFFICIENT_BALANCE' });
                    }
                    if (workerPortion > 0) {
                        const debit = await User.updateOne(
                            { _id: jobPosterId, workerBalance: { $gte: workerPortion } },
                            { $inc: { workerBalance: -workerPortion } },
                            { session },
                        );
                        if (!debit.modifiedCount) throw Object.assign(new Error('Your wallet balance changed before this job could be funded. Please try again.'), { status: 409, code: 'INSUFFICIENT_BALANCE' });
                    }
                } else {
                    const debit = await User.updateOne(
                        { _id: jobPosterId, employerBalance: { $gte: costs.total } },
                        { $inc: { employerBalance: -costs.total } },
                        { session },
                    );
                    if (!debit.modifiedCount) throw Object.assign(new Error('Your wallet balance changed before this job could be funded. Please try again.'), { status: 409, code: 'INSUFFICIENT_BALANCE' });
                }

                // 3. Create the job (funds are now effectively in "escrow")
                [newJob] = await Job.create([{
                    title,
                    description,
                    location,
                    salary: salaryAmount,
                    jobType: normalizedJobType,
                    deadline,
                    skills: skills || [],
                    responsibilities: responsibilities || [],
                    requirements: requirements || [],
                    // The decoded ObjectId, never the public token the client sent.
                    category: resolvedCategory,
                    image,
                    jobPoster: jobPosterId,
                    urgent: Boolean(urgent),
                    highlighted: Boolean(highlighted),
                    postingFee: costs.postingFee,
                    highlightFee: costs.highlightFee,
                    positionsNeeded: positions
                }], { session });

                // 4. Record the transaction in the ledger (ESCROW)
                await Transaction.create([{
                    sender: poster._id,
                    receiver: null, // Escrow
                    amount: totalEscrow,
                    type: 'ESCROW',
                    status: 'COMPLETED',
                    balanceTarget: 'ESCROW',
                    jobReference: newJob._id,
                    // References must be present and unique. Besides making the ledger
                    // auditable, this keeps posting working for databases that still
                    // have the legacy unique `reference` index (where multiple nulls
                    // would otherwise raise E11000 and turn a successful post into 500).
                    reference: `job-escrow:${newJob._id}`,
                    label: `Escrow (Job ${newJob._id})`,
                    relatedEntityType: 'job',
                    relatedEntityId: String(newJob._id),
                    actor: poster._id,
                }], { session });
                await Transaction.create([{
                    sender: poster._id,
                    receiver: null,
                    amount: costs.postingFee,
                    type: 'POSTING_FEE',
                    status: 'COMPLETED',
                    balanceTarget: 'EMPLOYER',
                    jobReference: newJob._id,
                    reference: `job-posting-fee:${newJob._id}`,
                    label: `Non-refundable posting fee (Job ${newJob._id})`,
                    relatedEntityType: 'job',
                    relatedEntityId: String(newJob._id),
                    meta: { refundable: false, feeKind: 'posting' },
                    actor: poster._id,
                }], { session });
                if (costs.highlightFee > 0) {
                    await Transaction.create([{
                        sender: poster._id,
                        receiver: null,
                        amount: costs.highlightFee,
                        type: 'POSTING_FEE',
                        status: 'COMPLETED',
                        balanceTarget: 'EMPLOYER',
                        jobReference: newJob._id,
                        reference: `job-highlight-fee:${newJob._id}`,
                        label: `Non-refundable highlight fee (Job ${newJob._id})`,
                        relatedEntityType: 'job',
                        relatedEntityId: String(newJob._id),
                        meta: { refundable: false, feeKind: 'highlight' },
                        actor: poster._id,
                    }], { session });
                }
            });
        } finally {
            await session.endSession();
        }

        // Audit and respond outside the transaction: neither should be able to
        // roll back a successfully funded job.
        try { const monitor = await import('../lib/monitor.js'); await monitor.default.audit({ actor: poster._id, action: 'job_escrow', ip: req.ip || null, userAgent: req.get('user-agent'), amount: totalEscrow, status: 'success', meta: { job: newJob._id } }); } catch (e) {}

        res.status(201).json({message: "Job created and funds secured.", job: serializeOwnedJob(newJob)});
    } catch (error) {
        // A guarded-debit miss is a concurrency conflict, not a server fault.
        if (error?.status) {
            return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
        }
        console.error('Create job error:', error);
        res.status(500).json({message: "Failed to create job.", error: error.message});
    }
}

export async function changeJobStatus(req, res){
    try {
        const id = resolvePublicId(req.params.id);
        if (!id) return res.status(400).json({ message: 'A valid job id is required.' });
        const {status} = req.body;
        const requesterId = getRequesterId(req);
        const statusOptions = ['Available', 'In Progress', 'Completed', 'Cancelled', 'Closed'];

        if(!statusOptions.includes(status)) {
            return res.status(400).json({message: "Invalid status value."});
        }
        const job = await Job.findById(id);
        if(!job) return res.status(404).json({message: "Job not found."});
        if (job.jobPoster?.toString() !== requesterId && !canManageAnyJob(req)) {
            return res.status(403).json({ message: "You are not allowed to update this job status." });
        }

        if (['Full refund', 'Resolved'].includes(job.status)) {
            return res.status(409).json({ message: 'This job has a final Finance settlement. Its status is managed through financial disputes.' });
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
                    // Pay in full, or refuse and change nothing.
                    //
                    // This was `Math.min(owed, remainingEscrow)`, which credited
                    // a partial amount and *still* flipped the application to
                    // paymentStatus 'Paid' / workStatus 'Completed'. After that
                    // settleApplicationPayment short-circuits on 'Paid' and
                    // canUnhireApplication refuses with "already been paid", so
                    // the shortfall was unrecoverable through every API path.
                    // The old `break` also silently skipped every remaining
                    // candidate -- and because the leftover-escrow refund below
                    // pays `remainingEscrow` back to the employer, a skipped
                    // worker's money went to the employer instead.
                    //
                    // Aborting keeps escrow and the Hired state intact so the
                    // worker stays payable once funding is topped up, matching
                    // services/applicationSettlement.js's 409 on the same
                    // condition. The 0.005 tolerance absorbs the toFixed(2)
                    // rounding that `remainingEscrow` carries.
                    const owed = Number(candidate.agreedAmount || job.salary || 0);
                    if (owed <= 0) continue;
                    if (owed - remainingEscrow > 0.005) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(409).json({
                            message: 'The secured job funds are insufficient to pay every hired worker in full. Top up this job\'s funding before marking it done.',
                        });
                    }
                    const payoutAmount = owed;

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
                    if (candidate.applicationId) await JobApplication.updateOne({ _id: candidate.applicationId }, { $set: { workStatus: 'Completed', paymentStatus: 'Paid', completedAt: new Date(), paidAt: new Date(), paymentReminderClaimedAt: null, paymentReminderClaimedStage: null } }, { session });

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
                    // Always refund to employer balance since escrow is job-posting related.
                    //
                    // This refund used to carry no `reference` at all and ran a
                    // read-modify-write on the balance outside any transaction.
                    // Transaction's uniqueness guard is a *partial* index
                    // (`partialFilterExpression: { reference: { $type: 'string' } }`,
                    // see models/Transaction.js), so a null reference is excluded
                    // from the index entirely and unlimited duplicates were
                    // allowed -- two concurrent cancels could both refund, and
                    // even when they did not race they left two REFUND rows
                    // against one credit, which then corrupted the escrow maths
                    // in deleteJob and reopenJob.
                    //
                    // Ordering matters: the uniquely-referenced ledger row is
                    // written *before* the balance moves, so a duplicate loses
                    // on the index and never reaches the `$inc`. Same shape as
                    // deleteJob's refund below.
                    const reference = `job-cancel-refund:${job._id}`;
                    try {
                        await Transaction.create({
                            sender: null,
                            receiver: poster._id,
                            amount: refundAmount,
                            type: 'REFUND',
                            status: 'COMPLETED',
                            balanceTarget: 'EMPLOYER',
                            jobReference: job._id,
                            reference,
                            label: `Refund (Job ${job._id})`,
                            relatedEntityType: 'job',
                            relatedEntityId: String(job._id),
                            actor: poster._id,
                        });
                    } catch (refundError) {
                        // E11000 means another request already recorded this
                        // job's cancellation refund; the credit below is its
                        // responsibility, not ours.
                        if (refundError?.code === 11000) {
                            return res.status(409).json({ message: 'This job has already been cancelled and refunded.' });
                        }
                        throw refundError;
                    }
                    await User.updateOne({ _id: poster._id }, { $inc: { employerBalance: refundAmount } });
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

        res.status(200).json({message: "Job status updated.", job: serializeOwnedJob(job)});
    } catch (error) {
        res.status(500).json({message: "Failed to change job status."});
    }
}

// `selectApplicant` lived here and was deleted rather than repaired.
//
// PATCH /api/jobs/:jobId/select/:applicantId wrote JobApplication.status =
// 'Hired' and job.status = 'In Progress' directly, with no escrow reservation,
// no `agreedAmount`, and no hiredCount/reservedOfferCount increment -- breaking
// the invariant documented in lib/hiringState.js, which is exactly why 'Hired'
// is excluded from EMPLOYER_MUTABLE_STATUSES. Because hiredCount stayed 0,
// createJobOffer still saw a free slot and the same position could be filled
// twice; the second worker's payout then computed to 0 and was skipped, so a
// worker who finished the job was never paid and never marked unpaid. And with
// `agreedAmount` null, changeJobStatus treated the hire as having no lifecycle
// and skipped the "must submit finished work" check, paying job.salary for
// nothing.
//
// No client ever called it (verified across client/src, Mobile, tests and
// scripts). Hiring goes through the offer flow in JobOfferController, which
// reserves capacity and escrow transactionally.

export async function getMyJobs(req, res) {
    try {
        const userId = req.user.id;
        // The owner response keeps hiring fields but uses the same public job id.
        const jobs = await Job.find({ jobPoster: userId, status: { $ne: 'Full refund' } })
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .lean();
        const hiredJobs = await JobApplication.distinct('job', {
            job: { $in: jobs.map((job) => job._id) },
            $or: [{ status: { $in: ['Hired', 'Accepted'] } }, { hiredAt: { $ne: null } }, { 'timeline.type': 'hire_reverted' }],
        });
        const locked = new Set(hiredJobs.map(String));
        res.status(200).json(jobs.map((job) => ({
            ...serializeOwnedJob(job),
            canDelete: !job.hireConfirmedAt && !job.selectedApplicant && !job.hiredCount && job.status !== 'In Progress' && !locked.has(String(job._id)),
        })));
    } catch (error) {
        console.error('Get my jobs error:', error);
        res.status(500).json({ message: 'Failed to get my jobs.', error: error.message });
    }
}

// Owner-scoped history. Fees are excluded; held funds are escrow less payouts
// and refunds, including negotiated offers and dispute settlements.
export async function getEmployerJobHistory(req, res) {
    try {
        const jobs = await Job.find({ jobPoster: getRequesterId(req) }).populate('category', 'name').sort({ createdAt: -1 }).lean();
        const totals = await Transaction.aggregate([
            { $match: { jobReference: { $in: jobs.map((job) => job._id) }, status: 'COMPLETED', type: { $in: ['ESCROW', 'PAYOUT', 'REFUND'] } } },
            { $group: {
                _id: '$jobReference',
                escrowed: { $sum: { $cond: [{ $eq: ['$type', 'ESCROW'] }, '$amount', 0] } },
                paid: { $sum: { $cond: [{ $eq: ['$type', 'PAYOUT'] }, '$amount', 0] } },
                refunded: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$amount', 0] } },
            } },
        ]);
        const byJob = new Map(totals.map((row) => [String(row._id), row]));
        return res.json(jobs.map((job) => {
            const ledger = byJob.get(String(job._id));
            return { ...serializeOwnedJob(job), amountHeld: Math.max(0, Number(((ledger?.escrowed || 0) - (ledger?.paid || 0) - (ledger?.refunded || 0)).toFixed(2))), amountPaid: Number((ledger?.paid || 0).toFixed(2)) };
        }));
    } catch (error) {
        console.error('Get employer job history error:', error);
        return res.status(500).json({ message: 'Failed to load job history.' });
    }
}

export async function updateJob(req, res) {
    try {
        const id = resolvePublicId(req.params.id);
        if (!id) return res.status(400).json({ message: 'A valid job id is required.' });
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
                    // Decode the public token and write the real ObjectId back
                    // onto `value`, which is what gets persisted below.
                    const resolved = resolveCategoryId(value);
                    if (!resolved || !mongoose.Types.ObjectId.isValid(String(resolved)) || !(await Category.exists({ _id: resolved }))) {
                        return res.status(400).json({ message: "Please select a valid job category." });
                    }
                    value = resolved;
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

        // Minimum pay may not be cut below what has already been promised.
        //
        // `positionsNeeded` is guarded just above, but `salary` was not -- and
        // `escrowDifference` below is driven by salary x positions, so a
        // negative difference refunded straight to `employerBalance`. That let
        // an employer hire a worker at PHP 1000, wait for the work to be
        // submitted, then PUT `{ "salary": 1 }` and withdraw 999. Afterwards
        // settleApplicationPayment computed remaining = 1000 - 0 - 999 = 1,
        // which is less than the pinned `agreedAmount`, and threw 409 "The
        // secured job funds are insufficient for this payment" -- so the worker
        // had completed the job and was permanently unpayable through any API
        // path while the employer kept the money. `hasActiveEscrow` also
        // allowed this on `Closed` (fully-hired) jobs, which this covers too.
        const committedPositions = Number(job.hiredCount || 0) + Number(job.reservedOfferCount || 0);
        if (committedPositions > 0 && Number(updates.salary ?? job.salary ?? 0) < Number(job.salary || 0)) {
            return res.status(400).json({
                message: 'Minimum guaranteed pay cannot be reduced while workers are already hired or reserved by active formal offers.',
            });
        }

        // Available, in-progress, and closed jobs still have funds secured in escrow.
        // Keep wallet and escrow totals aligned when minimum pay or worker count changes.
        const hasActiveEscrow = !['Completed', 'Cancelled', 'Full refund', 'Resolved'].includes(job.status);
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
            .populate('jobPoster', 'firstName lastName email')
            .lean();

        return res.status(200).json({ message: "Job updated successfully.", job: serializeOwnedJob(updated) });
    } catch (error) {
        console.error('Update job error:', error);
        return res.status(500).json({ message: "Failed to update job.", error: error.message });
    }
}

export async function deleteJob(req, res) {
    const id = resolvePublicId(req.params.id);
    if (!id) return res.status(400).json({ message: 'A valid job id is required.' });
    const userId = getRequesterId(req);
    const admin = canManageAnyJob(req);
    const session = await mongoose.startSession();
    try {
        let deletedJob;
        let refundAmount = 0;
        await session.withTransaction(async () => {
            const job = await Job.findById(id).session(session);
            if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
            if (String(job.jobPoster || '') !== String(userId || '') && !admin) {
                throw Object.assign(new Error('You are not allowed to delete this job.'), { status: 403 });
            }
            const priorHire = await JobApplication.exists({
                job: job._id,
                $or: [{ status: { $in: ['Hired', 'Accepted'] } }, { hiredAt: { $ne: null } }, { 'timeline.type': 'hire_reverted' }],
            }).session(session);
            if (!admin && (job.status === 'In Progress' || job.hireConfirmedAt || job.selectedApplicant || Number(job.hiredCount || 0) > 0 || priorHire)) {
                throw Object.assign(new Error('Cannot delete the job after confirming the hire.'), { status: 409, code: 'JOB_HIRE_CONFIRMED' });
            }

            // Deleting and hiring both write this job inside a transaction. A
            // concurrent hire forces a retry, which rechecks the deletion lock
            // before any escrow refund or dependent record is removed.
            await Job.deleteOne({ _id: job._id }, { session });
            const [ledger] = await Transaction.aggregate([
                { $match: { jobReference: job._id, status: 'COMPLETED' } },
                { $group: {
                    _id: null,
                    escrowed: { $sum: { $cond: [{ $eq: ['$type', 'ESCROW'] }, '$amount', 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$type', 'PAYOUT'] }, '$amount', 0] } },
                    refunded: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$amount', 0] } },
                } },
            ]).session(session);
            // Keep the existing fallback for jobs predating the ledger.
            const secured = Number(ledger?.escrowed || 0) || Number(job.salary || 0) * Number(job.positionsNeeded || 1);
            refundAmount = Math.max(0, Number((secured - Number(ledger?.paid || 0) - Number(ledger?.refunded || 0)).toFixed(2)));
            if (refundAmount > 0) {
                const poster = await User.findById(job.jobPoster).session(session);
                if (!poster) throw Object.assign(new Error('This job cannot be deleted because its employer account is unavailable for the escrow refund.'), { status: 409, code: 'JOB_POSTER_UNAVAILABLE' });
                await Transaction.create([{
                    sender: null, receiver: poster._id, amount: refundAmount,
                    type: 'REFUND', status: 'COMPLETED', balanceTarget: 'EMPLOYER',
                    jobReference: job._id, reference: `job-delete-refund:${job._id}`,
                    label: 'Unused escrow refund on job deletion', relatedEntityType: 'job',
                    relatedEntityId: String(job._id), actor: userId || poster._id,
                }], { session });
                await User.updateOne({ _id: poster._id }, { $inc: { employerBalance: refundAmount } }, { session });
            }
            await JobOffer.deleteMany({ job: job._id }, { session });
            await JobApplication.deleteMany({ job: job._id }, { session });
            deletedJob = job;
        });
        if (refundAmount > 0) {
            try {
                const monitor = await import('../lib/monitor.js');
                await monitor.default.audit({ actor: userId || null, action: 'job_refund_on_delete', ip: req.ip || null, userAgent: req.get?.('user-agent') || null, amount: refundAmount, status: 'success', meta: { job: deletedJob._id, employer: deletedJob.jobPoster } });
            } catch (_) {}
        }
        return res.status(200).json({ message: 'Job deleted successfully.' });
    } catch (error) {
        if (!error.status) console.error('Delete job error:', error);
        return res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to delete job.', ...(error.code ? { code: error.code } : {}) });
    } finally {
        await session.endSession();
    }
}
export async function reopenJob(req, res) {
    try {
        const id = resolvePublicId(req.params.id);
        if (!id) return res.status(400).json({ message: 'A valid job id is required.' });
        const userId = req.user?.id;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.jobPoster.toString() !== userId && !canManageAnyJob(req)) {
            return res.status(403).json({ message: 'You are not allowed to reopen this job.' });
        }

        if (['Full refund', 'Resolved'].includes(job.status)) {
            return res.status(409).json({ message: 'A job with a final Finance settlement cannot be reopened.' });
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

        return res.status(200).json({ message: 'Job reopened successfully.', job: serializeOwnedJob(job) });
    } catch (error) {
        console.error('Reopen job error:', error);
        return res.status(500).json({ message: 'Failed to reopen job.', error: error.message });
    }
}
