import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

//Connection Config
const config = {
    PORT: process.env.PORT || 5001,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    ORIGINS: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    DB_NAME: 'MicroJob',
};

if (!config.MONGO_URI){
    console.error('MONGO_URI is not defined');
    process.exit(1);
}
if (!config.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    process.exit(1);
}
app.use (morgan('dev'));

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (config.ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
    },
    credentials:true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))

// Routes
import CategoryRoute from './routes/CategoryRoute.js';
import JobRoute from './routes/JobRoute.js';
import UserRoute from './routes/UserRoute.js';
import authRoutes from './routes/authRoutes.js';
import JobApplicationRoute from './routes/JobApplicationRoute.js';
import MessageRoute from './routes/MessageRoute.js';
import NotificationRoute from './routes/NotificationRoute.js';
import AlertRoute from './routes/AlertRoute.js';

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
app.use('/api/notifications', NotificationRoute);
app.use('/api/alerts', AlertRoute);

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

        app.listen(config.PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${config.PORT}`);
            console.log(`Mobile can access: http://192.168.1.20:${config.PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        process.exit(1);
    }
}

startServer();
