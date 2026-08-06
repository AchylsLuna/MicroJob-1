import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { allowInMemoryMongo, allowedOrigins, config, isProduction } from './config/env.js';
import { connectDB } from './lib/db.js';
import { applySecurityMiddleware } from './middleware/security/security.js';
import { buildCorsMiddleware } from './middleware/security/corsConfig.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createUploadsRouter } from './routes/UploadRoute.js';
import { registerRoutes } from './routes/index.js';
import sanitize from './middleware/sanitize.js';

const app = express();
const dbReady = connectDB({
	mongoUri: config.MONGO_URI,
	dbName: config.DB_NAME,
	isProduction,
	allowInMemoryMongo,
});

applySecurityMiddleware(app, { isProduction });

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitize);

app.use(async (req, res, next) => {
	try {
		await dbReady;
		next();
	} catch (error) {
		next(error);
	}
});

app.use(buildCorsMiddleware({ isProduction, allowedOrigins }));

app.use('/uploads', createUploadsRouter());

registerRoutes(app);

// Error handler must be registered last
app.use(errorHandler(isProduction));

export default app;
