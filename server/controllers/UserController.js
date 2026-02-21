import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { sendError, sendSuccess } from "../lib/apiResponse.js";
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
import { getJwtSecret } from "../lib/jwtSecret.js";

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_SENT_GENERIC_MESSAGE = "If an account exists for this email, an OTP has been sent.";
const jwtSecret = getJwtSecret();

function getEmailTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 0);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
        return null;
    }

    const secure = port === 465;
    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });
}

export async function getUserList(req, res) {
    try {
        const users = await User.find({}).select('-passwordHashed');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function getAdminUsers(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const admins = await User.find({
            role: { $in: ["admin", "superadmin"] },
            status: "active",
            _id: { $ne: userId },
        }).select("firstName lastName email role");

        return res.status(200).json(admins);
    } catch (error) {
        console.error("Get admin users error:", error);
        return res.status(500).json({ message: "Failed to retrieve admin users." });
    }
}

export async function getMe(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }
        const user = await User.findById(userId).select('-passwordHashed');
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve profile." });
    }
}

export async function updateMe(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return sendError(res, 401, "Authentication required.");
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 404, "User not found.");
        }

        const {
            firstName,
            lastName,
            phoneNumber,
            city,
            country,
            linkedin,
            avatarUrl,
            email,
        } = req.body || {};

        if (firstName !== undefined) {
            const value = normalizeName(firstName);
            if (!value) {
                return sendError(res, 400, "First name is required.");
            }
            if (!isValidName(value)) {
                return sendError(res, 400, NAME_VALIDATION_MESSAGE);
            }
            user.firstName = value;
        }

        if (lastName !== undefined) {
            const value = normalizeName(lastName);
            if (!value) {
                return sendError(res, 400, "Last name is required.");
            }
            if (!isValidName(value)) {
                return sendError(res, 400, NAME_VALIDATION_MESSAGE);
            }
            user.lastName = value;
        }

        if (phoneNumber !== undefined) {
            const normalizedPhone = normalizePhone(phoneNumber || "");
            if (!normalizedPhone) {
                user.phoneNumber = undefined;
            } else {
                if (!isValidPhone(normalizedPhone)) {
                    return sendError(res, 400, PHONE_VALIDATION_MESSAGE);
                }
                const existing = await User.findOne({
                    phoneNumber: normalizedPhone,
                    _id: { $ne: userId },
                });
                if (existing) {
                    return sendError(res, 409, "Phone number is already registered.");
                }
                user.phoneNumber = normalizedPhone;
            }
        }

        if (email !== undefined) {
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) {
                return sendError(res, 400, "Email is required.");
            }
            if (!isValidEmail(normalizedEmail)) {
                return sendError(res, 400, EMAIL_VALIDATION_MESSAGE);
            }
            const existing = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: userId },
            });
            if (existing) {
                return sendError(res, 409, "Email is already registered.");
            }
            user.email = normalizedEmail;
        }

        if (city !== undefined) {
            user.city = String(city).trim() || undefined;
        }

        if (country !== undefined) {
            user.country = String(country).trim() || undefined;
        }

        if (linkedin !== undefined) {
            user.linkedin = String(linkedin).trim() || undefined;
        }

        if (avatarUrl !== undefined) {
            user.avatarUrl = String(avatarUrl).trim() || undefined;
        }

        await user.save();
        const updatedUser = await User.findById(userId).select('-passwordHashed');
        return sendSuccess(res, 200, "Profile updated.", updatedUser, { user: updatedUser });
    } catch (error) {
        console.error("Update profile error:", error);
        return sendError(res, 500, "Failed to update profile.");
    }
}

export async function sendOtp(req, res) {
    try {
        const { email } = req.body;
        const isDev = process.env.NODE_ENV !== "production";
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail) {
            return sendError(res, 400, "Email is required.");
        }

        if (!isValidEmail(normalizedEmail)) {
            return sendError(res, 400, EMAIL_VALIDATION_MESSAGE);
        }

        const transporter = getEmailTransporter();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return sendSuccess(res, 200, OTP_SENT_GENERIC_MESSAGE, null);
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(normalizedEmail, {
            code,
            expiresAt: Date.now() + OTP_TTL_MS,
            attempts: 0,
        });

        if (!transporter) {
            if (isDev) {
                return sendSuccess(
                    res,
                    200,
                    OTP_SENT_GENERIC_MESSAGE,
                    { email: normalizedEmail, code },
                    { code }
                );
            }
            return sendError(res, 500, "Email service is not configured.");
        }

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const displayName = user.firstName || "there";
        const subject = "MicroJobs email verification";
        const text = `Hi ${displayName},\n\nUse this code to verify your email for MicroJobs: ${code}\n\nThis code expires in 5 minutes. If you did not request this, you can ignore this message.`;
        const html = `
            <p>Hi ${displayName},</p>
            <p>Use this code to verify your email for MicroJobs:</p>
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

        return sendSuccess(
            res,
            200,
            OTP_SENT_GENERIC_MESSAGE,
            { email: normalizedEmail, ...(isDev ? { code } : {}) },
            isDev ? { code } : {}
        );
    } catch (error) {
        console.error("Send OTP error:", error);
        const detail = error?.message ? ` ${error.message}` : "";
        return sendError(res, 500, `Failed to send OTP.${detail}`.trim());
    }
}

export async function verifyOtp(req, res) {
    try {
        const { email, code } = req.body;
        const key = normalizeEmail(email);

        if (!key || !code) {
            return sendError(res, 400, "Email and code are required.");
        }
        if (!isValidEmail(key)) {
            return sendError(res, 400, EMAIL_VALIDATION_MESSAGE);
        }

        const record = otpStore.get(key);
        if (!record) {
            return sendError(res, 400, "Invalid or expired OTP.");
        }

        if (record.expiresAt < Date.now()) {
            otpStore.delete(key);
            return sendError(res, 400, "Invalid or expired OTP.");
        }

        if ((record.attempts || 0) >= MAX_OTP_ATTEMPTS) {
            otpStore.delete(key);
            return sendError(res, 400, "Invalid or expired OTP.");
        }

        if (record.code !== code) {
            otpStore.set(key, {
                ...record,
                attempts: (record.attempts || 0) + 1,
            });
            return sendError(res, 400, "Invalid or expired OTP.");
        }

        const user = await User.findOne({ email: key });
        if (!user) {
            return sendError(res, 404, "User not found.");
        }

        if (user.status === "disabled") {
            return sendError(res, 403, "Account is disabled. Contact an Admin.");
        }
        if (user.status === "pending") {
            user.status = "active";
            await user.save();
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            jwtSecret,
            { expiresIn: "7d" }
        );

        otpStore.delete(key);

        const userPayload = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            email: user.email,
            role: user.role,
            city: user.city,
            country: user.country,
            linkedin: user.linkedin,
            avatarUrl: user.avatarUrl,
        };

        return sendSuccess(
            res,
            200,
            "Email verified and login successful.",
            { token, user: userPayload },
            { token, user: userPayload }
        );
    } catch (error) {
        console.error("Verify OTP error:", error);
        return sendError(res, 500, "Failed to verify OTP.");
    }
}

export async function updateUserStatus(req, res) {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        const actorRole = req.user?.role;
        const actorId = req.user?.id || req.user?.userId;

        const allowedStatuses = ["active", "pending", "disabled"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value." });
        }

        const targetUser = await User.findById(userId).select("role");
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        if (
            (targetUser.role === "admin" || targetUser.role === "superadmin") &&
            actorRole !== "superadmin"
        ) {
            return res.status(403).json({ message: "Only superadmin can modify admin accounts." });
        }
        if (actorId && String(actorId) === String(userId) && status === "disabled") {
            return res.status(400).json({ message: "You cannot disable your own account." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: true }
        ).select("-passwordHashed");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.status(200).json({
            message: "User status updated.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Update user status error:", error);
        return res.status(500).json({ message: "Failed to update user status." });
    }
}

export async function deleteUser(req, res) {
    try {
        const { userId } = req.params;
        const actorRole = req.user?.role;

        if (req.user?.id === userId) {
            return res.status(400).json({ message: "You cannot delete your own account." });
        }

        const user = await User.findById(userId).select("role");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (
            (user.role === "admin" || user.role === "superadmin") &&
            actorRole !== "superadmin"
        ) {
            return res.status(403).json({ message: "Only superadmin can delete admin accounts." });
        }

        await user.deleteOne();

        return res.status(200).json({ message: "User deleted." });
    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ message: "Failed to delete user." });
    }
}
