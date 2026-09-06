# Database ObjectId Guard

Reference for the tooling that repairs and protects against the string-`_id`
corruption. Run everything from the `server/` directory.

## The commands

| Command | What it does |
| --- | --- |
| `npm run db:check-ids` | Read-only scan. Reports how many `_id` and reference values are stored as strings. Changes nothing. |
| `npm run db:repair-ids` | Converts every string `_id` and reference back to a real ObjectId. |
| `npm run db:guard` | Installs the MongoDB validators that make the corruption impossible. Run after any restore. |

Targeting another database, or taking a backup first:

```bash
# Dry run against a different database
node scripts/migrateStringIdsToObjectIds.js --db=MicroJobProd

# Repair with a JSON backup written first
node scripts/migrateStringIdsToObjectIds.js --backup=../backup --apply

# Install guards on another database
node scripts/enforceObjectIdValidators.js --db=MicroJobProd --apply

# Remove the guards again
node scripts/enforceObjectIdValidators.js --remove --apply
```

Both scripts are **dry-run by default** and require `--apply` to write. Both are
idempotent — running twice is safe.

## What went wrong

The `MicroJob` database was populated by a JSON import (a Compass /
`mongoimport` load where `{"$oid": "..."}` was flattened into a plain string).
Every `_id` and every reference field ended up stored as a String instead of an
ObjectId.

Reads by any other field kept working, so nothing looked broken. The damage only
appeared on a **write**: mongoose hydrates the string `_id` into a real ObjectId
per the schema, then `doc.save()` issues `updateOne({ _id: ObjectId(...) })`,
which matches nothing:

```
DocumentNotFoundError: No document found for query "{ _id: new ObjectId('…') }" on model "User"
  result: { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
```

Every `save()` on an existing document failed — OTP verification, login lockout,
profile edits, password resets. It was repaired on 2026-09-06: 376 `_id` values
and 472 reference values converted.

## How it is prevented now

Because the corruption came from outside the application, no application code
could stop it — only the database can refuse the write. All 30 collections carry
a `$jsonSchema` validator requiring `_id` to be an `objectId`, plus the same
requirement on every reference field the model declares as an ObjectId. A bad
import now fails immediately with error **121** (`DocumentValidationFailure`)
instead of silently poisoning the data.

### The catch worth remembering

Validators live *on* the collection, so **`mongoimport --drop` and
`mongorestore --drop` delete them along with it.** After any restore, re-run:

```bash
npm run db:guard
```

As a backstop, the server checks at startup (`server/lib/dataIntegrity.js`) and
warns, naming any collection that has lost its guard:

```
ObjectId validators are missing on 2 collection(s): users, sessions.
  A restore that drops collections removes them. Re-run:
    node scripts/enforceObjectIdValidators.js --apply
```

Re-run `npm run db:guard` after adding a new model, too, so its collection is
covered from the start.

### Limits

Validators constrain top-level fields only — `$jsonSchema` cannot express "every
element of this array of subdocuments." The repair script *does* handle those
nested paths. In practice `_id` is the field that breaks `save()`, so the case
that matters is covered.

## Files

| Path | Purpose |
| --- | --- |
| `server/scripts/migrateStringIdsToObjectIds.js` | Repairs corrupted data |
| `server/scripts/enforceObjectIdValidators.js` | Installs / removes the validators |
| `server/lib/dataIntegrity.js` | Startup check for missing validators |
| `server/lib/schemaObjectIdPaths.js` | Shared schema walking used by both scripts |
| `server/tests/lib/dataIntegrity.test.js` | Tests for detection, rejection, and the startup check |

## Status

- `MicroJob` — repaired and guarded (30/30 collections).
- `MicroJobProd` — **not yet checked.** Likely has the same corruption. Start
  with `node scripts/migrateStringIdsToObjectIds.js --db=MicroJobProd` (read-only).
