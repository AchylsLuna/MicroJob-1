import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { connectDB, closeDB } from '../lib/db.js';
import { ensureRuntimeData } from '../lib/runtimeData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'MicroJob';

if (!uri) {
  console.error('MONGO_URI is missing in server/.env');
  process.exit(1);
}

async function run() {
  console.log('Connecting to database...');
  await connectDB({
    mongoUri: uri,
    dbName,
    isProduction: process.env.NODE_ENV === 'production',
    allowInMemoryMongo: false,
  });

  console.log('Running runtime data backfills...');
  await ensureRuntimeData();
  console.log('Backfills completed successfully.');

  await closeDB();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Backfill failed:', error);
  await closeDB().catch(() => {});
  process.exit(1);
});

