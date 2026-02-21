import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";
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

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_SENT_GENERIC_MESSAGE = "If an account exists for this email, an OTP has been sent.";

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

export async function register(req, res) {
    try {
        const { phoneNumber, email, firstName, lastName, username, password, role } = req.body;
        const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : "";
        const normalizedEmail = normalizeEmail(email);

        let finalFirstName = firstName;
        let finalLastName = lastName;

        if (username && !firstName && !lastName) {
            const nameParts = username.trim().split(" ");
            finalFirstName = nameParts[0] || "";
            finalLastName = nameParts.slice(1).join(" ") || nameParts[0] || "";
        }

        const normalizedFirstName = normalizeName(finalFirstName);
        let normalizedLastName = normalizeName(finalLastName);
        if (!normalizedLastName) {
            normalizedLastName = normalizedFirstName;
        }

        if (!normalizedFirstName || typeof password !== "string" || !password || !normalizedEmail) {
            return res.status(400).json({ message: "Missing Fields." });
        }
        if (!isValidName(normalizedFirstName) || !isValidName(normalizedLastName)) {
            return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
        }

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ message: EMAIL_VALIDATION_MESSAGE });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }

        if (normalizedPhone) {
            if (!isValidPhone(normalizedPhone)) {
                return res.status(400).json({ message: PHONE_VALIDATION_MESSAGE });
            }

            const phoneExists = await User.findOne({ phoneNumber: normalizedPhone });
            if (phoneExists) {
                return res.status(409).json({ message: "Phone Number is already registered." });
            }
        }

        const emailExists = await User.findOne({ email: normalizedEmail });
        if (emailExists) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const validRoles = ["hire", "work", "both"];
        const userRole = role && validRoles.includes(role) ? role : "work";
        console.log("Register - User role being set to:", userRole);

        const user = new User({
            phoneNumber: normalizedPhone || undefined,
            email: normalizedEmail,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            role: userRole,
            status: "pending",
        });
        await user.setPassword(password);
        await user.save();

        return res.status(201).json({ message: "Successfully registered." });
    } catch (error) {
        console.error("Registration Failed.");
        return res.status(500).json({ message: "Registration Failed." });
    }
}

export async function login(req, res) {
    try{
        const {phonenumber, password, phoneNumber, email, emailOrUsername} = req.body;
        // Support both web (emailOrUsername) and mobile (email/phone) formats
        const rawIdentifier = emailOrUsername ?? email ?? phonenumber ?? phoneNumber ?? "";
        const identifier = typeof rawIdentifier === "string"
            ? rawIdentifier.trim()
            : String(rawIdentifier).trim();
        const normalizedIdentifier = identifier.includes("@")
            ? normalizeEmail(identifier)
            : normalizePhone(identifier) || identifier;

        if(!normalizedIdentifier || typeof password !== "string" || !password) {
            return res.status(400).json({message: "Missing Fields."});
        }
        
        // Search by phoneNumber or email
        const user = await User.findOne({
            $or: [
                {phoneNumber: normalizedIdentifier}, 
                {phonenumber: normalizedIdentifier},
                {email: normalizedIdentifier}
            ]
        });
        if(!user || !(await user.validatePassword(password))) {
            return res.status(401).json({message: "Invalid credentials."});
        }
        if(user.status !== "active") {
            return res.status(401).json({message: "Account is disabled. Contact an Admin."});
        }
        
        const token = jwt.sign(
            {id: user._id, role: user.role},
            process.env.JWT_SECRET,
            {expiresIn: "7d"}
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7* 24 * 60 * 60 * 1000,
        });
        
        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role, // hire, work, both, admin, superadmin
                city: user.city,
                country: user.country,
                linkedin: user.linkedin,
                avatarUrl: user.avatarUrl,
            }
        });
    } catch (error){
        console.error("Login error:", error);
        res.status(500).json({message: "Login failed."});
    }
}

export async function logout(req, res) {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === 'production'
    });
    return res.status(200).json({message: "Logout successful."});
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
            process.env.JWT_SECRET,
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

export async function googleAuth(req, res) {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ message: 'idToken is required.' });
        }

        const {OAuth2Client} = await import('google-auth-library');
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ message: 'Google client ID not configured.' });
        }
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }

        const email = payload.email.toLowerCase();
        const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
        const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || firstName;
        const avatarUrl = payload.picture;

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                email,
                firstName,
                lastName,
                role: 'work',
                status: 'active',
                avatarUrl: avatarUrl,
            });
            // set a random strong password so the schema requirement is satisfied
            const crypto = await import('crypto');
            const random = crypto.randomBytes(24).toString('base64') + Date.now().toString();
            try {
                await user.setPassword(random);
            } catch (pwErr) {
                // fallback: hash with bcrypt directly
                const bcrypt = await import('bcryptjs');
                user.passwordHashed = await bcrypt.hash(random, 10);
            }
            await user.save();
        }

        if (user.status === 'disabled') {
            return res.status(403).json({ message: 'Account disabled.' });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
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
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(500).json({ message: 'Google authentication failed.' });
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
