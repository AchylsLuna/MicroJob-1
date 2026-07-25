import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { initSocket } from './lib/socket.js';
import User from './models/User.js';
import Session from './models/Session.js';
import sanitize from './middleware/sanitize.js';
import { buildAllowedOrigins, isAllowedOrigin } from './lib/corsOrigins.js';
import { getJwtSecret } from './lib/jwtSecret.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from repo root first so running from /server still reads project-level .env.
dotenv.config({ path: resolve(__dirname, '../.env') });
// Optional server/.env can fill missing values without overriding root.
dotenv.config({ path: resolve(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

const parseTrustProxy = () => {
    const raw = process.env.TRUST_PROXY;
    if (raw === undefined) {
        return false;
    }
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'true') {
        return 1;
    }
    if (normalized === 'false') {
        return false;
    }
    const asNumber = Number(normalized);
    if (Number.isInteger(asNumber) && asNumber >= 0) {
        return asNumber;
    }
    return false;
};

// Security: only trust proxy headers when explicitly configured.
app.set('trust proxy', parseTrustProxy());

// Enforce HTTPS and HSTS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.protocol !== 'https') {
            // Redirect to https
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        // Set HSTS header for browsers to enforce HTTPS
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        next();
    });
}

//Connection Config
const config = {
    PORT: Number(process.env.PORT) || 5055,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    DB_NAME: process.env.DB_NAME || 'MicroJob',
};
const isProduction = process.env.NODE_ENV === 'production';
const allowInMemoryMongo = process.env.ENABLE_IN_MEMORY_MONGO !== 'false';
let inMemoryMongoServer = null;
const allowedOrigins = buildAllowedOrigins({
    clientOrigin: config.ORIGIN,
    extraOrigins: process.env.ADDITIONAL_CORS_ORIGINS || '',
});

app.use(
    helmet({
        // API serves uploaded files cross-origin in dev; keep resource policy permissive.
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        // API does not serve app HTML; disable CSP here to avoid overblocking file previews.
        contentSecurityPolicy: false,
    })
);

app.use (morgan('dev'));

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true}));
app.use(sanitize);

// Allow CORS including PATCH and preflight for the client
app.use(cors({
    origin: (origin, callback) => {
        if (!isProduction) {
            callback(null, true);
            return;
        }
        if (isAllowedOrigin(origin, allowedOrigins)) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    preflightContinue: false,
}));

// Ensure OPTIONS preflight is handled for all routes
// No explicit app.options needed because CORS middleware is applied globally

const uploadsDir = resolve(__dirname, 'uploads');
const uploadsRoot = `${uploadsDir}${process.platform === 'win32' ? '\\' : '/'}`;

const isSafeUploadFileName = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    if (normalized.includes('..')) return false;
    return /^[a-zA-Z0-9._-]+$/.test(normalized);
};

const isAdminRole = (role = '') => {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'admin' || normalized === 'superadmin';
};

const toUploadUrl = (fileName = '') => `/uploads/${fileName}`;

const getAuthContextFromRequest = async (req) => {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) {
        token = req.cookies?.token;
    }
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        const userId = decoded?.userId || decoded?.id || decoded?._id;
        if (!userId) {
            return null;
        }

        const role = String(decoded?.role || '');
        const sessionId = decoded?.sessionId;
        if (sessionId) {
            const session = await Session.findById(sessionId).select('user active expiresAt');
            if (!session || !session.active) {
                return null;
            }
            if (String(session.user) !== String(userId)) {
                return null;
            }
            if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
                return null;
            }
        }

        return { id: String(userId), role };
    } catch {
        return null;
    }
};

// Restrict sensitive uploads (resumes/KYC docs) to owner/admin.
// Avatars can still be served publicly.
// Resumes and verification documents are owner/admin only.
app.get('/uploads/:fileName', async (req, res) => {
    try {
        const fileName = String(req.params?.fileName || '').trim();
        if (!isSafeUploadFileName(fileName)) {
            return res.status(400).json({ message: 'Invalid file path.' });
        }

        const fullPath = resolve(uploadsDir, fileName);
        if (fullPath !== uploadsDir && !fullPath.startsWith(uploadsRoot)) {
            return res.status(400).json({ message: 'Invalid file path.' });
        }
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ message: 'File not found.' });
        }

        const uploadUrl = toUploadUrl(fileName);
        const owner = await User.findOne({
            $or: [
                { avatarUrl: uploadUrl },
                { resumeFileName: fileName },
                { resumeUrl: uploadUrl },
                { 'verification.identityDocument.documentUrl': uploadUrl },
                { 'verification.addressDocument.documentUrl': uploadUrl },
            ],
        }).select(
            '_id avatarUrl resumeFileName resumeUrl verification.identityDocument.documentUrl verification.addressDocument.documentUrl'
        );

        if (!owner) {
            return res.status(404).json({ message: 'File metadata not found.' });
        }

        const isAvatar = owner.avatarUrl === uploadUrl;
        const isSensitiveFile =
            owner.resumeFileName === fileName ||
            owner.resumeUrl === uploadUrl ||
            owner.verification?.identityDocument?.documentUrl === uploadUrl ||
            owner.verification?.addressDocument?.documentUrl === uploadUrl;

        if (isSensitiveFile) {
            const authContext = await getAuthContextFromRequest(req);
            if (!authContext?.id) {
                return res.status(401).json({ message: 'Authentication required.' });
            }

            const isOwner = String(owner._id) === authContext.id;
            if (!isOwner && !isAdminRole(authContext.role)) {
                return res.status(403).json({ message: 'Not allowed to access this file.' });
            }
        }

        if (isAvatar || isSensitiveFile) {
            return res.sendFile(fullPath);
        }

        return res.status(404).json({ message: 'File metadata not found.' });
    } catch (error) {
        console.error('Upload access error:', error);
        return res.status(500).json({ message: 'Failed to access file.' });
    }
});

// Routes
import CategoryRoute from './routes/CategoryRoute.js';
import JobRoute from './routes/JobRoute.js';
import UserRoute from './routes/UserRoute.js';
import authRoutes from './routes/authRoutes.js';
import JobApplicationRoute from './routes/JobApplicationRoute.js';
import MessageRoute from './routes/MessageRoute.js';
import paymentRoutes from './routes/PaymentRoute.js';
import AlertRoute from './routes/AlertRoute.js';
import NotificationRoute from './routes/NotificationRoute.js';
import AdminRoute from './routes/AdminRoute.js';
import SavedJobRoute from './routes/SavedJobRoute.js';
import SupportRoute from './routes/SupportRoute.js';
import { runDataBackfills } from './lib/backfills.js';


app.get('/', (req, res) => {
    res.json({ message: 'Backend server is running' });
});

// Auth routes (includes login, register, logout)
app.use('/api/auth', authRoutes);

// Other routes
app.use('/api/categories', CategoryRoute);
app.use('/api/jobs', JobRoute);
app.use('/api/users', UserRoute);
app.use('/api', JobApplicationRoute);
app.use('/api/messages', MessageRoute);
app.use('/api/payment', paymentRoutes);
app.use('/api/alerts', AlertRoute);
app.use('/api/notifications', NotificationRoute);
app.use('/api/admin', AdminRoute);
app.use('/api/saved-jobs', SavedJobRoute);
app.use('/api/support', SupportRoute);

const truthy = (value = '') => ['1', 'true', 'yes'].includes(String(value).toLowerCase());

const ensureDevSuperAdmin = async () => {
    if (isProduction || !truthy(process.env.AUTO_SEED_SUPERADMIN ?? 'false')) {
        return;
    }

    const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@microjobs.local').toLowerCase().trim();
    const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
    const resetPassword = truthy(process.env.SUPERADMIN_RESET_PASSWORD || '');

    if (!email || !password) {
        return;
    }

    let user = await User.findOne({ email });
    if (!user) {
        user = new User({
            email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin',
            status: 'active',
        });
        await user.setPassword(password);
        await user.save();
        console.log(`Dev superadmin seeded: ${email}`);
        return;
    }

    let changed = false;
    if (user.role !== 'superadmin') {
        user.role = 'superadmin';
        changed = true;
    }
    if (user.status !== 'active') {
        user.status = 'active';
        changed = true;
    }
    if (resetPassword) {
        await user.setPassword(password);
        changed = true;
    }
    if (changed) {
        await user.save();
        console.log(`Dev superadmin normalized: ${email}`);
    }
};

const ensureDevDemoUser = async () => {
    if (isProduction || !truthy(process.env.AUTO_SEED_DEMO_USER ?? 'false')) {
        return;
    }

    const email = (process.env.DEMO_USER_EMAIL || 'user@microjobs.local').toLowerCase().trim();
    const password = process.env.DEMO_USER_PASSWORD || 'User12345!';
    const resetPassword = truthy(process.env.DEMO_USER_RESET_PASSWORD || '');
    const allowedRoles = new Set(['work', 'hire', 'both']);
    const requestedRole = String(process.env.DEMO_USER_ROLE || 'work').toLowerCase();
    const role = allowedRoles.has(requestedRole) ? requestedRole : 'work';

    if (!email || !password) {
        return;
    }

    let user = await User.findOne({ email });
    if (!user) {
        user = new User({
            email,
            firstName: 'Demo',
            lastName: 'User',
            role,
            status: 'active',
        });
        await user.setPassword(password);
        await user.save();
        console.log(`Dev demo user seeded: ${email}`);
        return;
    }

    let changed = false;
    if (user.role !== role) {
        user.role = role;
        changed = true;
    }
    if (user.status !== 'active') {
        user.status = 'active';
        changed = true;
    }
    if (resetPassword) {
        await user.setPassword(password);
        changed = true;
    }
    if (changed) {
        await user.save();
        console.log(`Dev demo user normalized: ${email}`);
    }
};

//Error handler
app.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
    })
}) 
const startServer = async () => {
    try {
        if (config.MONGO_URI) {
            try {
                await mongoose.connect(config.MONGO_URI, {
                    dbName: config.DB_NAME,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000,
                });
                console.log('Connected to DB');
            } catch (dbError) {
                if (isProduction || !allowInMemoryMongo) {
                    throw dbError;
                }
                console.warn(
                    `Primary MongoDB connection failed (${dbError?.message || 'unknown error'}). Falling back to in-memory MongoDB for local development.`
                );
            }
        } else if (isProduction || !allowInMemoryMongo) {
            throw new Error('MONGO_URI is not defined');
        }

        if (mongoose.connection.readyState !== 1) {
            inMemoryMongoServer = await MongoMemoryServer.create({
                instance: { dbName: config.DB_NAME },
            });
            const inMemoryUri = inMemoryMongoServer.getUri();
            await mongoose.connect(inMemoryUri, { dbName: config.DB_NAME });
            console.warn(`Connected to in-memory MongoDB (${config.DB_NAME})`);
        }

        await ensureDevSuperAdmin();
        await ensureDevDemoUser();
        await runDataBackfills();


        // initialize socket.io
        initSocket(server, { allowedOrigins });

        server.on('error', (error) => {
            if (error?.code === 'EADDRINUSE') {
                console.error(
                    `Port ${config.PORT} is already in use. Stop the existing process or set PORT in .env to another value.`
                );
                process.exit(1);
            }
            console.error('Server failed to start: ', error);
            process.exit(1);
        });

        server.listen(config.PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${config.PORT}`);
            console.log(`Mobile can access: http://192.168.1.20:${config.PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        console.error('\nTroubleshooting tips:');
        console.error('1. Check your internet connection');
        console.error('2. Verify MongoDB Atlas cluster is running');
        console.error('3. Check if your IP is whitelisted in MongoDB Atlas');
        console.error('4. Verify the connection string in .env file');
        process.exit(1);
    }
}

startServer();

const shutdown = async () => {
    try {
        await mongoose.connection.close();
        if (inMemoryMongoServer) {
            await inMemoryMongoServer.stop();
        }
    } finally {
        process.exit(0);
    }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
