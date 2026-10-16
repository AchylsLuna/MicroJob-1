import { expect, test, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

/**
 * The demo clickpath: post a job -> apply -> offer -> accept -> confirm hire
 * -> authorize payment -> submit work -> approve & pay.
 *
 * This is the flow the capstone is actually demoed on, and until now it had
 * zero automated coverage: the server-side unit tests exercise settlement in
 * isolation, but nothing drove the real HTTP stack end to end. Two things had
 * to be true before this spec could exist at all --
 *
 *  1. every step below runs inside `mongoose.startSession()` /
 *     `withTransaction`, which needs a replica set. The in-memory Mongo used
 *     by the e2e harness was standalone until `server/lib/db.js` switched to
 *     `MongoMemoryReplSet`, so these calls would have 500'd.
 *  2. funding an employer wallet normally requires a real PayMongo checkout,
 *     which an isolated sandbox cannot perform. The NODE_ENV=test-only
 *     `/auth/debug/credit-wallet` endpoint credits the balance directly.
 *
 * It drives the API rather than the UI on purpose. The money path's risk lives
 * in escrow arithmetic and transactional state transitions, not in button
 * placement, and an API-level walk asserts those directly instead of inferring
 * them from rendered text. The UI over these same endpoints is covered by
 * `core-roles.spec.ts` and by the manual freeze checklist.
 */

const EMPLOYER = { email: "e2e-user@microjobs.local", password: "ReviewPass123!" };
const WORKER = {
  email: "e2e-clickpath-worker@microjobs.local",
  password: "ReviewPass123!",
  firstName: "Clickpath",
  lastName: "Worker",
  phoneNumber: "09171230001",
};

/** sendSuccess() nests its payload under `.data`; raw request calls see the wire shape. */
const unwrap = async (response: { json: () => Promise<any> }) => {
  const body = await response.json();
  return body?.data ?? body;
};

/**
 * Every mutating route is behind double-submit CSRF: the `csrfToken` cookie
 * has to be echoed back in the `x-csrf-token` header (see
 * `server/middleware/csrf.js`). The browser client does this automatically;
 * a raw APIRequestContext has to do it by hand.
 */
async function csrfHeaders(context: APIRequestContext) {
  const { cookies } = await context.storageState();
  const token = cookies.find((cookie) => cookie.name === "csrfToken")?.value;
  expect(token, "expected a csrfToken cookie after signing in").toBeTruthy();
  return { "x-csrf-token": String(token) };
}

/**
 * Both roles are gated on having a profile photo -- employers before posting
 * (`EMPLOYER_PROFILE_INCOMPLETE`) and workers before applying
 * (`WORKER_PROFILE_INCOMPLETE`). `avatarUrl` is not settable through
 * PATCH /auth/me, which has a strict field allowlist, so this goes through the
 * real multipart upload endpoint, exactly as the app does.
 */
async function uploadAvatar(context: APIRequestContext, headers: Record<string, string>) {
  const response = await context.post("/api/auth/profile/avatar", {
    headers,
    multipart: {
      avatar: {
        name: "avatar.png",
        mimeType: "image/png",
        // Smallest valid PNG: a single transparent pixel.
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        ),
      },
    },
  });
  expect(response.ok(), `avatar upload failed: ${await response.text()}`).toBeTruthy();
}

/**
 * Password + the mandatory email OTP.
 *
 * This used to post the password alone and rely on the server's no-OTP branch,
 * which was reachable simply by omitting `requireOtp` from the body. That made
 * the second factor client-controlled, so `AuthController.loginUser` now always
 * challenges unless the request carries a server-issued trusted-device token.
 * The code is read from the NODE_ENV=test-only `/auth/debug/login-otp`
 * endpoint, the same way `auth.setup.ts` does.
 */
async function signIn(context: APIRequestContext, email: string, password: string) {
  const response = await context.post("/api/auth/login", { data: { emailOrUsername: email, password } });
  expect(response.ok(), `login failed for ${email}: ${await response.text()}`).toBeTruthy();

  const body = await unwrap(response);
  // A trusted device short-circuits the challenge, which is a legitimate
  // outcome -- there is nothing to clear in that case.
  if (!body?.otpRequired) return;

  const otpResponse = await context.get(`/api/auth/debug/login-otp?email=${encodeURIComponent(email)}`);
  const code = String((await unwrap(otpResponse))?.code || "");
  expect(code, "debug login-OTP endpoint should return a six-digit code").toMatch(/^\d{6}$/);

  const verify = await context.post("/api/auth/login/otp/verify", {
    data: { otpToken: body.otpToken, code },
  });
  expect(verify.ok(), `login OTP verify failed for ${email}: ${await verify.text()}`).toBeTruthy();
}

/** Registers and email-verifies a fresh worker. The harness blanks every SMTP
 *  credential, so the code is read from the NODE_ENV=test-only
 *  `/auth/debug/signup-otp` endpoint -- it is deliberately no longer returned
 *  in the `/otp/send` response body, where it was an account-takeover
 *  primitive on any non-production deploy. */
async function registerWorker(context: APIRequestContext) {
  const registration = await context.post("/api/auth/register", {
    data: {
      firstName: WORKER.firstName,
      lastName: WORKER.lastName,
      email: WORKER.email,
      password: WORKER.password,
      phoneNumber: WORKER.phoneNumber,
      role: "work",
    },
  });
  // A re-run against a warm database is fine -- an existing account falls
  // through to sign-in. Any other failure is surfaced rather than swallowed,
  // so a contract change here cannot masquerade as a login problem.
  if (!registration.ok()) {
    const body = await registration.text();
    expect(body, `unexpected registration failure: ${body}`).toMatch(/already|exists|taken/i);
  }
  if (registration.ok()) {
    const otpSend = await context.post("/api/auth/otp/send", { data: { email: WORKER.email } });
    expect(otpSend.ok(), `otp send failed: ${await otpSend.text()}`).toBeTruthy();
    const otpRead = await context.get(`/api/auth/debug/signup-otp?email=${encodeURIComponent(WORKER.email)}`);
    const code = String((await unwrap(otpRead))?.code || "");
    expect(code, "debug signup-OTP endpoint should return a six-digit code").toMatch(/^\d{6}$/);
    const verify = await context.post("/api/auth/otp/verify", { data: { email: WORKER.email, code } });
    expect(verify.ok(), `otp verify failed: ${await verify.text()}`).toBeTruthy();
    return;
  }
  await signIn(context, WORKER.email, WORKER.password);
}

test("demo clickpath: post job through to settled payout", async ({ baseURL }) => {
  test.setTimeout(120_000);

  const employer = await playwrightRequest.newContext({ baseURL });
  const worker = await playwrightRequest.newContext({ baseURL });

  try {
    const PAY = 500;

    // --- setup -------------------------------------------------------------
    await signIn(employer, EMPLOYER.email, EMPLOYER.password);
    await registerWorker(worker);

    const employerHeaders = await csrfHeaders(employer);
    const workerHeaders = await csrfHeaders(worker);

    // Company name is deliberately NOT required for either role -- only the
    // photo -- which is the Day 5 profile-gate relaxation.
    await uploadAvatar(employer, employerHeaders);
    await uploadAvatar(worker, workerHeaders);

    const credit = await employer.post("/api/auth/debug/credit-wallet", {
      headers: employerHeaders,
      data: { email: EMPLOYER.email, amount: PAY * 4 },
    });
    expect(credit.ok(), `wallet credit failed: ${await credit.text()}`).toBeTruthy();
    const balanceBefore = Number((await unwrap(credit)).employerBalance);
    expect(balanceBefore).toBeGreaterThanOrEqual(PAY);

    // --- 1. employer posts a job -------------------------------------------
    // `category` is validated against the categories collection, so it has to
    // be a real id rather than a display name.
    const categoriesResponse = await employer.get("/api/categories");
    expect(categoriesResponse.ok(), `categories fetch failed: ${await categoriesResponse.text()}`).toBeTruthy();
    const categoriesBody = await unwrap(categoriesResponse);
    const categories = Array.isArray(categoriesBody) ? categoriesBody : categoriesBody?.categories ?? [];
    expect(categories.length, "expected seeded job categories").toBeGreaterThan(0);
    const categoryId = String(categories[0]?._id);

    const jobResponse = await employer.post("/api/jobs", {
      headers: employerHeaders,
      data: {
        title: "E2E clickpath job",
        description: "Covers the full offer, hire, submit and settle path.",
        location: "Mayamot, City of Antipolo, Rizal",
        salary: PAY,
        jobType: "Short-term",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        category: categoryId,
        positionsNeeded: 1,
      },
    });
    expect(jobResponse.ok(), `job create failed: ${await jobResponse.text()}`).toBeTruthy();
    const job = await unwrap(jobResponse);
    const jobId = String(job?.job?._id || job?._id);
    expect(jobId).toBeTruthy();

    // --- 2. worker applies --------------------------------------------------
    const applyResponse = await worker.post(`/api/jobs/${jobId}/apply`, {
      headers: workerHeaders,
      data: { coverLetter: "Applying via the clickpath spec." },
    });
    expect(applyResponse.ok(), `apply failed: ${await applyResponse.text()}`).toBeTruthy();
    const application = await unwrap(applyResponse);
    const applicationId = String(application?.application?._id || application?._id);
    expect(applicationId).toBeTruthy();

    // --- 3. employer sends an offer ----------------------------------------
    const offerResponse = await employer.post(`/api/applications/${applicationId}/offers`, {
      headers: employerHeaders,
      data: { amount: PAY },
    });
    expect(offerResponse.ok(), `offer failed: ${await offerResponse.text()}`).toBeTruthy();
    // The offer controller serializes to `id`, not the raw `_id`.
    const offerId = String((await unwrap(offerResponse))?.offer?.id);
    expect(offerId).toBeTruthy();

    // --- 4. worker accepts --------------------------------------------------
    const accept = await worker.post(`/api/job-offers/${offerId}/respond`, { headers: workerHeaders, data: { action: "accept", policyAcknowledged: true } });
    expect(accept.ok(), `accept failed: ${await accept.text()}`).toBeTruthy();
    expect((await unwrap(accept))?.offer?.status).toBe("accepted");

    // --- 5. employer confirms the hire (reserves escrow) --------------------
    const hire = await employer.post(`/api/job-offers/${offerId}/confirm-hire`, { headers: employerHeaders, data: {} });
    expect(hire.ok(), `confirm hire failed: ${await hire.text()}`).toBeTruthy();

    const start = await worker.post(`/api/applications/${applicationId}/work/start`, { headers: workerHeaders, data: {} });
    expect(start.ok(), `start work failed: ${await start.text()}`).toBeTruthy();

    // --- 6. worker submits the finished work --------------------------------
    const submit = await worker.post(`/api/applications/${applicationId}/work/submit`, { headers: workerHeaders, data: {} });
    expect(submit.ok(), `submit work failed: ${await submit.text()}`).toBeTruthy();

    // --- 7. employer approves and pays --------------------------------------
    const settle = await employer.post(`/api/applications/${applicationId}/payment/settle`, { headers: employerHeaders, data: { confirmed: true } });
    expect(settle.ok(), `settle failed: ${await settle.text()}`).toBeTruthy();

    // --- the assertion that actually matters --------------------------------
    // Assert on balances, not status strings: a status can be flipped without
    // the transactional settlement having actually succeeded. Checking both
    // sides proves the money *moved* rather than merely appearing somewhere.
    const readBalances = async () => {
      const [employerMe, workerMe] = await Promise.all([employer.get("/api/auth/me"), worker.get("/api/auth/me")]);
      expect(employerMe.ok() && workerMe.ok(), "both /auth/me reads should succeed").toBeTruthy();
      const e = await unwrap(employerMe);
      const w = await unwrap(workerMe);
      return {
        employer: Number(e?.user?.employerBalance ?? e?.employerBalance ?? 0),
        worker: Number(w?.user?.workerBalance ?? w?.workerBalance ?? 0),
      };
    };

    const after = await readBalances();
    expect(after.worker, "worker should have been paid out").toBeGreaterThan(0);
    // The employer funded escrow out of the credited balance, so their
    // spendable balance must have dropped by at least the agreed pay.
    expect(
      balanceBefore - after.employer,
      `employer balance should have dropped by at least the agreed pay (before=${balanceBefore}, after=${after.employer})`,
    ).toBeGreaterThanOrEqual(PAY);
  } finally {
    await employer.dispose();
    await worker.dispose();
  }
});
