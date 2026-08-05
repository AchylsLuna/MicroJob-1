import User from '../models/User.js';

const truthy = (value = '') => ['1', 'true', 'yes'].includes(String(value).toLowerCase());

export const ensureDevSuperAdmin = async ({ isProduction }) => {
    if (isProduction || !truthy(process.env.AUTO_SEED_SUPERADMIN ?? 'false')) {
        return;
    }

    const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@microjobs.local').toLowerCase().trim();
    const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
    const resetPassword = truthy(process.env.SUPERADMIN_RESET_PASSWORD || '');

    if (!email || !password) {
        return;
    }

    let user = await User.findOne({ email });
    if (!user) {
        user = new User({
            email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin',
            status: 'active',
        });
        await user.setPassword(password);
        await user.save();
        console.log(`Dev superadmin seeded: ${email}`);
        return;
    }

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
        console.log(`Dev superadmin normalized: ${email}`);
    }
};

export const ensureDevDemoUser = async ({ isProduction }) => {
    if (isProduction || !truthy(process.env.AUTO_SEED_DEMO_USER ?? 'false')) {
        return;
    }

    const email = (process.env.DEMO_USER_EMAIL || 'user@microjobs.local').toLowerCase().trim();
    const password = process.env.DEMO_USER_PASSWORD || 'User12345!';
    const resetPassword = truthy(process.env.DEMO_USER_RESET_PASSWORD || '');
    const allowedRoles = new Set(['work', 'hire', 'both']);
    const requestedRole = String(process.env.DEMO_USER_ROLE || 'work').toLowerCase();
    const role = allowedRoles.has(requestedRole) ? requestedRole : 'work';
    const city = String(process.env.DEMO_USER_CITY || 'Quezon City').trim();
    const province = String(process.env.DEMO_USER_PROVINCE || 'Metro Manila').trim();

    if (!email || !password) {
        return;
    }

    let user = await User.findOne({ email });
    if (!user) {
        user = new User({
            email,
            firstName: 'Demo',
            lastName: 'User',
            role,
            status: 'active',
            city,
            province,
        });
        await user.setPassword(password);
        await user.save();
        console.log(`Dev demo user seeded: ${email}`);
        return;
    }

    let changed = false;
    if (user.role !== role) {
        user.role = role;
        changed = true;
    }
    if (user.status !== 'active') {
        user.status = 'active';
        changed = true;
    }
    if (!user.city && city) {
        user.city = city;
        changed = true;
    }
    if (!user.province && province) {
        user.province = province;
        changed = true;
    }
    if (resetPassword) {
        await user.setPassword(password);
        changed = true;
    }
    if (changed) {
        await user.save();
        console.log(`Dev demo user normalized: ${email}`);
    }
};
