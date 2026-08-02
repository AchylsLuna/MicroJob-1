import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import User from '../models/User.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load repo root .env first; then allow server/.env for missing values.
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'MicroJob';
if (!uri) {
  console.error('MONGO_URI is missing in server/.env');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const email = process.env.SUPERADMIN_EMAIL || (!isProduction ? 'superadmin@microjobs.local' : '');
const username = String(process.env.SUPERADMIN_USERNAME || '').trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD || (!isProduction ? 'SuperAdmin123!' : '');
if (!email || !password) {
  console.error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required in production.');
  process.exit(1);
}
if (!isStrongPassword(password)) {
  console.error(PASSWORD_POLICY_MESSAGE);
  process.exit(1);
}
const resetPassword = ['1', 'true', 'yes'].includes(
  String(process.env.SUPERADMIN_RESET_PASSWORD || '').toLowerCase()
);
const verbose = ['1', 'true', 'yes'].includes(
  String(process.env.SEED_VERBOSE || '').toLowerCase()
);

const run = async () => {
  await mongoose.connect(uri, { dbName });

  let user = await User.findOne({ email: email.toLowerCase().trim() });
  if (username) {
    const usernameOwner = await User.findOne({ username, ...(user ? { _id: { $ne: user._id } } : {}) });
    if (usernameOwner) {
      throw new Error(`Username "${username}" is already assigned to another account.`);
    }
  }
  if (!user) {
    user = new User({
      email: email.toLowerCase().trim(),
      username: username || undefined,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      status: 'active',
    });
    await user.setPassword(password);
    await user.save();
    console.log('Super admin created');
    console.log(`Email: ${email}`);
    if (verbose) {
      console.log(`Password: ${password}`);
    } else {
      console.log('Password: [hidden] (set SEED_VERBOSE=1 to print)');
    }
  } else {
    let changed = false;
    if (username && user.username !== username) {
      user.username = username;
      changed = true;
    }
    if (user.role !== 'superadmin') {
      user.role = 'superadmin';
      changed = true;
    }
    if (user.status !== 'active') {
      user.status = 'active';
      changed = true;
    }
    if (resetPassword) {
      await user.setPassword(password);
      changed = true;
    }
    if (changed) {
      await user.save();
      console.log('Super admin updated');
    } else {
      console.log('Super admin already exists');
    }
    console.log(`Email: ${email}`);
    if (resetPassword && verbose) {
      console.log(`Password: ${password}`);
    } else if (resetPassword) {
      console.log('Password reset applied. Set SEED_VERBOSE=1 to print.');
    } else {
      console.log('Password unchanged (set SUPERADMIN_RESET_PASSWORD=1 to reset)');
    }
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Failed to seed super admin:', error);
  mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
