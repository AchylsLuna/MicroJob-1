import { availableJobFilter } from '../lib/lifecyclePolicy.js';
import { normalizeWorkDates, baseWorkerPay, workdayCount } from '../lib/dailyWorkPolicy.js';
import { normalizeWorkTimes } from '../lib/workTime.js';
import { requestCancellation, syncCapacity } from '../services/jobLifecycle.js';
import { settleApplicationPayment, finalizeSettledJob } from '../services/applicationSettlement.js';
import { remainingJobFunds, requiredJobFunds, refundJobFunds } from '../services/jobFunds.js';
import { queueNotification, deliverQueuedNotification, deliverJobPaymentReceipts } from '../services/notificationOutbox.js';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import { getReviewSummaries } from '../lib/reviewSummary.js';
import {
    getJobPostingCosts,
    getMinimumJobPay,
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
        let filter = availableJobFilter();
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
        const jobs = await Job.find(availableJobFilter())
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
        const jobs = await Job.find({ ...availableJobFilter(), category: resolvedCategoryId })
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
        const id = resolvePublicId(resolvePublicId(req.params.id));
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
            }).select('status workStatus').lean();
            serializedJob.applicationStatus = application?.status || null;
            serializedJob.applicationWorkStatus = application?.workStatus || null;
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

        if (req.body.repostOf && !await Job.exists({ _id: resolvePublicId(req.body.repostOf), jobPoster: jobPosterId })) return res.status(403).json({ message: 'Original posting is unavailable.' });
        if (deadline && (!Number.isFinite(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now())) return res.status(400).json({ message: 'A future posting deadline is required.' });
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
        const minimumPay = getMinimumJobPay(normalizedJobType);
        if (salaryAmount < minimumPay) {
            return res.status(400).json({ message: `Minimum guaranteed pay must be at least PHP ${minimumPay} for this opportunity type.` });
        }
        let workDates = [];
        try { if (normalizedJobType === 'Recruiting') workDates = normalizeWorkDates(req.body.workDates); }
        catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
        const paymentMode = normalizedJobType === 'Recruiting' ? 'daily' : 'assignment';
        let workTime = { workStartTime: null, workEndTime: null };
        try { if (paymentMode === 'daily') workTime = normalizeWorkTimes(req.body.workStartTime, req.body.workEndTime); }
        catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
        if (!Number.isInteger(positions) || positions < 1) {
            return res.status(400).json({ message: 'positionsNeeded must be a positive whole number.' });
        }

        // Worker pay stays fully secured in escrow. Posting and highlight
        // charges are collected separately and are never refundable.
        const costs = getJobPostingCosts({
            payPerWorker: salaryAmount,
            workdays: paymentMode === 'daily' ? workDates.length : 1,
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
                const employerDraw = poster.role === 'both' ? Math.min(Number(poster.employerBalance || 0), costs.total) : costs.total;
                const escrowEmployer = Math.max(0, employerDraw - costs.postingFee - costs.highlightFee);
                const fundingSources = { EMPLOYER: Math.min(totalEscrow, escrowEmployer), WORKER: Number((totalEscrow - Math.min(totalEscrow, escrowEmployer)).toFixed(2)) };
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
                    interviewRequired: req.body.interviewRequired === true,
                    repostOf: req.body.repostOf ? resolvePublicId(req.body.repostOf) : null,
                    title,
                    description,
                    location,
                    salary: salaryAmount,
                    paymentMode,
                    workDates,
                    ...workTime,
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
                    meta: { fundingSources },
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
                await queueNotification(`new-job-fanout:${newJob._id}`, { fanoutJobId: String(newJob._id) }, session);
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

export async function changeJobStatus(req, res) {
    try {
        const userId = getRequesterId(req);
        const job = await Job.findById(resolvePublicId(req.params.id));
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        if (String(job.jobPoster) !== String(userId) && !(canManageAnyJob(req) && req.body?.status === 'Closed')) return res.status(403).json({ message: 'You cannot change this posting.' });
        const status = req.body?.status;
        if (status === 'Cancelled') return res.json({ cancellation: await requestCancellation({ ...req.body, jobId: job._id, actor: userId }) });
        if (status === 'Completed') {
            if (req.body?.confirmed !== true) return res.status(400).json({ message: 'Confirm the worker payments before completing this posting.' });
            const apps = await JobApplication.find({ job: job._id, status: { $in: ['Hired', 'Accepted'] } });
            if (!apps.length || apps.some((app) => !['Submitted', 'Completed'].includes(app.workStatus))) return res.status(409).json({ message: 'All hired workers must submit work first.' });
            // Each worker settles through the same idempotent service as direct/QR payment.
            const session = await mongoose.startSession();
            try { await session.withTransaction(async () => {
                const current = await Job.findById(job._id).session(session);
                if (!current || current.cancellationPending || current.archivedAt || ['Cancelled', 'Full refund', 'Resolved'].includes(current.status)) throw Object.assign(new Error('This posting cannot be completed now.'), { status: 409 });
                if (await JobOffer.exists({ job: job._id, status: { $in: ['pending', 'accepted'] } }).session(session)) throw Object.assign(new Error('Resolve active offers before completing this posting.'), { status: 409 });
                current.closedManually = true; current.fundsVersion = Number(current.fundsVersion || 0) + 1; await current.save({ session });
                for (const app of apps) await settleApplicationPayment({ applicationId: app._id, employerId: userId, session });
                await finalizeSettledJob(await Job.findById(job._id).session(session), userId, session);
            }); } finally { await session.endSession(); }
            await Promise.all(apps.flatMap((app) => [deliverQueuedNotification(`job-paid:${app._id}`), deliverJobPaymentReceipts(`application-payout:${app._id}`)]));
            return res.json({ job: await Job.findById(job._id), message: 'Submitted worker payments completed.' });
        }
        if (status === 'Available') return reopenJob(req, res);
        if (status !== 'Closed') return res.status(409).json({ message: 'Use the assignment workflow for this status.' });
        const session = await mongoose.startSession(); let updated;
        try { await session.withTransaction(async () => {
            updated = await Job.findOne({ _id: job._id, cancellationPending: { $ne: true }, status: { $nin: ['Completed', 'Cancelled', 'Full refund', 'Resolved'] } }).session(session);
            if (!updated) throw Object.assign(new Error('This posting is historical or being cancelled.'), { status: 409 });
            updated.closedManually = true; updated.fundsVersion = Number(updated.fundsVersion || 0) + 1;
            await syncCapacity(updated, session);
            await finalizeSettledJob(updated, userId, session);
        }); } finally { await session.endSession(); }
        return res.json({ job: serializeOwnedJob(updated), message: 'Job status updated.' });
    } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to change job status.' }); }
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
        const jobs = await Job.find({ jobPoster: userId })
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json(await Promise.all(jobs.map(async (job) => {
            const [funds, assignments] = await Promise.all([remainingJobFunds(job._id), JobApplication.find({ job: job._id, $or: [{ status: { $in: ['Hired', 'Accepted'] } }, { status: 'Cancelled', agreedAmount: { $gt: 0 } }] }).select('paymentStatus workStatus agreedAmount cancellationPending disputePending dailyPayments').lean()]);
            const held = assignments.some((app) => app.cancellationPending || app.disputePending);
            const status = held || job.cancellationPending ? 'On hold' : assignments.some((app) => app.paymentStatus === 'Processing') ? 'Processing' : assignments.some((app) => (app.workStatus === 'Submitted' || app.dailyPayments?.some((day) => day.submittedAt && !day.paidAt)) && app.paymentStatus !== 'Paid') ? 'Awaiting approval' : funds.paid > 0 ? assignments.length && assignments.every((app) => app.paymentStatus === 'Paid') ? 'Paid' : 'Partially paid' : funds.refunded > 0 && funds.remaining === 0 ? 'Refunded' : 'Funds secured';
            return { ...serializeOwnedJob(job.toObject()), canDelete: false, paymentSummary: { ...funds, status } };
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
    const session = await mongoose.startSession();
    try {
        const result = await session.withTransaction(() => updateJobInTransaction(req, session));
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Update job error:', error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to update this posting.' });
    } finally { await session.endSession(); }
}

export async function deleteJob(req, res) {
    const job = await Job.findById(resolvePublicId(req.params.id));
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    if (String(job.jobPoster) !== String(getRequesterId(req)) && !canManageAnyJob(req)) return res.status(403).json({ message: 'You cannot archive this posting.' });
    if (await JobApplication.exists({ job: job._id, status: { $in: ['Hired', 'Accepted'] }, workStatus: { $nin: ['Completed', 'Cancelled'] } })) return res.status(409).json({ code: 'JOB_HIRE_CONFIRMED', message: 'Resolve unfinished assignments before archiving this posting.' });
    if (!['Completed', 'Cancelled', 'Closed'].includes(job.status) || job.cancellationPending) return res.status(409).json({ message: 'Cancel or close this posting before archiving it.' });
    job.archivedAt = new Date(); await job.save();
    return res.json({ message: 'Job archived. Applications and financial history are preserved.', job });
}
export async function reopenJob(req, res) {
    const session = await mongoose.startSession(); let job;
    try {
        await session.withTransaction(async () => {
            job = await Job.findOne({ _id: resolvePublicId(req.params.id), jobPoster: getRequesterId(req) }).session(session);
            if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
            if (['Completed', 'Cancelled', 'Full refund', 'Resolved'].includes(job.status) || job.cancellationPending) throw Object.assign(new Error('Use Post again to preserve this posting history.'), { status: 409 });
            if (job.hiredCount + job.reservedOfferCount >= job.positionsNeeded) throw Object.assign(new Error('All positions are hired or reserved.'), { status: 409 });
            if ((await remainingJobFunds(job._id, session)).remaining < await requiredJobFunds(job, session)) throw Object.assign(new Error('This vacancy is no longer fully funded. Use Post again to fund a new posting.'), { status: 409 });
            if (new Date(job.deadline).getTime() <= Date.now()) throw Object.assign(new Error('This posting has expired. Use Post again with a new deadline.'), { status: 409 });
            job.closedManually = false; job.archivedAt = null; job.fundsVersion += 1; await syncCapacity(job, session);
        });
        return res.json({ message: 'Posting reopened. Existing applications are preserved.', job });
    } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to reopen this posting.' }); }
    finally { await session.endSession(); }
}

export async function selectApplicant(req, res) {
    return res.status(409).json({ message: 'Send a formal offer, wait for worker acceptance, then confirm the hire.' });
}

async function updateJobInTransaction(req, session) {
    const res = { status(code) { return { json(body) { return { status: code, body }; } }; } };
        const id = resolvePublicId(req.params.id);
        const userId = req.user?.id;

        const job = await Job.findById(id).session(session);
        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }

        if (job.jobPoster.toString() !== userId) {
            return res.status(403).json({ message: "You are not allowed to update this job." });
        }

        if (job.hireConfirmedAt || await JobApplication.exists({ job: job._id, $or: [{ hiredAt: { $ne: null } }, { 'timeline.type': 'hire_reverted' }] }).session(session)) return res.status(409).json({ message: 'A confirmed hire fixes this posting. Use Post again for different requirements.' });

        const allowed = [
            "title",
            "description",
            "location",
            "salary",
            "jobType",
            "workDates",
            "workStartTime",
            "workEndTime",
            "deadline",
            "skills",
            "responsibilities",
            "requirements",
            "category",
            "image",
            "interviewRequired",
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
                    value = resolveCategoryId(value);
                    if (!mongoose.Types.ObjectId.isValid(String(resolveCategoryId(value))) || !(await Category.exists({ _id: resolveCategoryId(value) }))) {
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

        if (updates.salary !== undefined && (job.hiredCount > 0 || job.reservedOfferCount > 0)) return res.status(409).json({ message: 'Existing offers and hires fix the job minimum pay.' });
        if (updates.salary !== undefined || updates.jobType !== undefined || updates.workDates !== undefined) {
            const minimumPay = getMinimumJobPay(updates.jobType ?? job.jobType);
            if (Number(updates.salary ?? job.salary) < minimumPay) {
                return res.status(400).json({ message: `Minimum guaranteed pay must be at least PHP ${minimumPay} for this opportunity type.` });
            }
        }
        const sameDates = Array.isArray(updates.workDates) && JSON.stringify([...updates.workDates].sort()) === JSON.stringify([...job.workDates].sort());
        if (sameDates) delete updates.workDates;
        if (updates.workDates !== undefined || (updates.jobType !== undefined && updates.jobType !== job.jobType)) {
            if (job.hiredCount > 0 || job.reservedOfferCount > 0) return res.status(409).json({ message: 'Existing offers and hires fix the work dates and payment schedule.' });
            const nextType = updates.jobType ?? job.jobType;
            try { updates.workDates = nextType === 'Recruiting' ? normalizeWorkDates(updates.workDates) : []; }
            catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
            updates.paymentMode = nextType === 'Recruiting' ? 'daily' : 'assignment';
        }
        const nextMode = updates.paymentMode ?? job.paymentMode;
        if (updates.workStartTime !== undefined || updates.workEndTime !== undefined || updates.paymentMode === 'daily') {
            if (nextMode !== 'daily') return res.status(400).json({ message: 'Daily work times require a long-term schedule.' });
            const start = updates.workStartTime ?? job.workStartTime;
            const end = updates.workEndTime ?? job.workEndTime;
            if ((start !== job.workStartTime || end !== job.workEndTime) && (job.hiredCount > 0 || job.reservedOfferCount > 0)) return res.status(409).json({ message: 'Existing offers and hires fix the work times.' });
            try { Object.assign(updates, normalizeWorkTimes(start, end)); }
            catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
        }
        if (updates.paymentMode === 'assignment') { updates.workStartTime = null; updates.workEndTime = null; }
        if (job.cancellationPending || ['Completed', 'Cancelled', 'Full refund', 'Resolved'].includes(job.status)) return res.status(409).json({ message: 'This posting is historical or being cancelled. Use Post again.' });
        const nextPositions = Number(updates.positionsNeeded ?? job.positionsNeeded ?? 1);
        if (nextPositions < Number(job.hiredCount || 0) + Number(job.reservedOfferCount || 0)) {
            return res.status(400).json({
                message: 'Workers needed cannot be lower than workers already hired plus positions reserved by active formal offers.',
            });
        }

        // Available, in-progress, and closed jobs still have funds secured in escrow.
        // Keep wallet and escrow totals aligned when minimum pay or worker count changes.
        const hasActiveEscrow = !['Completed', 'Cancelled', 'Full refund', 'Resolved'].includes(job.status);
        const currentEscrow = baseWorkerPay(job) * Number(job.positionsNeeded || 1);
        const nextSalary = Number(updates.salary ?? job.salary ?? 0);
        const nextEscrow = Number((nextSalary * workdayCount({ ...job.toObject(), ...updates }) * nextPositions).toFixed(2));
        const escrowDifference = hasActiveEscrow ? nextEscrow - currentEscrow : 0;

        if (escrowDifference !== 0) {
            const poster = await User.findById(job.jobPoster).session(session);
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

                const fundingSources = { EMPLOYER: Math.min(Number(poster.employerBalance || 0), escrowDifference), WORKER: Math.max(0, escrowDifference - Number(poster.employerBalance || 0)) };
                if (poster.role === 'both') {
                    const employerPortion = Math.min(Number(poster.employerBalance || 0), escrowDifference);
                    const workerPortion = escrowDifference - employerPortion;
                    poster.employerBalance = Number(poster.employerBalance || 0) - employerPortion;
                    poster.workerBalance = Number(poster.workerBalance || 0) - workerPortion;
                } else {
                    poster.employerBalance = Number(poster.employerBalance || 0) - escrowDifference;
                }
                await poster.save({ session });

                await Transaction.create([{
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
                    meta: { previousTotal: currentEscrow, updatedTotal: nextEscrow, fundingSources },
                }], { session });
            } else {
                const refundAmount = Math.abs(escrowDifference);
                if ((await remainingJobFunds(job._id, session)).remaining < refundAmount) return res.status(409).json({ message: 'Secured funds require reconciliation before this refund.' });
                await refundJobFunds({ job, amount: refundAmount, reference: `job-update-refund:${job._id}:${job.fundsVersion || 0}:${job.updatedAt.getTime()}`, actor: poster._id, session });
            }
        }

        const updated = await Job.findByIdAndUpdate(id, { $set: updates, $inc: { fundsVersion: 1 } }, { returnDocument: 'after', session })
            .populate('category', 'name')
            .populate('jobPoster', 'firstName lastName email');

        return res.status(200).json({ message: "Job updated successfully.", job: updated });
}
export async function repostJob(req, res) {
    const original = await Job.findOne({ _id: resolvePublicId(req.params.id), jobPoster: getRequesterId(req), status: { $in: ['Completed', 'Cancelled', 'Closed'] }, cancellationPending: { $ne: true } }).lean();
    if (!original) return res.status(404).json({ message: 'Historical posting not found.' });
    const deadline = new Date(req.body?.deadline);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) return res.status(400).json({ message: 'Choose a new future deadline.' });
    req.body = { ...original, ...(original.jobType === 'Recruiting' ? { workDates: req.body?.workDates, workStartTime: req.body?.workStartTime ?? original.workStartTime, workEndTime: req.body?.workEndTime ?? original.workEndTime } : {}), deadline, repostOf: original._id };
    return createJob(req, res);
}
