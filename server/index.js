import http from 'http';
import app from './app.js';
import { config, isProduction, allowInMemoryMongo, allowedOrigins } from './config/env.js';
import { connectDB, closeDB } from './lib/db.js';
import { initSocket } from './lib/socket.js';
import { ensureDevSuperAdmin, ensureDevDemoUser } from './lib/devSeed.js';
import { runDataBackfills } from './lib/backfills.js';

const server = http.createServer(app);

const startServer = async () => {
    try {
        await connectDB({
            mongoUri: config.MONGO_URI,
            dbName: config.DB_NAME,
            isProduction,
            allowInMemoryMongo,
        });

        await ensureDevSuperAdmin({ isProduction });
        await ensureDevDemoUser({ isProduction });
        await runDataBackfills();

        // initialize socket.io
        initSocket(server, { allowedOrigins });

        server.on('error', (error) => {
            if (error?.code === 'EADDRINUSE') {
                console.error(
                    `Port ${config.PORT} is already in use. Stop the existing process or set PORT in .env to another value.`
                );
                process.exit(1);
            }
            console.error('Server failed to start: ', error);
            process.exit(1);
        });

        server.listen(config.PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${config.PORT}`);
            console.log(`Mobile can access: http://192.168.1.20:${config.PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        console.error('\nTroubleshooting tips:');
        console.error('1. Check your internet connection');
        console.error('2. Verify MongoDB Atlas cluster is running');
        console.error('3. Check if your IP is whitelisted in MongoDB Atlas');
        console.error('4. Verify the connection string in .env file');
        process.exit(1);
    }
};

// Only start a real listening server locally — Vercel just imports the
// exported `app` below and never runs this branch.
if (process.env.VERCEL !== '1') {
    startServer();
}

const shutdown = async () => {
    try {
        await closeDB();
    } finally {
        process.exit(0);
    }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
 