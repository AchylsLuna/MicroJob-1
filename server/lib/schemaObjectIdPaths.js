/**
 * Schema introspection shared by the ObjectId data tools in scripts/.
 *
 * Mongoose renamed both of these between major versions: ObjectId paths report
 * their instance as 'ObjectID' before v9 and 'ObjectId' from v9 on, and arrays
 * expose their element type as `caster` before v9 and `embeddedSchemaType`
 * from v9 on. Both spellings are accepted so the tools survive an upgrade.
 */

const isObjectIdInstance = (instance) => instance === 'ObjectID' || instance === 'ObjectId';

/**
 * Returns the dotted paths of every ObjectId in a schema, descending into
 * nested paths, arrays of ObjectIds, and subdocument arrays. Hops through a
 * subdocument array are marked with a trailing `[]` so callers know to map over
 * the array rather than index it directly.
 */
export const objectIdPaths = (schema, prefix = '') => {
  const paths = [];

  schema.eachPath((name, type) => {
    if (name === '_id' || name === '__v') return;
    const full = prefix ? `${prefix}.${name}` : name;

    if (isObjectIdInstance(type.instance)) {
      paths.push({ path: full, array: false });
      return;
    }

    const element = type.embeddedSchemaType ?? type.caster;
    if (type.instance === 'Array' && isObjectIdInstance(element?.instance)) {
      paths.push({ path: full, array: true });
      return;
    }

    if (type.schema) {
      paths.push(...objectIdPaths(type.schema, `${full}[]`));
    }
  });

  return paths;
};

/** Loads every model file so mongoose knows about them, keyed by collection name. */
export const loadModelsByCollection = async (mongoose, modelsDir) => {
  const fs = await import('fs/promises');
  const path = await import('path');

  const files = (await fs.readdir(modelsDir)).filter((file) => file.endsWith('.js'));
  await Promise.all(files.map((file) => import(path.join(modelsDir, file))));

  const byCollection = new Map();
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    byCollection.set(model.collection.collectionName, model);
  }
  return byCollection;
};
