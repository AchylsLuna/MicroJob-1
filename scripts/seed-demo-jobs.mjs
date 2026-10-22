/**
 * Seeds a handful of realistic job posts so the public board, the landing
 * page's job grid, and its live figures have something to show locally.
 *
 * Why this exists: nothing in the repo has ever seeded jobs. `devSeed.js`
 * creates the superadmin (and, in e2e, the demo user) and `backfills.js`
 * upserts the ten default categories -- so a local database reliably has
 * categories and users and zero jobs. The landing page then correctly reports
 * an empty marketplace, which reads as a broken page.
 *
 * It lives at the repo root rather than under `server/` on purpose:
 * `docs/frontend-only-scope.md` (enforced by `scripts/guard-frontend-only.cjs`)
 * keeps agent-authored changes out of `server/`. This script only *reads* the
 * server's models and config; it adds nothing to the API surface.
 *
 * Idempotent: every job is upserted by title, following the same
 * `findOneAndUpdate(..., { upsert: true })` pattern as `devSeed.js:34-38`, so
 * re-running tops the board back up instead of duplicating it.
 *
 *   node scripts/seed-demo-jobs.mjs            # seed
 *   node scripts/seed-demo-jobs.mjs --remove   # take them back out again
 */
import mongoose from 'mongoose';
import { config } from '../server/config/env.js';
import Job from '../server/models/Job.js';
import User from '../server/models/User.js';
import Category from '../server/models/Category.js';

const remove = process.argv.includes('--remove');

/** Deadlines are relative so a seeded board never silently goes stale. */
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const DEMO_JOBS = [
    {
        title: 'Weekend event assistant',
        description:
            'Help run a two-day community fair: set up booths on Saturday morning, guide vendors to their slots, and pack down on Sunday evening. No experience needed, just reliability and comfort on your feet.',
        location: 'Quezon City',
        salary: 2500,
        jobType: 'Short-term',
        category: 'Event Setup',
        skills: ['Logistics', 'Customer service'],
        deadlineInDays: 14,
    },
    {
        title: 'Deep clean a two-bedroom apartment',
        description:
            'One-off deep clean before a move-in: kitchen degrease, bathroom scrub, windows inside, and floors throughout. Cleaning supplies are provided on site.',
        location: 'Makati',
        salary: 1800,
        jobType: 'Short-term',
        category: 'Cleaning',
        skills: ['Deep cleaning'],
        deadlineInDays: 7,
    },
    {
        title: 'Grade 9 math tutor, twice weekly',
        description:
            'Looking for a patient tutor for algebra and geometry, two evening sessions a week for a month. Sessions run an hour and a half at our home; materials follow the DepEd curriculum.',
        location: 'Cebu City',
        salary: 4000,
        jobType: 'Side hustle',
        category: 'Tutoring',
        skills: ['Mathematics', 'Tutoring'],
        deadlineInDays: 21,
    },
    {
        title: 'Same-day parcel delivery around the city',
        description:
            'Deliver eight to ten small parcels across the city in one afternoon. You need your own motorcycle and a valid licence; fuel is reimbursed on top of the fee.',
        location: 'Davao City',
        salary: 1200,
        jobType: 'Short-term',
        category: 'Delivery',
        skills: ['Driving', 'Navigation'],
        deadlineInDays: 5,
    },
    {
        title: 'Fix a leaking kitchen sink',
        description:
            'The trap under the kitchen sink has been dripping for a week and the cabinet floor is starting to swell. Diagnose, replace what is needed, and check the connections either side.',
        location: 'Pasig',
        salary: 1500,
        jobType: 'Short-term',
        category: 'House Repairs',
        skills: ['Plumbing'],
        deadlineInDays: 10,
    },
    {
        title: 'Afternoon child care, school pickup',
        description:
            'Collect two children (ages 6 and 9) from school at 3pm, bring them home, prepare a snack, and supervise homework until 6pm. Weekdays only, for one school term.',
        location: 'Taguig',
        salary: 6000,
        jobType: 'Side hustle',
        category: 'Child Care',
        skills: ['Child care'],
        deadlineInDays: 30,
    },
    {
        title: 'Set up a new laptop and migrate files',
        description:
            'Move documents, photos and email from an eight-year-old Windows laptop to a new one, install the usual office software, and show the owner where everything ended up.',
        location: 'Mandaluyong',
        salary: 900,
        jobType: 'Short-term',
        category: 'Tech Assistance',
        skills: ['Windows', 'Data migration'],
        deadlineInDays: 9,
    },
    {
        title: 'Repaint a small storefront',
        description:
            'Two coats on a 20sqm storefront, including light sanding and masking the glazing. Paint is already bought and on site; work must happen on a Sunday when the shop is closed.',
        location: 'Caloocan',
        salary: 3200,
        jobType: 'Short-term',
        category: 'Painting',
        skills: ['Painting'],
        deadlineInDays: 18,
    },
];

async function main() {
    if (!config.MONGO_URI) {
        throw new Error('MONGO_URI is not configured. Set it in server/.env before seeding.');
    }

    await mongoose.connect(config.MONGO_URI, { dbName: config.DB_NAME, serverSelectionTimeoutMS: 10000 });
    console.log(`Connected to ${config.DB_NAME}.`);

    if (remove) {
        const { deletedCount } = await Job.deleteMany({ title: { $in: DEMO_JOBS.map((job) => job.title) } });
        console.log(`Removed ${deletedCount} seeded job(s).`);
        return;
    }

    // Any existing account can own these; preferring an employer-capable one
    // keeps the board consistent with what the app would have produced itself.
    const poster =
        (await User.findOne({ role: { $in: ['hire', 'both', 'employer'] } }).select('_id email').lean()) ||
        (await User.findOne().select('_id email').lean());

    if (!poster) {
        throw new Error(
            'No users exist to own these jobs. Start the dev server once so the superadmin is seeded, then re-run.',
        );
    }
    console.log(`Posting as ${poster.email}.`);

    const categories = await Category.find().select('_id name').lean();
    const categoryByName = new Map(categories.map((category) => [category.name, category._id]));

    let created = 0;
    let updated = 0;
    for (const demo of DEMO_JOBS) {
        const categoryId = categoryByName.get(demo.category) || null;
        if (!categoryId) {
            console.warn(`  category "${demo.category}" not found — posting "${demo.title}" uncategorised.`);
        }

        const result = await Job.findOneAndUpdate(
            { title: demo.title },
            {
                $set: {
                    title: demo.title,
                    description: demo.description,
                    location: demo.location,
                    salary: demo.salary,
                    jobType: demo.jobType,
                    deadline: daysFromNow(demo.deadlineInDays),
                    skills: demo.skills,
                    status: 'Available',
                    category: categoryId,
                    jobPoster: poster._id,
                },
            },
            { upsert: true, new: true, rawResult: true },
        );

        if (result?.lastErrorObject?.upserted) created += 1;
        else updated += 1;
    }

    const open = await Job.countDocuments({ status: 'Available' });
    console.log(`Seeded ${created} new, refreshed ${updated}. ${open} job(s) now open.`);
}

main()
    .catch((error) => {
        console.error(`Seeding failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
