import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSocket } from './lib/socket.js';
import User from './models/User.js';

const app = express();
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from repo root first so running from /server still reads project-level .env.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Optional server/.env can fill missing values without overriding root.
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Security: trust proxy (for HTTPS enforcement behind a proxy)
app.set('trust proxy', 1);

// Enforce HTTPS and HSTS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        if (proto && proto !== 'https') {
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
    PORT: Number(process.env.PORT) || 5001,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    DB_NAME: process.env.DB_NAME || 'MicroJob',
};
const isProduction = process.env.NODE_ENV === 'production';
const allowInMemoryMongo = process.env.ENABLE_IN_MEMORY_MONGO !== 'false';
let inMemoryMongoServer = null;
app.use (morgan('dev'));

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true}));

// Allow CORS including PATCH and preflight for the client
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? config.ORIGIN : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    preflightContinue: false,
}));

// Ensure OPTIONS preflight is handled for all routes
// No explicit app.options needed because CORS middleware is applied globally

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

const truthy = (value = '') => ['1', 'true', 'yes'].includes(String(value).toLowerCase());

const ensureDevSuperAdmin = async () => {
    if (isProduction || !truthy(process.env.AUTO_SEED_SUPERADMIN ?? 'true')) {
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
    if (isProduction || !truthy(process.env.AUTO_SEED_DEMO_USER ?? 'true')) {
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
                await mongoose.connect(config.MONGO_URI, { dbName: config.DB_NAME });
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

        // initialize socket.io
        initSocket(server);

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
