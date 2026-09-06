/**
 * Repairs a database whose ObjectIds were flattened into strings.
 *
 * A JSON import (Compass / mongoimport of an export where {"$oid": "..."} became
 * a plain string) leaves every _id and every reference field stored as a String.
 * Reads by other fields still work, so the damage is invisible until a write:
 * mongoose hydrates the string _id into an ObjectId per the schema, then
 * `doc.save()` issues updateOne({ _id: ObjectId(...) }), which matches nothing
 * and throws DocumentNotFoundError. Every save() on an affected document fails.
 *
 * This script converts, for each collection:
 *   1. string _id values into ObjectIds, preserving the same 24-hex value so
 *      existing references keep pointing at the same document, and
 *   2. every schema path declared as an ObjectId whose stored value is a string.
 *
 * _id is immutable, so (1) is done as delete + insert of the same document.
 *
 * Usage:
 *   node scripts/migrateStringIdsToObjectIds.js                  # dry run
 *   node scripts/migrateStringIdsToObjectIds.js --apply          # write
 *   node scripts/migrateStringIdsToObjectIds.js --apply --db=X   # explicit db
 *   node scripts/migrateStringIdsToObjectIds.js --backup=dir     # JSON backup
 */
import fs from 'fs/promises';
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
const backupDir = flagValue('backup');
const dbName = flagValue('db') || process.env.DB_NAME || 'MicroJob';

const HEX_24 = /^[0-9a-fA-F]{24}$/;
const isConvertible = (value) => typeof value === 'string' && HEX_24.test(value);

/** Writes every convertible string at a dotted path, returning how many changed. */
const convertPath = (doc, parts) => {
  if (!doc || typeof doc !== 'object') return 0;
  const [head, ...rest] = parts;
  const isArrayHop = head.endsWith('[]');
  const key = isArrayHop ? head.slice(0, -2) : head;

  if (rest.length) {
    const value = doc[key];
    if (isArrayHop) {
      if (!Array.isArray(value)) return 0;
      return value.reduce((sum, item) => sum + convertPath(item, rest), 0);
    }
    return convertPath(value, rest);
  }

  const value = doc[key];
  if (Array.isArray(value)) {
    let changed = 0;
    value.forEach((item, index) => {
      if (isConvertible(item)) {
        value[index] = new mongoose.Types.ObjectId(item);
        changed += 1;
      }
    });
    return changed;
  }
  if (isConvertible(value)) {
    doc[key] = new mongoose.Types.ObjectId(value);
    return 1;
  }
  return 0;
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set.');
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName });
  const db = mongoose.connection.db;
  console.log(`Database: ${db.databaseName}`);
  console.log(apply ? 'Mode: APPLY (writing changes)\n' : 'Mode: DRY RUN (no writes)\n');

  const models = await loadModelsByCollection(mongoose, path.join(import.meta.dirname, '..', 'models'));
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();

  if (backupDir) {
    await fs.mkdir(backupDir, { recursive: true });
    for (const name of collections) {
      const docs = await db.collection(name).find({}).toArray();
      await fs.writeFile(
        path.join(backupDir, `${name}.json`),
        JSON.stringify(docs, null, 2)
      );
    }
    console.log(`Backed up ${collections.length} collections to ${backupDir}\n`);
  }

  let totalIds = 0;
  let totalRefs = 0;
  const skipped = [];

  for (const name of collections) {
    const collection = db.collection(name);
    const model = models.get(name);
    const refPaths = model ? objectIdPaths(model.schema) : [];

    const stringIdDocs = await collection.find({ _id: { $type: 'string' } }).toArray();
    let idCount = 0;

    for (const doc of stringIdDocs) {
      if (!isConvertible(doc._id)) {
        skipped.push(`${name}: _id ${JSON.stringify(doc._id)} is not a 24-hex id`);
        continue;
      }
      idCount += 1;
      if (!apply) continue;

      const oldId = doc._id;
      const replacement = { ...doc, _id: new mongoose.Types.ObjectId(oldId) };
      await collection.deleteOne({ _id: oldId });
      try {
        await collection.insertOne(replacement);
      } catch (error) {
        await collection.insertOne(doc); // put the original back before failing
        throw new Error(`Failed converting ${name} _id ${oldId}: ${error.message}`);
      }
    }

    // Reference fields are converted after _id so both sides end up as ObjectIds
    // holding the same hex value, keeping every relationship intact.
    let refCount = 0;
    if (refPaths.length) {
      for await (const doc of collection.find({})) {
        let changed = 0;
        for (const { path: dotted } of refPaths) {
          changed += convertPath(doc, dotted.split('.'));
        }
        if (!changed) continue;
        refCount += changed;
        if (apply) {
          const { _id, ...rest } = doc;
          await collection.replaceOne({ _id }, { _id, ...rest });
        }
      }
    }

    totalIds += idCount;
    totalRefs += refCount;
    if (idCount || refCount) {
      console.log(`${name.padEnd(24)} _id:${String(idCount).padStart(4)}  refs:${String(refCount).padStart(4)}`);
    }
  }

  console.log(`\n${apply ? 'Converted' : 'Would convert'} ${totalIds} _id values and ${totalRefs} reference values.`);
  if (skipped.length) {
    console.log('\nSkipped (manual review needed):');
    for (const line of skipped) console.log(`  ${line}`);
  }
  if (!apply) {
    console.log('\nRe-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
