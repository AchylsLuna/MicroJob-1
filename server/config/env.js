import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { buildAllowedOrigins } from '../lib/corsOrigins.js';
import { getVercelOrigins, getWebOrigin } from '../lib/runtimeConfig.js';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from repo root first so running from /server still reads project-level .env.
dotenv.config({ path: resolve(__dirname, '../../.env') });
// Optional server/.env can fill missing values without overriding root.
dotenv.config({ path: resolve(__dirname, '../.env') });

export const config = {
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ORIGIN: getWebOrigin(),
    DB_NAME: process.env.DB_NAME || 'MicroJob',
};

const databaseIdentitySource = (() => {
    try {
        const parsed = new URL(String(config.MONGO_URI || '').replace(/^mongodb\+srv:/, 'https:').replace(/^mongodb:/, 'http:'));
        return `${parsed.hostname}/${config.DB_NAME}`;
    } catch {
        return `unconfigured/${config.DB_NAME}`;
    }
})();

export const apiIdentity = Object.freeze({
    service: 'microjobs-api',
    environment: process.env.API_ENVIRONMENT_ID || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    databaseId: crypto.createHash('sha256').update(databaseIdentitySource).digest('hex').slice(0, 12),
    revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local',
});

export const isProduction = process.env.NODE_ENV === 'production';
export const allowInMemoryMongo = process.env.ENABLE_IN_MEMORY_MONGO !== 'false';

export const allowedOrigins = buildAllowedOrigins({
    clientOrigin: config.ORIGIN,
    extraOrigins: [
        process.env.ADDITIONAL_CORS_ORIGINS || '',
        ...getVercelOrigins(),
    ].filter(Boolean).join(','),
    defaults: isProduction ? [] : undefined,
});

if (isProduction && allowedOrigins.size === 0) {
    throw new Error('WEB_ORIGIN, CLIENT_ORIGIN, FRONTEND_URL, ORIGIN, or VERCEL_URL must be configured in production.');
}
