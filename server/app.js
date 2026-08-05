import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { isProduction, allowedOrigins } from './config/env.js';
import { applySecurityMiddleware } from './middleware/security/security.js';
import { buildCorsMiddleware } from './middleware/security/corsConfig.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createUploadsRouter } from './routes/UploadRoute.js';
import { registerRoutes } from './routes/index.js';
import sanitize from './middleware/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const uploadsDir = resolve(__dirname, 'uploads');

const app = express();

applySecurityMiddleware(app, { isProduction });

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitize);

app.use(buildCorsMiddleware({ isProduction, allowedOrigins }));

app.use('/uploads', createUploadsRouter(uploadsDir));

registerRoutes(app);

// Error handler must be registered last
app.use(errorHandler(isProduction));

export default app;
