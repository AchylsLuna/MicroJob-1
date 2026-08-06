import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { initSocket } from './lib/socket.js';
import User from './models/User.js';
import sanitize from './middleware/sanitize.js';
import { csrfForCookieSession } from './middleware/csrf.js';
import { buildAllowedOrigins, isAllowedOrigin } from './lib/corsOrigins.js';
import { getWebOrigin, validateProductionRuntime } from './lib/runtimeConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from repo root first so running from /server still reads project-level .env.
dotenv.config({ path: resolve(__dirname, '../.env') });
// Optional server/.env can fill missing values without overriding root.
dotenv.config({ path: resolve(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
validateProductionRuntime();

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
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ORIGIN: getWebOrigin(),
    DB_NAME: process.env.DB_NAME || 'MicroJob',
};
const isProduction = process.env.NODE_ENV === 'production';
const allowInMemoryMongo = process.env.ENABLE_IN_MEMORY_MONGO !== 'false';
let inMemoryMongoServer = null;
const allowedOrigins = buildAllowedOrigins({
    clientOrigin: config.ORIGIN,
    extraOrigins: process.env.ADDITIONAL_CORS_ORIGINS || '',
    defaults: isProduction ? [] : undefined,
});

if (isProduction && allowedOrigins.size === 0) {
    throw new Error('WEB_ORIGIN or CLIENT_ORIGIN must be configured in production.');
}

app.use(
    helmet({
        // API serves uploaded files cross-origin in dev; keep resource policy permissive.
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        // API does not serve app HTML; disable CSP here to avoid overblocking file previews.
        contentSecurityPolicy: false,
    })
);

app.use((req, res, next) => {
    req.requestId = req.get('x-request-id') || crypto.randomUUID();
    res.setHeader('x-request-id', req.requestId);

    if (isProduction) {
        const sendJson = res.json.bind(res);
        res.json = (payload) => {
            if (res.statusCode < 500 || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return sendJson(payload);
            }
            const safePayload = { ...payload, requestId: req.requestId };
            delete safePayload.error;
            delete safePayload.stack;
            delete safePayload.details;
            return sendJson(safePayload);
        };
    }
    next();
});

app.use(morgan(isProduction ? ':method :status :response-time ms' : 'dev'));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitize);
app.use(csrfForCookieSession);

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

// Restrict sensitive uploads (resumes/KYC docs) to authorized viewers.
// Avatars can still be served publicly.
// Verification documents are owner/admin only; employers can view resumes from
// workers who applied to one of their jobs.

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

import { createUploadsRouter } from './routes/UploadRoute.js';

app.use('/uploads', createUploadsRouter());

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
    const city = String(process.env.DEMO_USER_CITY || 'Quezon City').trim();
    const province = String(process.env.DEMO_USER_PROVINCE || 'Metro Manila').trim();

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
            city,
            province,
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
    if (!user.city && city) {
        user.city = city;
        changed = true;
    }
    if (!user.province && province) {
        user.province = province;
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
app.use((err, req, res, _next) => {
    console.error(`[${req.requestId || 'no-request-id'}]`, err);
    const isMalformedJson = err instanceof SyntaxError && err?.type === 'entity.parse.failed';
    const isPayloadTooLarge = err?.type === 'entity.too.large';
    const isUploadTooLarge = err?.code === 'LIMIT_FILE_SIZE';
    const isUploadValidation = /^Only .+ allowed/i.test(String(err?.message || ''));
    const isDatabaseValidation = err?.name === 'ValidationError' || err?.name === 'CastError';
    const isCorsError = err?.message === 'Not allowed by CORS';
    const statusCode = isMalformedJson || isUploadValidation || isDatabaseValidation
        ? 400
        : isPayloadTooLarge || isUploadTooLarge
            ? 413
            : isCorsError
                ? 403
                : err.statusCode || err.status || 500;
    const publicMessage = isMalformedJson
        ? 'Malformed JSON request body.'
        : isPayloadTooLarge
            ? 'Request body is too large.'
            : isUploadTooLarge
                ? 'File is too large. Maximum size is 5 MB.'
                : isDatabaseValidation
                    ? 'Invalid request data.'
                    : statusCode >= 500 && isProduction
                        ? 'Internal Server Error'
                        : err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message: publicMessage,
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
            const { MongoMemoryServer } = await import('mongodb-memory-server');
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
            console.log(`Server is listening on port ${config.PORT}`);
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
