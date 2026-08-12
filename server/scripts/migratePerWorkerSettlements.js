import mongoose from 'mongoose';
import 'dotenv/config';
import { runDataBackfills } from '../lib/backfills.js';

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) throw new Error('MONGO_URI is required.');

try {
  await mongoose.connect(mongoUri);
  await runDataBackfills();
  console.log('Per-worker settlement migration completed.');
} finally {
  await mongoose.disconnect();
}
