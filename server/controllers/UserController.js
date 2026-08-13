import User from "../models/User.js";
import JobApplication from "../models/JobApplication.js";
import Job from "../models/Job.js";
import Session from "../models/Session.js";
import PayoutRequest from "../models/PayoutRequest.js";
import PushDevice from "../models/PushDevice.js";
import SavedJob from "../models/SavedJob.js";
import Notification from "../models/Notification.js";
import { getEmailTransporter } from "../lib/emailTransporter.js";
import { disconnectSession } from "../lib/socket.js";
import { deleteStoredUpload } from "../lib/uploadStore.js";
import {
    EMAIL_VALIDATION_MESSAGE,
    NAME_VALIDATION_MESSAGE,
    PHONE_VALIDATION_MESSAGE,
    isValidEmail,
    isValidName,
    isValidPhone,
    normalizeEmail,
    normalizeName,
    normalizePhone,
} from "../lib/authValidation.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";
import { clearPhoneVerificationOtp } from "../lib/phoneOtp.js";
import { getAdminUserCreationError, getAdminUserMutationError } from "../lib/adminUserPolicy.js";
import { getReviewSummary } from "../lib/reviewSummary.js";
import { buildAuthTokensPayload, createSessionWithTokens, setSessionCookies } from "../lib/authSession.js";
import crypto from "node:crypto";
import { clearOtpChallenges, issueOtpChallenge, verifyOtpChallenge } from "../lib/otpChallenges.js";
import monitor from "../lib/monitor.js";

const OTP_GENERIC_MESSAGE = "If the account exists, an OTP has been sent.";
const PASSWORD_RESET_GENERIC_MESSAGE = "If the email is registered, a reset code has been sent.";

const TERMINAL_APPLICATION_STATUSES = ["Rejected", "Withdrawn", "Hired"];
async function removeStoredUploads(values) {
    const names = [...new Set(
        values
            .filter(Boolean)
            .map((value) => String(value).replace(/\\/g, "/").split("/").pop())
            .filter(Boolean)
    )];

    await Promise.all(names.map(async (name) => {
        try {
            await deleteStoredUpload(name);
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.warn(`Failed to remove stored upload ${name}:`, error?.message || error);
            }
        }
    }));
}

async function revokeSessions(userId, exceptSessionId) {
    const query = { user: userId, active: true };
    if (exceptSessionId) query._id = { $ne: exceptSessionId };
    const sessions = await Session.find(query).select("_id");
    const sessionIds = sessions.map((session) => String(session._id));
    if (sessionIds.length) {
        await Session.updateMany(
            { _id: { $in: sessionIds } },
            { $set: { active: false, endedAt: new Date() } }
        );
        sessionIds.forEach((sessionId) => disconnectSession(sessionId));
    }
}

async function getDeletionBlockers(userId) {
    const user = await User.findById(userId).select("workerBalance employerBalance");
    if (!user) {
        return [{ code: "user_not_found", message: "User not found.", count: 1 }];
    }

    const [pendingPayouts, openJobs, applicantApplications, employerApplications] = await Promise.all([
        PayoutRequest.countDocuments({ user: userId, status: { $in: ["requested", "approved"] } }),
        Job.countDocuments({ jobPoster: userId, status: { $nin: ["Completed", "Cancelled"] } }),
        JobApplication.countDocuments({ applicant: userId, status: { $nin: TERMINAL_APPLICATION_STATUSES } }),
        JobApplication.countDocuments({
            status: { $nin: TERMINAL_APPLICATION_STATUSES },
            job: {
                $in: await Job.find({ jobPoster: userId }).distinct("_id"),
            },
        }),
    ]);

    const blockers = [];
    if ((user.workerBalance || 0) > 0) {
        blockers.push({
            code: "worker_balance",
            message: "Withdraw or use your remaining worker balance before deleting the account.",
            count: Number(user.workerBalance || 0),
        });
    }
    if ((user.employerBalance || 0) > 0) {
        blockers.push({
            code: "employer_balance",
            message: "Use or refund your remaining employer balance before deleting the account.",
            count: Number(user.employerBalance || 0),
        });
    }
    if (pendingPayouts > 0) {
        blockers.push({
            code: "pending_payouts",
            message: "Pending payout requests must be completed or cancelled first.",
            count: pendingPayouts,
        });
    }
    if (openJobs > 0) {
        blockers.push({
            code: "open_jobs",
            message: "Close or complete all active jobs before deleting the account.",
            count: openJobs,
        });
    }
    if (applicantApplications > 0) {
        blockers.push({
            code: "active_applications",
            message: "Withdraw or resolve your active applications before deleting the account.",
            count: applicantApplications,
        });
    }
    if (employerApplications > 0) {
        blockers.push({
            code: "active_hiring",
            message: "Resolve your active hiring pipeline before deleting the account.",
            count: employerApplications,
        });
    }

    return blockers;
}

export async function anonymizeAndDeleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
        return null;
    }

    const deletionStamp = new Date();
    const storedUploads = [
        user.avatarUrl,
        user.resumeFileName,
        user.resumeUrl,
        user.verification?.identityDocument?.documentUrl,
        user.verification?.addressDocument?.documentUrl,
    ];
    const suffix = `${String(user._id)}-${Date.now()}`;
    const originalEmailKey = String(user.email || "").toLowerCase().trim();
    user.status = "deleted";
    user.deletedAt = deletionStamp;
    user.redactedAt = deletionStamp;
    user.firstName = "Deleted";
    user.lastName = "User";
    user.email = `deleted+${suffix}@microjobs.invalid`;
    user.phoneNumber = undefined;
    user.username = `deleted_${String(user._id).slice(-12)}`;
    user.city = undefined;
    user.province = undefined;
    user.barangay = undefined;
    user.addressType = undefined;
    user.address = undefined;
    user.facebook = undefined;
    user.profilePhotoName = undefined;
    user.jobPosition = undefined;
    user.companyName = undefined;
    user.startDate = undefined;
    user.endDate = undefined;
    user.logoName = undefined;
    user.resumeFileName = undefined;
    user.resumeUrl = undefined;
    user.avatarUrl = undefined;
    user.about = undefined;
    user.linkedin = undefined;
    user.website = undefined;
    user.totalExperience = undefined;
    user.skills = [];
    user.workExperience = [];
    user.verification = {
        emailVerified: false,
        phoneVerified: false,
        identityVerified: false,
        addressVerified: false,
        identityDocument: { status: "pending" },
        addressDocument: { status: "pending" },
    };
    user.workerBalance = 0;
    user.employerBalance = 0;
    await user.save();

    await Promise.all([
        Session.updateMany({ user: userId, active: true }, { $set: { active: false, endedAt: deletionStamp } }),
        PushDevice.deleteMany({ user: userId }),
        SavedJob.deleteMany({ user: userId }),
        Notification.deleteMany({ user: userId }),
    ]);
    await removeStoredUploads(storedUploads);

    await clearPhoneVerificationOtp(String(userId));
    await clearOtpChallenges(originalEmailKey);

    return user;
}

const PUBLIC_USER_SELECT = "-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes";
const STANDARD_ROLES = new Set(["work", "hire", "both"]);
const PRIVILEGED_ROLES = new Set(["admin", "superadmin"]);
const EDITABLE_STATUSES = new Set(["active", "pending", "disabled"]);

const getActorId = (req) => String(req.user?.id || req.user?.userId || "");
const isSuperAdmin = (req) => req.user?.role === "superadmin";

async function assertPrivilegedMutationAllowed(req, target, nextRole) {
    const actorId = getActorId(req);
    const privilegedMutation = PRIVILEGED_ROLES.has(target?.role) || PRIVILEGED_ROLES.has(nextRole);
    if (privilegedMutation && !isSuperAdmin(req)) {
        return { status: 403, message: "Only a superadmin can manage privileged accounts." };
    }
    if (actorId && actorId === String(target?._id) && nextRole && nextRole !== target.role) {
        return { status: 403, message: "You cannot change your own role." };
    }
    return null;
}

async function wouldDisableLastSuperAdmin(target, nextRole, nextStatus) {
    if (target.role !== "superadmin") return false;
    if (nextRole === "superadmin" && nextStatus === "active") return false;
    const activeSuperadmins = await User.countDocuments({ role: "superadmin", status: "active" });
    return activeSuperadmins <= 1 && target.status === "active";
}

export async function createUserByAdmin(req, res) {
    try {
        const allowedKeys = new Set(["firstName", "lastName", "email", "password", "role"]);
        const suppliedKeys = Object.keys(req.body || {});
        if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.has(key))) {
            return res.status(400).json({ message: "First name, last name, email, temporary password, and role are required." });
        }

        const firstName = normalizeName(req.body.firstName);
        const lastName = normalizeName(req.body.lastName);
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");
        const role = String(req.body.role || "").toLowerCase();

        if (!isValidName(firstName) || !isValidName(lastName)) {
            return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: EMAIL_VALIDATION_MESSAGE });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }
        if (!["work", "hire", "admin"].includes(role)) {
            return res.status(400).json({ message: "Role must be worker, employer, or admin." });
        }
        const forbidden = getAdminUserCreationError({ actorRole: req.user?.role, newRole: role });
        if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });
        if (await User.exists({ email })) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const user = new User({
            firstName,
            lastName,
            email,
            role,
            status: "active",
            passwordChangeRequired: true,
            verification: { emailVerified: true },
        });
        await user.setPassword(password);
        await user.save();
        return res.status(201).json({
            message: "Account created. The user must change the temporary password at first sign-in.",
            user: await User.findById(user._id).select(PUBLIC_USER_SELECT),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Email is already registered." });
        }
        console.error("Admin create user error:", error);
        return res.status(500).json({ message: "Failed to create account." });
    }
}

export async function updateUserByAdmin(req, res) {
    try {
        const target = await User.findById(req.params.userId);
        if (!target) return res.status(404).json({ message: "User not found." });
        const allowedKeys = new Set(["firstName", "lastName", "role", "status"]);
        const suppliedKeys = Object.keys(req.body || {});
        if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.has(key))) {
            return res.status(400).json({ message: "Only firstName, lastName, role, and status may be edited." });
        }
        const nextRole = req.body.role === undefined ? target.role : String(req.body.role).toLowerCase();
        const nextStatus = req.body.status === undefined ? target.status : String(req.body.status).toLowerCase();
        if (!STANDARD_ROLES.has(nextRole) && !PRIVILEGED_ROLES.has(nextRole)) {
            return res.status(400).json({ message: "Invalid role value." });
        }
        if (!EDITABLE_STATUSES.has(nextStatus)) return res.status(400).json({ message: "Invalid status value." });
        const activeSuperadminCount = target.role === "superadmin" ? await User.countDocuments({ role: "superadmin", status: "active" }) : 0;
        const forbidden = getAdminUserMutationError({ actorRole: req.user?.role, actorId: getActorId(req), targetId: String(target._id), targetRole: target.role, nextRole, nextStatus, activeSuperadminCount });
        if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });
        if (req.body.firstName !== undefined) {
            const value = normalizeName(req.body.firstName);
            if (!isValidName(value)) return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
            target.firstName = value;
        }
        if (req.body.lastName !== undefined) {
            const value = normalizeName(req.body.lastName);
            if (!isValidName(value)) return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
            target.lastName = value;
        }
        target.role = nextRole;
        target.status = nextStatus;
        await target.save();
        return res.status(200).json({ message: "User updated.", user: await User.findById(target._id).select(PUBLIC_USER_SELECT) });
    } catch (error) {
        console.error("Admin update user error:", error);
        return res.status(500).json({ message: "Failed to update user." });
    }
}

export async function changeInitialPassword(req, res) {
    try {
        const userId = getActorId(req);
        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");
        const user = await User.findById(userId).select("+passwordHashed passwordChangeRequired");
        if (!user) return res.status(404).json({ message: "User not found." });
        if (!user.passwordChangeRequired) return res.status(409).json({ message: "An initial password change is not required." });
        if (!(await user.validatePassword(currentPassword))) return res.status(400).json({ message: "Temporary password is incorrect." });
        if (!isStrongPassword(newPassword)) return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        if (await user.validatePassword(newPassword)) return res.status(400).json({ message: "Choose a password different from the temporary password." });
        await user.setPassword(newPassword);
        user.passwordChangeRequired = false;
        await user.save();
        const currentSessionId = String(req.user?.sessionId || "");
        await Session.updateMany(
            { user: user._id, active: true, ...(currentSessionId ? { _id: { $ne: currentSessionId } } : {}) },
            { $set: { active: false, endedAt: new Date() } },
        );
        return res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
        console.error("Initial password change error:", error);
        return res.status(500).json({ message: "Failed to change password." });
    }
}

export async function getUserList(req, res) {
    try {
        const users = await User.find({}).select(
            "-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes"
        );
        res.status(200).json(users);
    } catch {
        res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function getPrivilegedUsers(req, res) {
    try {
        const users = await User.find({ role: { $in: ["admin", "superadmin"] } }).select(
            "-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes"
        );
        res.status(200).json(users);
    } catch {
        res.status(500).json({ message: "Failed to retrieve admin users." });
    }
}

export async function updateUserStatus(req, res) {
    try {
        const { userId } = req.params;
        const { status } = req.body || {};
        const allowedStatus = ["active", "pending", "disabled"];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({ message: "Invalid status value." });
        }

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }
        const forbidden = await assertPrivilegedMutationAllowed(req, target, target.role);
        if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });
        if (getActorId(req) === String(target._id) && status !== "active") {
            return res.status(403).json({ message: "You cannot disable your own account." });
        }
        if (await wouldDisableLastSuperAdmin(target, target.role, status)) {
            return res.status(409).json({ message: "The last active superadmin cannot be disabled." });
        }
        target.status = status;
        await target.save();
        const updated = await User.findById(target._id).select(PUBLIC_USER_SELECT);
        return res.status(200).json({ message: "User status updated.", user: updated });
    } catch (error) {
        console.error("Update user status error:", error);
        return res.status(500).json({ message: "Failed to update user status." });
    }
}

export async function deleteUser(req, res) {
    try {
        const { userId } = req.params;
        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }
        if (getActorId(req) === String(target._id)) {
            return res.status(403).json({ message: "You cannot delete your own account." });
        }
        const forbidden = await assertPrivilegedMutationAllowed(req, target, target.role);
        if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });
        if (await wouldDisableLastSuperAdmin(target, target.role, "deleted")) {
            return res.status(409).json({ message: "The last active superadmin cannot be deleted." });
        }
        const blockers = await getDeletionBlockers(userId);
        if (blockers.length > 0) {
            return res.status(400).json({ message: "User cannot be deleted until blockers are resolved.", blockers });
        }

        const deleted = await anonymizeAndDeleteUser(userId);
        return res.status(200).json({ message: "User deleted successfully.", user: deleted });
    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ message: "Failed to delete user." });
    }
}

function normalizeProfileUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        const isLocalHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        if (parsed.protocol !== "https:" && !isLocalHttp) return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

const PROFILE_STRING_LIMITS = {
    firstName: 30,
    lastName: 30,
    city: 100,
    province: 100,
    barangay: 100,
    addressType: 10,
    address: 300,
    phoneNumber: 32,
    facebook: 300,
    profilePhotoName: 255,
    jobPosition: 100,
    companyName: 120,
    startDate: 40,
    endDate: 40,
    logoName: 255,
    about: 2000,
    linkedin: 300,
    website: 300,
    totalExperience: 50,
};

export async function updateProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const existingUser = await User.findById(userId).select(
            "phoneNumber role city province barangay verification.phoneVerified"
        );
        if (!existingUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const requestBody = req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? req.body
            : null;
        if (!requestBody) {
            return res.status(400).json({ message: "Profile update must be a JSON object." });
        }

        if (Object.prototype.hasOwnProperty.call(requestBody, "email")) {
            return res.status(400).json({
                message: "Email cannot be changed from profile settings. A verified email-change flow is required.",
            });
        }

        const allowed = [
            "firstName",
            "lastName",
            "city",
            "province",
            "barangay",
            "addressType",
            "address",
            "phoneNumber",
            "facebook",
            "jobPosition",
            "companyName",
            "startDate",
            "endDate",
            "about",
            "linkedin",
            "website",
            "totalExperience",
            "hideHiredCandidates",
            // Note: projectsCompleted, jobsApplied, and successRate are auto-calculated
        ];
        const allowedSet = new Set(allowed);
        const unsupportedFields = Object.keys(requestBody).filter((key) => !allowedSet.has(key) && key !== "email");
        if (unsupportedFields.length) {
            return res.status(400).json({ message: `Unsupported profile field: ${unsupportedFields[0]}.` });
        }
        if (!Object.keys(requestBody).some((key) => allowedSet.has(key))) {
            return res.status(400).json({ message: "No supported profile fields were provided." });
        }

        const updates = {};
        const unset = {};
        for (const key of allowed) {
            if (requestBody[key] !== undefined) {
                if (key !== "hideHiredCandidates" && typeof requestBody[key] !== "string") {
                    return res.status(400).json({ message: `${key} must be a string.` });
                }
                const value = typeof requestBody[key] === "string"
                    ? requestBody[key].trim()
                    : requestBody[key];
                const maxLength = PROFILE_STRING_LIMITS[key];
                if (typeof value === "string" && maxLength && value.length > maxLength) {
                    return res.status(400).json({ message: `${key} must be ${maxLength} characters or fewer.` });
                }
                if (value === "") {
                    if (key === "firstName" || key === "lastName") {
                        return res.status(400).json({ message: `${key} is required.` });
                    }
                    unset[key] = "";
                } else {
                    updates[key] = value;
                }
            }
        }

        if (updates.firstName !== undefined) {
            updates.firstName = normalizeName(updates.firstName);
            if (!isValidName(updates.firstName)) {
                return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
            }
        }
        if (updates.lastName !== undefined) {
            updates.lastName = normalizeName(updates.lastName);
            if (!isValidName(updates.lastName)) {
                return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
            }
        }
        if (updates.phoneNumber !== undefined) {
            updates.phoneNumber = normalizePhone(updates.phoneNumber);
            if (updates.phoneNumber && !isValidPhone(updates.phoneNumber)) {
                return res.status(400).json({ message: PHONE_VALIDATION_MESSAGE });
            }
        }
        if (updates.addressType !== undefined && !["home", "office", "place"].includes(updates.addressType)) {
            return res.status(400).json({ message: "addressType must be home, office, or place." });
        }
        const locationFields = ["province", "city", "barangay"];
        if (locationFields.some((field) => Object.prototype.hasOwnProperty.call(requestBody, field))) {
            const nextLocationValue = (field) => {
                if (Object.prototype.hasOwnProperty.call(unset, field)) return "";
                if (updates[field] !== undefined) return String(updates[field]).trim();
                return String(existingUser[field] || "").trim();
            };
            const nextProvince = nextLocationValue("province");
            const nextCity = nextLocationValue("city");
            const nextBarangay = nextLocationValue("barangay");
            if (nextCity && !nextProvince) {
                return res.status(400).json({ message: "Select a province before selecting a city or municipality." });
            }
            if (nextBarangay && !nextCity) {
                return res.status(400).json({ message: "Select a city or municipality before selecting a barangay." });
            }
        }
        for (const urlField of ["facebook", "linkedin", "website"]) {
            if (updates[urlField] === undefined) continue;
            const normalizedUrl = normalizeProfileUrl(updates[urlField]);
            if (!normalizedUrl) {
                return res.status(400).json({ message: `${urlField} must be a valid HTTPS URL.` });
            }
            updates[urlField] = normalizedUrl;
        }
        if (updates.hideHiredCandidates !== undefined && typeof updates.hideHiredCandidates !== "boolean") {
            return res.status(400).json({ message: "hideHiredCandidates must be a boolean." });
        }
        if (
            updates.hideHiredCandidates !== undefined &&
            !["hire", "both"].includes(String(existingUser.role || "").toLowerCase())
        ) {
            return res.status(403).json({ message: "Employer access is required to update this setting." });
        }

        const existingPhone = normalizePhone(existingUser.phoneNumber || "");
        const incomingPhoneProvided = updates.phoneNumber !== undefined;
        const incomingPhoneCleared = Object.prototype.hasOwnProperty.call(unset, "phoneNumber");
        const incomingPhone = incomingPhoneCleared ? "" : (incomingPhoneProvided ? updates.phoneNumber : existingPhone);
        const phoneChanged = incomingPhone !== existingPhone;

        if (phoneChanged) {
            updates["verification.phoneVerified"] = false;
            await clearPhoneVerificationOtp(String(userId));
        }

        // Auto-calculate job statistics from JobApplication collection
        const [jobsApplied, jobsCompleted] = await Promise.all([
            JobApplication.countDocuments({ applicant: userId }),
            JobApplication.countDocuments({ applicant: userId, status: 'Hired' }),
        ]);
        const successRate = jobsApplied > 0 
            ? `${Math.round((jobsCompleted / jobsApplied) * 100)}%` 
            : '0%';

        // Add calculated stats to updates
        updates.jobsApplied = jobsApplied;
        updates.projectsCompleted = jobsCompleted;
        updates.successRate = successRate;

        const updateOps = { $set: updates };
        if (Object.keys(unset).length) {
            updateOps.$unset = unset;
        }

        const user = await User.findByIdAndUpdate(userId, updateOps, {
            returnDocument: "after",
            runValidators: true,
        }).select(
            "firstName lastName email phoneNumber role city province barangay addressType address facebook profilePhotoName jobPosition companyName startDate endDate logoName avatarUrl resumeUrl resumeFileName about linkedin website totalExperience skills workExperience projectsCompleted jobsApplied successRate hideHiredCandidates verification"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Update profile error:", error);
        if (error?.name === "ValidationError") {
            return res.status(400).json({ message: error.message || "Invalid profile data." });
        }
        if (error?.name === "CastError") {
            return res.status(400).json({ message: "Invalid profile data type." });
        }
        if (error?.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            let message = `${field} is already in use.`;
            if (field === 'phoneNumber') {
                message = "This phone number is already in use. Try a different number.";
            } else if (field === 'email') {
                message = "This email is already in use. Try a different email.";
            }
            return res.status(409).json({ message });
        }
        return res.status(500).json({ message: "Failed to update profile." });
    }
}

// Keep compatibility with authRoutes expecting updateMe.
export const updateMe = updateProfile;

const normalizeViewerRole = (value) => {
    if (value === "employer" || value === "hire") return "employer";
    return "worker";
};

const toRatingSummary = (completedCount, totalCount) => {
    const safeTotal = Number(totalCount) || 0;
    const safeCompleted = Number(completedCount) || 0;
    const percentage = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
    return {
        percentage,
        stars: Number((percentage / 20).toFixed(1)),
        completedCount: safeCompleted,
        totalCount: safeTotal,
    };
};

export async function getPublicProfile(req, res) {
    try {
        const requesterId = req.user?.id || req.user?.userId;
        const { userId } = req.params || {};
        const viewer = normalizeViewerRole(String(req.query?.viewAs || "").toLowerCase());

        if (!requesterId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!userId) {
            return res.status(400).json({ message: "User id is required." });
        }

        const user = await User.findById(userId).select(
            "firstName lastName role city province about jobPosition linkedin website totalExperience companyName avatarUrl skills workExperience jobsApplied projectsCompleted successRate hideHiredCandidates"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const [workerAppliedCount, workerHiredCount, postedJobs] = await Promise.all([
            JobApplication.countDocuments({ applicant: user._id }),
            JobApplication.countDocuments({ applicant: user._id, status: "Hired" }),
            Job.find({ jobPoster: user._id }).select("_id"),
        ]);
        const postedJobIds = postedJobs.map((job) => job._id);
        const [employerApplicantsCount, employerHiredCount] = postedJobIds.length
            ? await Promise.all([
                JobApplication.countDocuments({ job: { $in: postedJobIds } }),
                JobApplication.countDocuments({ job: { $in: postedJobIds }, status: "Hired" }),
            ])
            : [0, 0];

        const workerPerformance = toRatingSummary(workerHiredCount, workerAppliedCount);
        const employerPerformance = toRatingSummary(employerHiredCount, employerApplicantsCount);
        const selectedPerformance = viewer === "employer" ? employerPerformance : workerPerformance;
        const reviewRating = await getReviewSummary(user._id, viewer);
        const employerHiringStatsHidden = user.hideHiredCandidates !== false;

        return res.status(200).json({
            profile: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                city: user.city,
                province: user.province,
                about: user.about,
                jobPosition: user.jobPosition,
                linkedin: user.linkedin,
                website: user.website,
                totalExperience: user.totalExperience,
                companyName: user.companyName,
                avatarUrl: user.avatarUrl,
                skills: Array.isArray(user.skills) ? user.skills : [],
                workExperience: Array.isArray(user.workExperience) ? user.workExperience : [],
            },
            rating: {
                viewAs: viewer,
                hidden: false,
                stars: reviewRating.averageRating,
                averageRating: reviewRating.averageRating,
                totalReviews: reviewRating.totalReviews,
                percentage: reviewRating.percentage,
                ratingBreakdown: reviewRating.ratingBreakdown,
                completedCount: selectedPerformance.completedCount,
                totalCount: selectedPerformance.totalCount,
            },
            stats: {
                worker: {
                    jobsApplied: workerAppliedCount,
                    projectsCompleted: workerHiredCount,
                    successRate: workerPerformance.percentage,
                },
                employer: {
                    jobsPosted: postedJobIds.length,
                    totalApplicants: employerApplicantsCount,
                    hires: employerHiringStatsHidden ? null : employerHiredCount,
                    hiresHidden: employerHiringStatsHidden,
                    successRate: employerHiringStatsHidden ? null : employerPerformance.percentage,
                },
            },
        });
    } catch (error) {
        console.error("Get public profile error:", error);
        return res.status(500).json({ message: "Failed to load profile." });
    }
}

export async function sendOtp(req, res) {
    try {
        const { email } = req.body;
        const normalizedEmail = String(email || "").toLowerCase().trim();
        if (!normalizedEmail) {
            return res.status(400).json({ message: "Email is required." });
        }

        let user = null;
        let userLookupFailed = false;
        try {
            user = await User.findOne({ email: normalizedEmail }).select("firstName");
        } catch (lookupError) {
            userLookupFailed = true;
            const reason = lookupError?.message ? ` ${lookupError.message}` : "";
            console.warn(`Send OTP user lookup failed; continuing without lookup.${reason}`.trim());
        }

        // Keep existing "not found" behavior when lookup succeeds.
        if (!user && !userLookupFailed) {
            return res.status(200).json({ message: OTP_GENERIC_MESSAGE });
        }

        const { code } = await issueOtpChallenge({ purpose: "email-verification", subject: normalizedEmail, user: user?._id });

        const transporter = getEmailTransporter();
        if (!transporter) {
            if (process.env.NODE_ENV === "production") {
                return res.status(500).json({ message: "Email service is not configured." });
            }
            console.warn(`SMTP is not configured. Development OTP generated for …${normalizedEmail.slice(-6)}.`);
            return res.status(200).json({
                message: OTP_GENERIC_MESSAGE,
                code,
            });
        }

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const displayName = user?.firstName || "there";
        const subject = "MicroJobs email verification";
        const text = `Hi ${displayName},\n\nUse this code to verify your email for MicroJobs: ${code}\n\nIf you did not request this, you can ignore this message.`;
        const html = `
            <p>Hi ${displayName},</p>
            <p>Use this code to verify your email for MicroJobs:</p>
            <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</p>
            <p>If you did not request this, you can ignore this message.</p>
        `;

        await transporter.sendMail({
            from: `MicroJobs <${fromAddress}>`,
            to: normalizedEmail,
            subject,
            text,
            html,
        });

        if (process.env.NODE_ENV === "production") {
            return res.status(200).json({ message: OTP_GENERIC_MESSAGE });
        }
        return res.status(200).json({ message: OTP_GENERIC_MESSAGE, code });
    } catch (error) {
        console.error("Send OTP error:", error);
        const detail = error?.message ? ` ${error.message}` : "";
        return res.status(500).json({ message: `Failed to send OTP.${detail}`.trim() });
    }
}

export async function verifyOtp(req, res) {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "Email and code are required." });
        }

        const key = email.toLowerCase().trim();
        const verification = await verifyOtpChallenge({ purpose: "email-verification", subject: key, code, consume: true });
        if (!verification.ok) return res.status(verification.reason === "attempts" ? 429 : 400).json({ message: verification.reason === "attempts" ? "Too many invalid attempts. Request a new OTP." : "OTP not found, invalid, or expired." });

        const user = await User.findOne({ email: key });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.status = "active";
        user.verification = user.verification || {};
        user.verification.emailVerified = true;
        await user.save();

        const authSession = await createSessionWithTokens(req, user);
        setSessionCookies(res, {
            refreshToken: authSession.refreshToken,
            sessionId: authSession.sessionId,
            accessToken: authSession.accessToken,
            accessTokenExpiresAt: authSession.accessTokenExpiresAt,
            expiresAt: authSession.expiresAt,
            csrfToken: crypto.randomBytes(24).toString("hex"),
        });

        return res.status(200).json({
            message: "Email verified and login successful.",
            ...buildAuthTokensPayload(req, authSession),
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role,
                passwordChangeRequired: Boolean(user.passwordChangeRequired),
            },
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({ message: "Failed to verify OTP." });
    }
}

export async function requestPasswordResetOtp(req, res) {
    try {
        const { email } = req.body || {};
        const normalizedEmail = String(email || "").toLowerCase().trim();

        if (!normalizedEmail) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await User.findOne({ email: normalizedEmail }).select("firstName email");
        if (!user) {
            return res.status(200).json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
        }

        const { code } = await issueOtpChallenge({ purpose: "password-reset", subject: normalizedEmail, user: user._id });

        const transporter = getEmailTransporter();
        if (!transporter) {
            return res.status(500).json({ message: "Email service is not configured." });
        }

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const displayName = user.firstName || "there";
        const subject = "MicroJobs password reset code";
        const text = `Hi ${displayName},\n\nUse this code to reset your MicroJobs password: ${code}\n\nThis code expires in 5 minutes. If you did not request this, you can ignore this message.`;
        const html = `
            <p>Hi ${displayName},</p>
            <p>Use this code to reset your MicroJobs password:</p>
            <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</p>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this, you can ignore this message.</p>
        `;

        await transporter.sendMail({
            from: `MicroJobs <${fromAddress}>`,
            to: normalizedEmail,
            subject,
            text,
            html,
        });

        return res.status(200).json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
    } catch (error) {
        console.error("Request password reset OTP error:", error);
        const detail = error?.message ? ` ${error.message}` : "";
        return res.status(500).json({ message: `Failed to send password reset OTP.${detail}`.trim() });
    }
}

export async function verifyPasswordResetOtp(req, res) {
    try {
        const { email, code } = req.body || {};
        const normalizedEmail = String(email || "").toLowerCase().trim();
        const normalizedCode = String(code || "").trim();

        if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
            return res.status(400).json({ message: "Email and a valid 6-digit code are required." });
        }

        const verification = await verifyOtpChallenge({ purpose: "password-reset", subject: normalizedEmail, code: normalizedCode, markVerified: true });
        if (!verification.ok) return res.status(verification.reason === "attempts" ? 429 : 400).json({ message: verification.reason === "attempts" ? "Too many invalid attempts. Request a new reset code." : "Reset code not found, invalid, or expired." });
        return res.status(200).json({ message: "Reset code verified." });
    } catch (error) {
        console.error("Verify password reset OTP error:", error);
        return res.status(500).json({ message: "Failed to verify reset code." });
    }
}

export async function resetPasswordWithOtp(req, res) {
    try {
        const { email, code, newPassword } = req.body || {};
        const normalizedEmail = String(email || "").toLowerCase().trim();
        const normalizedCode = String(code || "").trim();

        if (!normalizedEmail || !normalizedCode || !newPassword) {
            return res.status(400).json({ message: "Email, code, and new password are required." });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }

        const verification = await verifyOtpChallenge({ purpose: "password-reset", subject: normalizedEmail, code: normalizedCode, consume: true });
        if (!verification.ok || !verification.challenge?.verifiedAt) return res.status(400).json({ message: "Reset code not verified, invalid, or expired." });

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (await user.validatePassword(newPassword)) {
            return res.status(400).json({ message: "New password must be different from the current password." });
        }

        await user.setPassword(newPassword);
        await user.save();
        await revokeSessions(user._id);
        await monitor.audit({ actor: user._id, action: "password_reset", ip: req.ip || null, userAgent: req.get?.("user-agent") || null, status: "success" });

        return res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Reset password with OTP error:", error);
        return res.status(500).json({ message: "Failed to reset password." });
    }
}

export async function requestPasswordChangeOtp(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { currentPassword } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required." });
        }

        const user = await User.findById(userId).select("+passwordHashed");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const matches = await user.validatePassword(currentPassword);
        if (!matches) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }
        const emailKey = String(user.email || "").toLowerCase().trim();
        const { code } = await issueOtpChallenge({ purpose: "password-change", subject: emailKey, user: user._id, metadata: { userId: String(user._id) } });

        const transporter = getEmailTransporter();
        if (!transporter) {
            if (process.env.NODE_ENV === "production") {
                return res.status(500).json({ message: "Email service is not configured." });
            }
            console.warn(`SMTP is not configured. Development change-password OTP generated for user …${String(user._id).slice(-6)}.`);
            return res.status(200).json({ message: "OTP generated for development.", code });
        }

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const displayName = user.firstName || "there";
        const subject = "MicroJobs password change verification";
        const text = `Hi ${displayName},\n\nUse this code to continue changing your MicroJobs password: ${code}\n\nThis code expires in 5 minutes. If you did not request this, please secure your account immediately.`;
        const html = `
            <p>Hi ${displayName},</p>
            <p>Use this code to continue changing your MicroJobs password:</p>
            <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</p>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this, please secure your account immediately.</p>
        `;

        await transporter.sendMail({
            from: `MicroJobs <${fromAddress}>`,
            to: emailKey,
            subject,
            text,
            html,
        });

        return res.status(200).json({ message: "Password change OTP sent." });
    } catch (error) {
        console.error("Request password change OTP error:", error);
        return res.status(500).json({ message: "Failed to send password change OTP." });
    }
}

export async function changePasswordWithOtp(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { currentPassword, code, newPassword } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!currentPassword || !code || !newPassword) {
            return res.status(400).json({ message: "Current password, code, and new password are required." });
        }
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }

        const user = await User.findById(userId).select("+passwordHashed");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const matches = await user.validatePassword(currentPassword);
        if (!matches) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }
        if (await user.validatePassword(newPassword)) {
            return res.status(400).json({ message: "New password must be different from the current password." });
        }

        const emailKey = String(user.email || "").toLowerCase().trim();
        const verification = await verifyOtpChallenge({
            purpose: "password-change",
            subject: emailKey,
            code: String(code || "").trim(),
            consume: true,
        });
        if (!verification.ok) {
            const status = verification.reason === "attempts" ? 429 : 400;
            const message = verification.reason === "attempts"
                ? "Too many invalid attempts. Request a new code."
                : "Password change code not found, invalid, or expired.";
            return res.status(status).json({ message });
        }
        if (String(verification.challenge.user || "") !== String(user._id)) {
            return res.status(400).json({ message: "Invalid password change code." });
        }

        await user.setPassword(newPassword);
        await user.save();
        await revokeSessions(user._id, req.user?.sessionId);
        await monitor.audit({ actor: user._id, action: "password_changed", ip: req.ip || null, userAgent: req.get?.("user-agent") || null, status: "success" });
        return res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
        console.error("Change password with OTP error:", error);
        return res.status(500).json({ message: "Failed to change password." });
    }
}

export async function requestSelfDelete(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { currentPassword, confirm } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required." });
        }
        if (String(confirm || "").trim().toUpperCase() !== "DELETE") {
            return res.status(400).json({ message: "Confirmation must be DELETE." });
        }

        const user = await User.findById(userId).select("+passwordHashed");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.status === "deleted") {
            return res.status(400).json({ message: "Account is already deleted." });
        }

        const matches = await user.validatePassword(currentPassword);
        if (!matches) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        const blockers = await getDeletionBlockers(userId);
        if (blockers.length > 0) {
            return res.status(400).json({
                message: "Resolve the following blockers before deleting your account.",
                blockers,
            });
        }

        await anonymizeAndDeleteUser(userId);
        return res.status(200).json({ message: "Account deleted successfully." });
    } catch (error) {
        console.error("Request self delete error:", error);
        return res.status(500).json({ message: "Failed to delete account." });
    }
}
