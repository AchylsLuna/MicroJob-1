import User from '../models/User.js';

const truthy = (value = '') => ['1', 'true', 'yes'].includes(String(value).toLowerCase());

// Seeding upserts by email in one atomic findOneAndUpdate rather than
// findOne() + save(). Besides being idempotent, this keeps startup working on a
// database whose _id values were imported as strings: save() would re-query by
// the ObjectId it hydrated and match nothing, throwing DocumentNotFoundError.
// See scripts/migrateStringIdsToObjectIds.js for repairing such a database.
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

    const existed = await User.exists({ email });

    const set = { role: 'superadmin', status: 'active' };
    const setOnInsert = { email, firstName: 'Super', lastName: 'Admin' };

    if (!existed) {
        setOnInsert.passwordHashed = await User.hashPassword(password);
    } else if (resetPassword) {
        set.passwordHashed = await User.hashPassword(password);
    }

    await User.findOneAndUpdate(
        { email },
        { $set: set, $setOnInsert: setOnInsert },
        { upsert: true, setDefaultsOnInsert: true }
    );

    console.log(existed ? `Dev superadmin normalized: ${email}` : `Dev superadmin seeded: ${email}`);
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

    const existing = await User.findOne({ email }).select('city province').lean();

    const set = { role, status: 'active' };
    const setOnInsert = { email, firstName: 'Demo', lastName: 'User' };

    // City/province are only filled in when blank, so a dev editing the demo
    // account's address does not get it overwritten on every restart.
    if (city && !existing?.city) {
        set.city = city;
    }
    if (province && !existing?.province) {
        set.province = province;
    }

    if (!existing) {
        setOnInsert.passwordHashed = await User.hashPassword(password);
    } else if (resetPassword) {
        set.passwordHashed = await User.hashPassword(password);
    }

    await User.findOneAndUpdate(
        { email },
        { $set: set, $setOnInsert: setOnInsert },
        { upsert: true, setDefaultsOnInsert: true }
    );

    console.log(existing ? `Dev demo user normalized: ${email}` : `Dev demo user seeded: ${email}`);
};

/**
 * Seeds every dev convenience account. These accounts are a local nicety, so a
 * failure here is reported and stepped over rather than being allowed to stop
 * the server from serving.
 */
export const seedDevAccounts = async ({ isProduction }) => {
    try {
        await ensureDevSuperAdmin({ isProduction });
        await ensureDevDemoUser({ isProduction });
    } catch (error) {
        console.error('Dev account seeding failed (continuing startup):', error);
    }
};
