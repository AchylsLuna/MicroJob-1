import User from "../models/User.js";
import JobApplication from "../models/JobApplication.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getJwtSecret } from "../lib/jwtSecret.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";

const otpStore = new Map();
const passwordResetOtpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;

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
        const users = await User.find({});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function getAdminUsers(req, res) {
    try {
        const users = await User.find({ role: { $in: ["admin", "superadmin"] } });
        res.status(200).json(users);
    } catch (error) {
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

        const updated = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: true, runValidators: true }
        );
        if (!updated) {
            return res.status(404).json({ message: "User not found." });
        }
        return res.status(200).json({ message: "User status updated.", user: updated });
    } catch (error) {
        console.error("Update user status error:", error);
        return res.status(500).json({ message: "Failed to update user status." });
    }
}

export async function deleteUser(req, res) {
    try {
        const { userId } = req.params;
        const deleted = await User.findByIdAndDelete(userId);
        if (!deleted) {
            return res.status(404).json({ message: "User not found." });
        }
        return res.status(200).json({ message: "User deleted successfully." });
    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ message: "Failed to delete user." });
    }
}

export async function updateProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        console.log('📥 Update profile request from user:', userId);
        console.log('📥 Request body:', req.body);

        const allowed = [
            "firstName",
            "lastName",
            "city",
            "province",
            "address",
            "phoneNumber",
            "email",
            "facebook",
            "profilePhotoName",
            "jobPosition",
            "companyName",
            "startDate",
            "endDate",
            "logoName",
            "resumeFileName",
            "about",
            "linkedin",
            "totalExperience",
            // Note: projectsCompleted, jobsApplied, and successRate are auto-calculated
        ];

        const updates = {};
        const unset = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                const value = typeof req.body[key] === "string"
                    ? req.body[key].trim()
                    : req.body[key];
                if (value === "") {
                    if (key === "firstName" || key === "lastName" || key === "email") {
                        return res.status(400).json({ message: `${key} is required.` });
                    }
                    unset[key] = "";
                } else {
                    updates[key] = value;
                }
            }
        }

        if (updates.email) {
            updates.email = updates.email.toLowerCase();
        }

        // Auto-calculate job statistics from JobApplication collection
        const jobsApplied = await JobApplication.countDocuments({ applicant: userId });
        const jobsCompleted = await JobApplication.countDocuments({ 
            applicant: userId, 
            status: 'Hired' 
        });
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

        console.log('💾 Saving to database, userId:', userId);
        console.log('💾 Update operations:', JSON.stringify(updateOps, null, 2));

        const user = await User.findByIdAndUpdate(userId, updateOps, {
            new: true,
            runValidators: true,
        }).select(
            "firstName lastName email phoneNumber role city province address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName about linkedin totalExperience projectsCompleted jobsApplied successRate"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        console.log('✅ Successfully saved user data:', {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            city: user.city,
            province: user.province,
        });

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Update profile error:", error);
        if (error?.name === "ValidationError") {
            return res.status(400).json({ message: error.message || "Invalid profile data." });
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

export async function sendOtp(req, res) {
    try {
        const { email } = req.body;
        const normalizedEmail = String(email || "").toLowerCase().trim();
        if (!normalizedEmail) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(normalizedEmail, {
            code,
            expiresAt: Date.now() + OTP_TTL_MS,
        });

        const transporter = getEmailTransporter();
        if (!transporter) {
            if (process.env.NODE_ENV === "production") {
                return res.status(500).json({ message: "Email service is not configured." });
            }
            console.warn(`SMTP is not configured. Development OTP for ${normalizedEmail}: ${code}`);
            return res.status(200).json({
                message: "OTP generated for development.",
                code,
            });
        }

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const displayName = user.firstName || "there";
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
            return res.status(200).json({ message: "OTP sent." });
        }
        return res.status(200).json({ message: "OTP sent.", code });
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
        const record = otpStore.get(key);
        if (!record) {
            return res.status(400).json({ message: "OTP not found or expired." });
        }

        if (record.expiresAt < Date.now()) {
            otpStore.delete(key);
            return res.status(400).json({ message: "OTP expired." });
        }

        if (record.code !== code) {
            return res.status(400).json({ message: "Invalid OTP." });
        }

        const user = await User.findOne({ email: key });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.status = "active";
        await user.save();

        const token = jwt.sign(
            { id: user._id, role: user.role },
            getJwtSecret(),
            { expiresIn: "7d" }
        );

        otpStore.delete(key);

        return res.status(200).json({
            message: "Email verified and login successful.",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role,
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

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: "Email is not registered or not found." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        passwordResetOtpStore.set(normalizedEmail, {
            code,
            expiresAt: Date.now() + OTP_TTL_MS,
        });

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

        return res.status(200).json({ message: "Password reset OTP sent." });
    } catch (error) {
        console.error("Request password reset OTP error:", error);
        const detail = error?.message ? ` ${error.message}` : "";
        return res.status(500).json({ message: `Failed to send password reset OTP.${detail}`.trim() });
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

        const record = passwordResetOtpStore.get(normalizedEmail);
        if (!record) {
            return res.status(400).json({ message: "Reset code not found or expired." });
        }

        if (record.expiresAt < Date.now()) {
            passwordResetOtpStore.delete(normalizedEmail);
            return res.status(400).json({ message: "Reset code expired." });
        }

        if (record.code !== normalizedCode) {
            return res.status(400).json({ message: "Invalid reset code." });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        await user.setPassword(newPassword);
        await user.save();
        passwordResetOtpStore.delete(normalizedEmail);

        return res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Reset password with OTP error:", error);
        return res.status(500).json({ message: "Failed to reset password." });
    }
}
