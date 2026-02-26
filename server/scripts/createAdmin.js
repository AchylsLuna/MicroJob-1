import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

async function main() {
  const [,, emailArg, passwordArg, roleArg = 'superadmin'] = process.argv;
  const email = (process.env.ADMIN_EMAIL || emailArg || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || passwordArg || '';
  const role = process.env.ADMIN_ROLE || roleArg;

  if (!email || !password) {
    console.error('Usage: node createAdmin.js <email> <password> [role]');
    console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD in environment.');
    process.exit(1);
  }

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MicroJob';

  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { dbName: 'MicroJob' });

  try {
    let user = await User.findOne({ email });
    if (user) {
      console.log('User found, updating role/password/status');
      user.role = role;
      user.status = 'active';
      user.firstName = user.firstName || 'Admin';
      user.lastName = user.lastName || 'User';
      await user.setPassword(password);
      await user.save();
      console.log('Existing user updated:', email);
    } else {
      console.log('Creating new admin user');
      user = new User({
        email,
        firstName: 'Admin',
        lastName: 'User',
        role,
        status: 'active',
      });
      await user.setPassword(password);
      await user.save();
      console.log('Admin user created:', email);
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
