// Opaque public identifiers.
//
// Mongo ObjectIds are not secrets, and exposing one is not itself a
// vulnerability -- authorisation is what stops a caller reaching another
// person's record. They do, however, carry a creation timestamp in their first
// four bytes and an incrementing counter in their last three, so a client that
// sees them learns when a row was made and roughly how many neighbours it has.
// These helpers keep that detail server-side.
//
// The transform is *encryption, not hashing*, which is the whole point: an
// HMAC is one-way, so every request carrying a public id back would have to
// scan the collection to find the row whose digest matched. A reversible token
// decodes in process, so accepting one costs nothing and no lookup is needed.
//
// AES-256-ECB looks alarming and is usually the wrong choice, so to be explicit
// about why it is right here: ECB's weakness is that equal plaintext blocks
// produce equal ciphertext blocks, leaking structure across a long message. The
// plaintext here is a single 16-byte block holding one identifier, so there is
// no second block to correlate with. Determinism is a hard requirement rather
// than a flaw -- a given row must always present the same id, or React keys,
// caches and bookmarked URLs would all break -- which rules out the usual
// randomised-IV modes. The value is an identifier, not a secret: the aim is to
// remove the timestamp and counter, not to provide confidentiality.
import crypto from 'node:crypto';

const OBJECT_ID_BYTES = 12;
const BLOCK_BYTES = 16;

/**
 * Rotating this secret invalidates every public id already handed out, so any
 * bookmarked URL carrying one stops resolving. It is derived from JWT_SECRET
 * when unset so existing deployments keep working without new configuration;
 * set PUBLIC_ID_SECRET explicitly to decouple the two.
 */
function getKey() {
  const secret = process.env.PUBLIC_ID_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_ID_SECRET or JWT_SECRET must be set to encode public ids.');
    }
    // Development only: a fixed key keeps ids stable across restarts so a
    // reloaded page does not invalidate the ids already on screen.
    return crypto.createHash('sha256').update('microjobs-dev-public-id').digest();
  }
  // sha256 gives the exact 32 bytes aes-256 wants from a secret of any length.
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * ObjectId (or its hex string) -> a 22-character base64url token.
 * Returns null for empty input so callers can pass optional values straight in.
 */
export function encodePublicId(value) {
  if (!value) return null;
  const hex = String(value?._id || value);
  if (!/^[0-9a-f]{24}$/i.test(hex)) return null;

  const block = Buffer.alloc(BLOCK_BYTES);
  Buffer.from(hex, 'hex').copy(block);

  const cipher = crypto.createCipheriv('aes-256-ecb', getKey(), null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]).toString('base64url');
}

/**
 * Token -> the 24-character hex ObjectId string, or null when the token is
 * malformed or was not produced by this key. Callers must treat null as "no
 * such record" rather than passing it to a query.
 */
export function decodePublicId(token) {
  if (!token || typeof token !== 'string') return null;

  let block;
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length !== BLOCK_BYTES) return null;
    const decipher = crypto.createDecipheriv('aes-256-ecb', getKey(), null);
    decipher.setAutoPadding(false);
    block = Buffer.concat([decipher.update(bytes), decipher.final()]);
  } catch {
    // Any malformed token lands here; it is an invalid id, not a server fault.
    return null;
  }

  // The four padding bytes must still be zero, which is what makes a token
  // forged under a different key fail instead of decoding to a random id.
  if (block.length !== BLOCK_BYTES || block.subarray(OBJECT_ID_BYTES).some((byte) => byte !== 0)) {
    return null;
  }
  return block.subarray(0, OBJECT_ID_BYTES).toString('hex');
}
