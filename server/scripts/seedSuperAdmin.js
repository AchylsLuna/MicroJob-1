import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'MicroJob';
if (!uri) {
  console.error('MONGO_URI is missing in server/.env');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const email = process.env.SUPERADMIN_EMAIL || (!isProduction ? 'superadmin@microjobs.local' : '');
const password = process.env.SUPERADMIN_PASSWORD || (!isProduction ? 'SuperAdmin123!' : '');
if (!email || !password) {
  console.error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required in production.');
  process.exit(1);
}
const resetPassword = ['1', 'true', 'yes'].includes(
  String(process.env.SUPERADMIN_RESET_PASSWORD || '').toLowerCase()
);

const run = async () => {
  await mongoose.connect(uri, { dbName });

  let user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    user = new User({
      email: email.toLowerCase().trim(),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      status: 'active',
    });
    await user.setPassword(password);
    await user.save();
    console.log('✅ Super admin created');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } else {
    let changed = false;
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
      console.log('✅ Super admin updated');
    } else {
      console.log('✅ Super admin already exists');
    }
    console.log(`Email: ${email}`);
    if (resetPassword) {
      console.log(`Password: ${password}`);
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
