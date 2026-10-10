// Shapes Category documents for the wire. Mirrors the role reviewPresentation.js
// plays for reviews, and exists because two controllers answer with categories:
// CategoryController (the public /api/categories list plus admin create/edit)
// and AdminController (/api/admin/categories). Both previously handed back the
// raw Mongoose document, so `__v` -- an internal revision counter no client
// reads -- went out on every response, and any field added to CategorySchema
// later would have started leaking the moment it was declared.
//
// The `_id` a caller sees is an opaque token from publicId.js, not the stored
// ObjectId. The key keeps its name because the client already treats it as
// "the category's identifier" in a dozen places -- it is submitted when posting
// a job, sent as the `?category=` search param, and used to key admin job
// counts -- and renaming it would churn every one of those for no behavioural
// gain. What changed is the value: it no longer carries the creation timestamp
// or counter that an ObjectId encodes.
//
// Anything accepting a category id back from a client must therefore run it
// through resolveCategoryId first. A token that is malformed, or minted under
// a different key, resolves to null, which callers must treat as "no such
// category" rather than passing on to a query.
import { decodePublicId, encodePublicId } from './publicId.js';

/** Projection for Category queries, so unlisted fields are never fetched. */
export const CATEGORY_PUBLIC_FIELDS = '_id name order';

export function serializeCategory(category) {
  if (!category) return null;
  return {
    _id: encodePublicId(category._id),
    name: category.name,
    order: category.order,
  };
}

export function serializeCategories(categories) {
  return (Array.isArray(categories) ? categories : []).map(serializeCategory);
}

/**
 * Public token -> stored ObjectId hex, or null when it does not decode.
 *
 * Also accepts a raw 24-character ObjectId. That is deliberate: server-side
 * callers (seeds, backfills, the recommendation engine) already hold real ids,
 * and admin tooling or a saved link may still carry one from before this
 * change. It widens nothing a client could exploit, since knowing a category
 * ObjectId only ever identified a public category.
 */
export function resolveCategoryId(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^[0-9a-f]{24}$/i.test(raw)) return raw;
  return decodePublicId(raw);
}

/**
 * Encodes the category id carried inside a job payload.
 *
 * Jobs embed their category through `.populate('category', 'name')`, so the
 * ObjectId would still reach the client there even with the category
 * endpoints cleaned up. It also has to agree with the categories list: the
 * client preselects a job's category when editing by matching this value
 * against the `<option>` values (postJobForm), and admin keys per-category job
 * counts by it (useAdminData). If the two disagreed, editing a job would show
 * no category selected and the admin counts would all read zero.
 *
 * Handles both shapes a job can carry -- a populated `{ _id, name }` object
 * and a bare id -- and is deliberately idempotent: encodePublicId only accepts
 * 24-character hex, so a value that has already been encoded is left alone
 * rather than being double-encoded into null.
 */
export function withPublicCategory(job) {
  const category = job?.category;
  if (!category) return job;

  // A populated document carries a nested `_id`; a bare ObjectId is also
  // typeof "object" but has none, so test for the field rather than the type.
  if (typeof category === 'object' && category._id && category.name !== undefined) {
    const encoded = encodePublicId(category._id);
    return encoded ? { ...job, category: { ...category, _id: encoded } } : job;
  }

  const encoded = encodePublicId(category);
  return encoded ? { ...job, category: encoded } : job;
}

export function withPublicCategories(jobs) {
  return Array.isArray(jobs) ? jobs.map(withPublicCategory) : jobs;
}
