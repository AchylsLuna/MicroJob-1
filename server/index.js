import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import { initSocket } from './lib/socket.js';
import { getJwtSecret } from './lib/jwtSecret.js';
import { buildAllowedOrigins, isAllowedOrigin } from './lib/corsOrigins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load `server/.env` by default when running from monorepo root, while still
// allowing real environment variables to override values in production.
const serverEnv = dotenv.config({ path: resolve(__dirname, '.env') });
if (serverEnv.error) {
    dotenv.config();
}

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production';
const defaultMongoUri = 'mongodb://127.0.0.1:27017';
const mongoUri = process.env.MONGO_URI?.trim() || (isProduction ? '' : defaultMongoUri);

//Connection Config
const config = {
    PORT: process.env.PORT || 5000,
    MONGO_URI: mongoUri,
    ORIGIN: process.env.CLIENT_ORIGIN || process.env.ORIGIN || 'http://localhost:5173',
    DB_NAME: 'MicroJob',
};

const allowedOrigins = buildAllowedOrigins({
    clientOrigin: config.ORIGIN,
    extraOrigins: process.env.CORS_ORIGINS,
});

if (!config.MONGO_URI){
    console.error('MONGO_URI is not defined. Set MONGO_URI in production environment.');
    process.exit(1);
}
if (!process.env.MONGO_URI && !isProduction) {
    console.warn(`MONGO_URI is not set; defaulting to ${defaultMongoUri} for local development.`);
}
app.use (morgan('dev'));

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true}));

// Allow CORS including PATCH and preflight for the client
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
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
        getJwtSecret();
        await mongoose.connect(config.MONGO_URI, { dbName: config.DB_NAME});
        console.log('Connected to DB');

        // initialize socket.io
        initSocket(server, { allowedOrigins });

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
