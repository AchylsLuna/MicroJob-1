import cors from 'cors';
import { isAllowedOrigin } from '../../lib/corsOrigins.js';

// Allow CORS including PATCH and preflight for the client
export const buildCorsMiddleware = ({ isProduction, allowedOrigins }) =>
    cors({
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
    });
