import 'dotenv/config';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import { initSocket } from './lib/socket.js';

const app = express();
const server = http.createServer(app);

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
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI,
    ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    DB_NAME: 'MicroJob',
};

if (!config.MONGO_URI){
    console.error('MONGO_URI is not defined');
    process.exit(1);
}
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
        await mongoose.connect(config.MONGO_URI, { dbName: config.DB_NAME});
        console.log('Connected to DB');

        // initialize socket.io
        initSocket(server);

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