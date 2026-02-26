import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

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

export async function register(req, res) {
    try {
        const { phoneNumber, email, firstName, lastName, username, password, role } = req.body;

        let finalFirstName = firstName;
        let finalLastName = lastName;

        if (username && !firstName && !lastName) {
            const nameParts = username.trim().split(" ");
            finalFirstName = nameParts[0] || "";
            finalLastName = nameParts.slice(1).join(" ") || nameParts[0] || "";
        }

        if (!finalFirstName || !password || !email) {
            return res.status(400).json({ message: "Missing Fields." });
        }

        if (!finalLastName) {
            finalLastName = finalFirstName;
        }

        if (phoneNumber) {
            const phoneExists = await User.findOne({ phoneNumber });
            if (phoneExists) {
                return res.status(409).json({ message: "Phone Number is already registered." });
            }
        }

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const validRoles = ["hire", "work", "both", "admin", "superadmin"];
        const userRole = role && validRoles.includes(role) ? role : "work";
        console.log("Register - User role being set to:", userRole);

        const user = new User({
            phoneNumber,
            email,
            firstName: finalFirstName,
            lastName: finalLastName,
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
        console.log("Login request body:", req.body);
        const {phonenumber, password, phoneNumber, email, emailOrUsername} = req.body;
        // Support both web (emailOrUsername) and mobile (email) formats
        const phone = phonenumber || phoneNumber;
        const identifier = emailOrUsername || email || phone;
        const normalizedIdentifier = identifier && identifier.includes('@')
            ? identifier.toLowerCase().trim()
            : identifier?.trim();
        
        console.log("Identifier:", identifier, "Password present:", !!password);
        
        if(!normalizedIdentifier || !password) {
            console.log("Missing fields - identifier:", normalizedIdentifier, "password:", !!password);
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
                role: user.role // hire, work, both, admin, superadmin
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

export async function getProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const user = await User.findById(userId).select(
            "firstName lastName email phoneNumber role city province address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName employerBalance workerBalance"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.status(200).json({ profile: user });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({ message: "Failed to load profile." });
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

export async function sendOtp(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const transporter = getEmailTransporter();
        if (!transporter) {
            return res.status(500).json({ message: "Email service is not configured." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email.toLowerCase().trim(), {
            code,
            expiresAt: Date.now() + OTP_TTL_MS,
        });

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
            to: email,
            subject,
            text,
            html,
        });

        return res.status(200).json({ message: "OTP sent." });
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
            process.env.JWT_SECRET,
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
