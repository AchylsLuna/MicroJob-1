import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { buildAllowedOrigins } from '../lib/corsOrigins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from repo root first so running from /server still reads project-level .env.
dotenv.config({ path: resolve(__dirname, '../../.env') });
// Optional server/.env can fill missing values without overriding root.
dotenv.config({ path: resolve(__dirname, '../.env') });

export const config = {
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    ORIGIN: process.env.WEB_ORIGIN || process.env.CLIENT_ORIGIN ||
        (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
    DB_NAME: process.env.DB_NAME || 'MicroJob',
};

export const isProduction = process.env.NODE_ENV === 'production';
export const allowInMemoryMongo = process.env.ENABLE_IN_MEMORY_MONGO !== 'false';

export const allowedOrigins = buildAllowedOrigins({
    clientOrigin: config.ORIGIN,
    extraOrigins: process.env.ADDITIONAL_CORS_ORIGINS || '',
    defaults: isProduction ? [] : undefined,
});

if (isProduction && allowedOrigins.size === 0) {
    throw new Error('WEB_ORIGIN or CLIENT_ORIGIN must be configured in production.');
}
