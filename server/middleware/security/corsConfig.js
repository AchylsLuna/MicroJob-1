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
            // Deny by withholding the header, not by raising. An Error here is
            // forwarded to the error handler, so a disallowed origin produced a
            // 500 ("Request could not be completed.") and an error-log entry for
            // what is an expected, routine rejection. Returning false simply
            // omits Access-Control-Allow-Origin, which is what actually stops
            // the browser -- the caller still gets an honest status instead of
            // a fabricated server fault.
            callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Microjobs-Auth-Transport'],
        exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        preflightContinue: false,
    });
