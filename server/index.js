import http from 'http';

import app from './app.js';
import { allowInMemoryMongo, allowedOrigins, config, isProduction } from './config/env.js';
import { connectDB, closeDB } from './lib/db.js';
import { ensureDevDemoUser, ensureDevSuperAdmin } from './lib/devSeed.js';
import JobView from './models/JobView.js';
import { validateProductionRuntime } from './lib/runtimeConfig.js';
import { ensureRuntimeData } from './lib/runtimeData.js';
import { initSocket } from './lib/socket.js';
import { getPhoneOtpConfigStatus, validatePhoneOtpConfiguration } from './lib/phoneOtp.js';

const server = http.createServer(app);
let shuttingDown = false;

export const startServer = async () => {
  try {
    validateProductionRuntime();
    const phoneOtpStatus = getPhoneOtpConfigStatus();
    if (!phoneOtpStatus.valid) {
      if (isProduction) {
        validatePhoneOtpConfiguration();
      } else {
        console.warn(`Phone OTP is disabled until its configuration is fixed: ${phoneOtpStatus.errors.join(' ')}`);
      }
    }

    await connectDB({
      mongoUri: config.MONGO_URI,
      dbName: config.DB_NAME,
      isProduction,
      allowInMemoryMongo,
    });

    // JobView deduplication is enforced by its unique { job, dedupeKey } index,
    // so build it before serving traffic rather than relying on mongoose's
    // background autoIndex — otherwise the first requests after a cold start
    // could double-count views while the index is still being created.
    await JobView.init();

    await ensureDevSuperAdmin({ isProduction });
    await ensureDevDemoUser({ isProduction });
    await ensureRuntimeData();

    initSocket(server, { allowedOrigins });

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        console.error(
          `Port ${config.PORT} is already in use. Stop the existing process or set PORT in .env to another value.`
        );
      } else {
        console.error('Server failed to start:', error);
      }
      closeDB()
        .catch((closeError) => console.error('Failed to close the database after server startup failure:', closeError))
        .finally(() => process.exit(1));
    });

    server.listen(config.PORT, '0.0.0.0', () => {
      console.log(`Server is listening on port ${config.PORT}`);
    });

    return server;
  } catch (error) {
    console.error('Server startup failed:', error);
    if (error?.metadata?.configurationError) {
      console.error('\nPhone OTP configuration is incomplete. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE in server/.env.');
    } else {
      console.error('\nTroubleshooting tips:');
      console.error('1. Check your internet connection');
      console.error('2. Verify MongoDB Atlas cluster is running');
      console.error('3. Check if your IP is whitelisted in MongoDB Atlas');
      console.error('4. Verify the connection string in .env file');
    }
    process.exitCode = 1;
    throw error;
  }
};

export const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await closeDB();
  } finally {
    shuttingDown = false;
  }
};

const isVercelRuntime = ['1', 'true'].includes(String(process.env.VERCEL || '').toLowerCase());

if (!isVercelRuntime) {
  startServer().catch(() => {
    process.exitCode = 1;
  });

  const handleShutdown = () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed to shut down cleanly:', error);
        process.exit(1);
      });
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

export { server };
export default app;
