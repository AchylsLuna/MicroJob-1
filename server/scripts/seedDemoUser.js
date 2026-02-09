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

const email = process.env.DEMO_USER_EMAIL || 'user@microjobs.local';
const password = process.env.DEMO_USER_PASSWORD || 'User12345!';
const role = process.env.DEMO_USER_ROLE || 'work';
const resetPassword = ['1', 'true', 'yes'].includes(
  String(process.env.DEMO_USER_RESET_PASSWORD || '').toLowerCase()
);

const run = async () => {
  await mongoose.connect(uri, { dbName });

  let user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    user = new User({
      email: email.toLowerCase().trim(),
      firstName: 'Demo',
      lastName: 'User',
      role,
      status: 'active',
    });
    await user.setPassword(password);
    await user.save();
    console.log('✅ Demo user created');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } else {
    let changed = false;
    if (user.role !== role) {
      user.role = role;
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
      console.log('✅ Demo user updated');
    } else {
      console.log('✅ Demo user already exists');
    }
    console.log(`Email: ${email}`);
    if (resetPassword) {
      console.log(`Password: ${password}`);
    } else {
      console.log('Password unchanged (set DEMO_USER_RESET_PASSWORD=1 to reset)');
    }
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Failed to seed demo user:', error);
  mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
