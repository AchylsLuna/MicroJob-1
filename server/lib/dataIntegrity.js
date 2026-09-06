import mongoose from 'mongoose';

/**
 * Startup backstop for the string-_id corruption.
 *
 * scripts/enforceObjectIdValidators.js installs collection validators that make
 * the database reject non-ObjectId _id values. Those validators are part of the
 * collection, though, so a restore that drops collections first (`mongoimport
 * --drop`, `mongorestore --drop`) silently takes them with it and leaves the
 * database open to the same corruption again.
 *
 * This check runs once at startup and reports, in one round trip, which
 * collections have lost their guard. It only warns: a missing validator is a
 * reason to re-run the script, not a reason to refuse to serve.
 */

export const checkObjectIdValidators = async (connection = mongoose.connection) => {
  const db = connection?.db;
  if (!db) return { checked: 0, unguarded: [] };

  const collections = await db.listCollections({}, { nameOnly: false }).toArray();

  const unguarded = collections
    .filter(
      (collection) =>
        collection.type !== 'view' && !collection.options?.validator?.$jsonSchema?.properties?._id
    )
    .map((collection) => collection.name);

  if (unguarded.length) {
    console.warn(
      `ObjectId validators are missing on ${unguarded.length} collection(s): ${unguarded.join(', ')}.\n` +
        '  A restore that drops collections removes them. Re-run:\n' +
        '    node scripts/enforceObjectIdValidators.js --apply'
    );
  }

  return { checked: collections.length, unguarded };
};
