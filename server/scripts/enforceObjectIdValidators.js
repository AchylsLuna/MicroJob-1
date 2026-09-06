/**
 * Installs MongoDB schema validators that make a repeat of the string-_id
 * corruption impossible.
 *
 * The corruption this guards against came from outside the application — a JSON
 * import where {"$oid": "..."} was flattened into a plain string — so no amount
 * of application code can prevent it. Only the database can refuse the write.
 * Each collection gets a $jsonSchema requiring _id to be a real objectId, plus
 * the same requirement on every reference field the model declares as an
 * ObjectId. An import carrying strings now fails loudly at write time instead of
 * silently poisoning the data until the next save() throws
 * DocumentNotFoundError.
 *
 * Reference fields allow null and missing values, so optional relationships and
 * documents written before a field existed are unaffected.
 *
 * Caveat worth knowing: validators live on the collection, so `mongoimport
 * --drop` removes them along with the collection. The startup check in
 * lib/dataIntegrity.js catches that case; re-run this script after any restore.
 *
 * Usage:
 *   node scripts/enforceObjectIdValidators.js                  # dry run
 *   node scripts/enforceObjectIdValidators.js --apply          # install
 *   node scripts/enforceObjectIdValidators.js --apply --db=X   # explicit db
 *   node scripts/enforceObjectIdValidators.js --remove --apply # uninstall
 */
import path from 'path';

import 'dotenv/config';
import mongoose from 'mongoose';

import { loadModelsByCollection, objectIdPaths } from '../lib/schemaObjectIdPaths.js';

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flagValue = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const apply = hasFlag('apply');
const remove = hasFlag('remove');
const dbName = flagValue('db') || process.env.DB_NAME || 'MicroJob';

/**
 * Builds the $jsonSchema for one collection. Only top-level scalar reference
 * fields are constrained: $jsonSchema cannot express "every element of this
 * array of subdocuments", and _id is the field that actually breaks save().
 */
const buildValidator = (refPaths) => {
  const properties = {};

  for (const { path: dotted, array } of refPaths) {
    if (dotted.includes('[]') || dotted.includes('.')) continue;
    properties[dotted] = array
      ? { bsonType: 'array', items: { bsonType: ['objectId', 'null'] } }
      : { bsonType: ['objectId', 'null'] };
  }

  return {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id'],
      properties: {
        _id: { bsonType: 'objectId', description: '_id must be an ObjectId, never a string' },
        ...properties,
      },
    },
  };
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set.');
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName });
  const db = mongoose.connection.db;
  console.log(`Database: ${db.databaseName}`);
  console.log(remove ? 'Action: REMOVE validators' : 'Action: INSTALL validators');
  console.log(apply ? 'Mode: APPLY\n' : 'Mode: DRY RUN (no writes)\n');

  const models = await loadModelsByCollection(mongoose, path.join(import.meta.dirname, '..', 'models'));
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray())
      .filter((c) => c.type !== 'view')
      .map((c) => c.name)
  );

  // Every collection gets the _id guard, including ones left behind by a
  // removed model — an unguarded collection is exactly where the next bad
  // import would land. Reference fields are only guarded where a model
  // describes them.
  const targets = [...new Set([...models.keys(), ...existing])].sort();

  let changed = 0;

  for (const collectionName of targets) {
    const model = models.get(collectionName);
    const refPaths = model ? objectIdPaths(model.schema) : [];
    const guarded = Object.keys(buildValidator(refPaths).$jsonSchema.properties).length - 1;

    if (!apply) {
      console.log(`${collectionName.padEnd(24)} _id + ${guarded} reference field(s)`);
      changed += 1;
      continue;
    }

    // collMod only works on a collection that exists; create it otherwise so the
    // guard is in place before the first document lands.
    if (!existing.has(collectionName)) {
      await db.createCollection(collectionName);
    }

    await db.command({
      collMod: collectionName,
      validator: remove ? {} : buildValidator(refPaths),
      validationLevel: remove ? 'off' : 'strict',
      validationAction: remove ? 'warn' : 'error',
    });

    console.log(`${collectionName.padEnd(24)} ${remove ? 'validator removed' : `guarded (_id + ${guarded} ref field(s))`}`);
    changed += 1;
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${changed} collection(s).`);
  if (!apply) {
    console.log('\nRe-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
