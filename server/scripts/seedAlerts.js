import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Alert from '../models/Alert.js';
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

const email = process.env.ALERTS_EMAIL || process.env.SUPERADMIN_EMAIL || 'superadmin@microjobs.local';

const sampleAlerts = [
  {
    severity: 'critical',
    category: 'payments',
    title: 'Payment dispute opened',
    description: 'Client flagged Job #4821 for a payout dispute. Review evidence within 24 hours.',
    status: 'open',
    actionLabel: 'Review dispute',
  },
  {
    severity: 'warning',
    category: 'jobs',
    title: 'Job posting nearing deadline',
    description: 'The Product Designer role closes in 8 hours. Consider extending if still hiring.',
    status: 'open',
    actionLabel: 'Extend deadline',
  },
  {
    severity: 'info',
    category: 'security',
    title: 'New device login detected',
    description: 'A login from a new device was detected in Cebu City. Review if this was you.',
    status: 'snoozed',
    actionLabel: 'Review activity',
  },
  {
    severity: 'warning',
    category: 'system',
    title: 'Scheduled maintenance window',
    description: 'Planned downtime on Friday from 1:00 AM to 2:00 AM. Notify active clients.',
    status: 'open',
    actionLabel: 'Send notice',
  },
  {
    severity: 'info',
    category: 'payments',
    title: 'Payout bank info updated',
    description: 'Bank details for payouts were updated successfully. Verify if correct.',
    status: 'resolved',
  },
];

const run = async () => {
  await mongoose.connect(uri, { dbName });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found for ${email}. Set ALERTS_EMAIL or create the user.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  let created = 0;
  for (const alert of sampleAlerts) {
    const exists = await Alert.findOne({ user: user._id, title: alert.title });
    if (exists) continue;
    await Alert.create({ user: user._id, ...alert });
    created += 1;
  }

  console.log(`✅ Seeded alerts for ${user.email}. Created: ${created}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Failed to seed alerts:', error);
  mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
