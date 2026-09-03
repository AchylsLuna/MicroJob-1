import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { handleWebhook } from '../../controllers/PaymentController.js';
import sanitize from '../../middleware/sanitize.js';

/**
 * PayMongo signs the exact bytes it puts on the wire. This handler used to
 * recompute the HMAC over `JSON.stringify(req.body)`, which is not those bytes:
 * the global sanitize middleware rewrites req.body first, stripping any key
 * that starts with `$` or contains `.`, and re-serializing is not guaranteed to
 * reproduce the original encoding even when nothing is stripped. A mismatch
 * rejects genuine webhooks, and a rejected top-up webhook means a customer paid
 * and was never credited -- silent, and only visible in production.
 *
 * The handler now verifies against `req.rawBody`, captured by the express.json
 * `verify` hook in app.js before any middleware can touch the parsed body.
 */

const SECRET = 'whsec_test_secret_value';
let previousSecret;

before(() => {
  previousSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  process.env.PAYMONGO_WEBHOOK_SECRET = SECRET;
});

after(() => {
  if (previousSecret === undefined) delete process.env.PAYMONGO_WEBHOOK_SECRET;
  else process.env.PAYMONGO_WEBHOOK_SECRET = previousSecret;
});

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  send(payload) { this.body = payload; return this; },
  json(payload) { this.body = payload; return this; },
});

const sign = (rawBody, timestamp) => crypto
  .createHmac('sha256', SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

/**
 * Builds a request the way the real stack does: raw bytes captured at parse
 * time, then req.body parsed and passed through the sanitize middleware, so
 * any divergence between the two is reproduced here rather than assumed away.
 */
const buildRequest = (payload, { timestamp = Math.floor(Date.now() / 1000), signature } = {}) => {
  const rawBody = JSON.stringify(payload);
  const req = {
    headers: {},
    rawBody: Buffer.from(rawBody, 'utf8'),
    body: JSON.parse(rawBody),
    get(name) { return this.headers[String(name).toLowerCase()]; },
  };
  req.headers['paymongo-signature'] = `t=${timestamp},te=${signature ?? sign(rawBody, timestamp)}`;
  sanitize(req, response(), () => {});
  return req;
};

/** An event type the handler acknowledges without any database work. */
const benignEvent = (extra = {}) => ({
  data: { attributes: { type: 'checkout_session.payment.failed', ...extra } },
});

const call = async (req) => {
  const res = response();
  await handleWebhook(req, res);
  return res;
};

test('a correctly signed webhook is accepted', async () => {
  const res = await call(buildRequest(benignEvent()));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'Webhook received');
});

test('a tampered body is rejected', async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const req = buildRequest(benignEvent(), { timestamp });
  // Signature was computed over the original bytes; swap them for others.
  req.rawBody = Buffer.from(JSON.stringify({ data: { attributes: { type: 'tampered' } } }), 'utf8');

  const res = await call(req);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /Invalid signature/);
});

test('a forged signature is rejected', async () => {
  const res = await call(buildRequest(benignEvent(), { signature: 'f'.repeat(64) }));

  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /Invalid signature/);
});

/**
 * The regression guard for the actual bug. Sanitize strips `weird.key` from
 * req.body, so a handler verifying against JSON.stringify(req.body) computes a
 * digest over a payload the sender never sent and rejects a genuine webhook.
 * Verifying against rawBody is unaffected.
 */
test('a payload the sanitizer would rewrite still verifies', async () => {
  const req = buildRequest(benignEvent({ 'weird.key': 'dropped-by-sanitize' }));

  // Precondition: sanitize really did rewrite the parsed body.
  assert.ok(!('weird.key' in req.body.data.attributes), 'sanitize should strip the dotted key');
  // ...but the raw bytes, and therefore the signature, still include it.
  assert.match(req.rawBody.toString('utf8'), /weird\.key/);

  const res = await call(req);
  assert.equal(res.statusCode, 200, 'a genuine webhook must not be rejected');
});

test('a payload containing a $-prefixed key still verifies', async () => {
  const req = buildRequest(benignEvent({ $set: 'dropped-by-sanitize' }));

  assert.ok(!('$set' in req.body.data.attributes));
  const res = await call(req);
  assert.equal(res.statusCode, 200);
});

test('a missing signature header is rejected', async () => {
  const req = buildRequest(benignEvent());
  delete req.headers['paymongo-signature'];

  const res = await call(req);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /No signature/);
});

test('a malformed signature header is rejected', async () => {
  const req = buildRequest(benignEvent());
  req.headers['paymongo-signature'] = 'not-a-valid-header';

  const res = await call(req);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /malformed/);
});

/** Replay protection: a captured webhook must not stay valid indefinitely. */
test('an expired timestamp is rejected', async () => {
  const stale = Math.floor(Date.now() / 1000) - 600;
  const res = await call(buildRequest(benignEvent(), { timestamp: stale }));

  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /timestamp/);
});

test('a future timestamp beyond the window is rejected', async () => {
  const ahead = Math.floor(Date.now() / 1000) + 600;
  const res = await call(buildRequest(benignEvent(), { timestamp: ahead }));

  assert.equal(res.statusCode, 400);
});

test('a request with no raw body is rejected rather than trusted', async () => {
  const req = buildRequest(benignEvent());
  req.rawBody = undefined;

  const res = await call(req);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /raw body/);
});

test('an unconfigured webhook secret fails closed', async () => {
  const req = buildRequest(benignEvent());
  delete process.env.PAYMONGO_WEBHOOK_SECRET;
  try {
    const res = await call(req);
    assert.equal(res.statusCode, 500);
    assert.match(String(res.body), /misconfigured/);
  } finally {
    process.env.PAYMONGO_WEBHOOK_SECRET = SECRET;
  }
});
