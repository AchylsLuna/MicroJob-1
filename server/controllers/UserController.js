import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getJwtSecret } from "../lib/jwtSecret.js";

const otpStore = new Map();
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

        const updateOps = { $set: updates };
        if (Object.keys(unset).length) {
            updateOps.$unset = unset;
        }

        const user = await User.findByIdAndUpdate(userId, updateOps, {
            new: true,
            runValidators: true,
        }).select(
            "firstName lastName email phoneNumber role city province address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.status(200).json({ profile: user });
    } catch (error) {
        console.error("Update profile error:", error);
        if (error?.name === "ValidationError") {
            return res.status(400).json({ message: error.message || "Invalid profile data." });
        }
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Email or phone number is already in use." });
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
