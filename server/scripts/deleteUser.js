import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import mongoose from 'mongoose';
import User from '../models/User.js';

const deleteUser = async (email) => {
    try {
        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            console.error('MONGO_URI is not defined');
            process.exit(1);
        }

        await mongoose.connect(MONGO_URI, { dbName: 'MicroJob' });
        console.log('Connected to MongoDB');

        const user = await User.findOneAndDelete({ email: email.toLowerCase() });
        
        if (user) {
            console.log(`✅ User deleted successfully: ${user.email}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
        } else {
            console.log(`❌ No user found with email: ${email}`);
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.error('Usage: node deleteUser.js <email>');
    console.error('Example: node deleteUser.js jomasEnriquez2004@gmail.com');
    process.exit(1);
}

deleteUser(email);
