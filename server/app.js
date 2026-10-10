import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { allowInMemoryMongo, allowedOrigins, apiIdentity, config, isProduction } from './config/env.js';
import { connectDB } from './lib/db.js';
import { ensureRuntimeData } from './lib/runtimeData.js';
import { applySecurityMiddleware } from './middleware/security/security.js';
import { buildCorsMiddleware } from './middleware/security/corsConfig.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createUploadsRouter } from './routes/UploadRoute.js';
import { registerRoutes } from './routes/index.js';
import sanitize from './middleware/sanitize.js';
import { csrfForCookieSession } from './middleware/csrf.js';

const app = express();
let dbReady;

const isVercelRuntime = ['1', 'true'].includes(String(process.env.VERCEL || '').toLowerCase()) ||
	Boolean(process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL);

const ensureDatabaseReady = () => {
	if (!dbReady) {
		dbReady = connectDB({
			mongoUri: config.MONGO_URI,
			dbName: config.DB_NAME,
			isProduction,
			allowInMemoryMongo,
		}).then(() => ensureRuntimeData()).catch(() => {
		}).then(() => {
			if (!isVercelRuntime) {
				return ensureRuntimeData();
			}
		}).catch((error) => {
			dbReady = undefined;
			throw error;
		});
	}

	return dbReady;
};

applySecurityMiddleware(app, { isProduction, enforceHttps: !isVercelRuntime });

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
			safePayload.message = 'Request could not be completed.';
			return sendJson(safePayload);
		};
	}

	next();
});

app.use(morgan(isProduction ? ':method :status :response-time ms' : 'dev'));

// CORS runs ahead of body parsing, sanitising and CSRF because those can all
// end a request on their own. Mounted after them (as it was), a 403 from
// csrfForCookieSession or a 400 from a malformed JSON body was written without
// Access-Control-Allow-Origin, so the browser discarded the response and
// reported a CORS failure -- hiding the real status and message from the
// client, and sending anyone debugging it to the CORS config instead of the
// actual cause. Preflight itself was never affected: csrf.js short-circuits
// OPTIONS. Keep this above the parsers.
app.use(buildCorsMiddleware({ isProduction, allowedOrigins }));
// The raw buffer is kept because PaymentController's PayMongo webhook must
// verify an HMAC over the exact bytes that were signed. req.body is parsed and
// then rewritten by the sanitize middleware below, so it cannot stand in.
app.use(express.json({
	limit: '1mb',
	verify: (req, res, buffer) => { req.rawBody = buffer; },
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitize);
app.use(csrfForCookieSession);

app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		...apiIdentity,
	});
});

app.use(async (req, res, next) => {
	try {
		await ensureDatabaseReady();
		next();
	} catch (error) {
		next(error);
	}
});

app.use('/uploads', createUploadsRouter());

registerRoutes(app);

// Error handler must be registered last
app.use(errorHandler(isProduction));

export default app;
