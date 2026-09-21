import { expect, test, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

/**
 * Job recommendations: `GET /api/jobs/recommended` through the real HTTP stack.
 *
 * The matching maths is unit-tested in `server/tests/controllers/`; what this
 * spec protects is the contract the two clients bind to, which unit tests
 * cannot see: the route is actually mounted where the clients call it, it is
 * auth-gated, it answers with a **bare array** rather than a `sendSuccess`
 * envelope, and each element carries the `match { percentage, level }` the
 * cards render.
 *
 * The cold-start case matters most. A worker with nothing on their profile does
 * not get an empty list -- every job scores zero and the ranking falls through
 * to recency. Both clients depend on that: an all-zero response is what makes
 * them show "complete your profile" instead of dressing recent jobs up as
 * personalised picks. If the server ever started returning `[]` there instead,
 * the prompt would silently stop appearing, and only this assertion would
 * notice.
 */

const PASSWORD = "ReviewPass123!";
const EMPLOYER = { email: "e2e-user@microjobs.local", password: PASSWORD };
const FRESH_WORKER = {
  email: "e2e-recommend-fresh@microjobs.local",
  password: PASSWORD,
  firstName: "Fresh",
  lastName: "Worker",
  phoneNumber: "09171230077",
};

/** sendSuccess() nests under `.data`; endpoints that answer raw do not. */
const unwrap = async (response: { json: () => Promise<any> }) => {
  const body = await response.json();
  return body?.data ?? body;
};

async function signIn(context: APIRequestContext, email: string, password: string) {
  const response = await context.post("/api/auth/login", { data: { emailOrUsername: email, password } });
  expect(response.ok(), `login failed for ${email}: ${await response.text()}`).toBeTruthy();
}

/** Registers and email-verifies a worker; the dev OTP comes back in the body
 *  because the harness blanks every SMTP credential. */
async function registerWorker(context: APIRequestContext, worker: typeof FRESH_WORKER) {
  const registration = await context.post("/api/auth/register", {
    data: {
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email,
      password: worker.password,
      phoneNumber: worker.phoneNumber,
      role: "work",
    },
  });

  if (!registration.ok()) {
    // A warm database is fine -- an existing account falls through to sign-in.
    // Anything else is surfaced so a contract change cannot look like a login
    // problem.
    const body = await registration.text();
    expect(body, `unexpected registration failure: ${body}`).toMatch(/already|exists|taken/i);
    await signIn(context, worker.email, worker.password);
    return;
  }

  const otpSend = await context.post("/api/auth/otp/send", { data: { email: worker.email } });
  const code = String((await unwrap(otpSend))?.code || "");
  expect(code, "dev OTP should be returned when SMTP is unconfigured").toMatch(/^\d{6}$/);
  const verify = await context.post("/api/auth/otp/verify", { data: { email: worker.email, code } });
  expect(verify.ok(), `otp verify failed: ${await verify.text()}`).toBeTruthy();
}

/**
 * Every mutating route is behind double-submit CSRF: the `csrfToken` cookie
 * echoed back as an `x-csrf-token` header (`server/middleware/csrf.js`).
 */
async function csrfHeaders(context: APIRequestContext) {
  const { cookies } = await context.storageState();
  const token = cookies.find((cookie) => cookie.name === "csrfToken")?.value;
  expect(token, "expected a csrfToken cookie after signing in").toBeTruthy();
  return { "x-csrf-token": String(token) };
}

/** Employers are gated on a profile photo before they may post. `avatarUrl` is
 *  not settable via PATCH /auth/me, so this uses the real upload endpoint. */
async function uploadAvatar(context: APIRequestContext, headers: Record<string, string>) {
  const response = await context.post("/api/auth/profile/avatar", {
    headers,
    multipart: {
      avatar: {
        name: "avatar.png",
        mimeType: "image/png",
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
 * Guarantees at least one open job exists to rank.
 *
 * Without this the zero-score assertion below silently skips on a cold
 * database -- which is exactly the state CI starts from, so the most important
 * case in this file would never actually run.
 */
async function ensureOpenJobExists(baseURL: string | undefined) {
  const employer = await playwrightRequest.newContext({ baseURL });
  try {
    await signIn(employer, EMPLOYER.email, EMPLOYER.password);
    const headers = await csrfHeaders(employer);
    await uploadAvatar(employer, headers);

    // Posting escrows the pay up front, so the wallet has to be funded first or
    // the create fails with INSUFFICIENT_BALANCE. Real funding needs a PayMongo
    // checkout an isolated sandbox cannot perform, hence the NODE_ENV=test-only
    // credit endpoint (hard 404 outside test).
    const credit = await employer.post("/api/auth/debug/credit-wallet", {
      headers,
      data: { email: EMPLOYER.email, amount: 2000 },
    });
    expect(credit.ok(), `wallet credit failed: ${await credit.text()}`).toBeTruthy();

    // `category` is validated against the collection, so it needs a real id.
    const categoriesResponse = await employer.get("/api/categories");
    const categoriesBody = await unwrap(categoriesResponse);
    const categories = Array.isArray(categoriesBody) ? categoriesBody : categoriesBody?.categories ?? [];
    expect(categories.length, "expected seeded job categories").toBeGreaterThan(0);

    const response = await employer.post("/api/jobs", {
      headers,
      data: {
        title: "E2E recommendation candidate",
        description: "A job that exists purely so recommendations have something to rank.",
        location: "Mayamot, City of Antipolo, Rizal",
        salary: 500,
        jobType: "Short-term",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        category: String(categories[0]?._id),
        positionsNeeded: 1,
      },
    });
    expect(response.ok(), `seed job create failed: ${await response.text()}`).toBeTruthy();
  } finally {
    await employer.dispose();
  }
}

test("recommendations require authentication", async ({ baseURL }) => {
  const anonymous = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await anonymous.get("/api/jobs/recommended");
    expect(
      response.status(),
      "an unauthenticated caller must not receive recommendations",
    ).toBe(401);
  } finally {
    await anonymous.dispose();
  }
});

test("recommendations answer a bare array carrying match metadata", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const worker = await playwrightRequest.newContext({ baseURL });

  try {
    await registerWorker(worker, FRESH_WORKER);

    const response = await worker.get("/api/jobs/recommended?limit=5");
    expect(response.ok(), `recommendations failed: ${await response.text()}`).toBeTruthy();

    const body = await response.json();
    // Deliberately NOT unwrapped: this endpoint answers raw, like the rest of
    // the jobs-discovery family, and both clients are written against that.
    expect(Array.isArray(body), "the endpoint must answer a bare array, not an envelope").toBe(true);
    expect(body.length, "limit must be respected").toBeLessThanOrEqual(5);

    for (const job of body) {
      expect(job, "every recommendation carries a match").toHaveProperty("match");
      expect(typeof job.match.percentage).toBe("number");
      expect(typeof job.match.level).toBe("string");
      // The card renders these directly, so a job still needs its ordinary fields.
      expect(job).toHaveProperty("_id");
      expect(job).toHaveProperty("title");
    }
  } finally {
    await worker.dispose();
  }
});

test("a worker with no profile data still gets results, scored at zero", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const worker = await playwrightRequest.newContext({ baseURL });

  try {
    await ensureOpenJobExists(baseURL);
    await registerWorker(worker, FRESH_WORKER);

    const response = await worker.get("/api/jobs/recommended?limit=10");
    expect(response.ok(), `recommendations failed: ${await response.text()}`).toBeTruthy();
    const body = await response.json();

    expect(
      body.length,
      "a job was just seeded, so there must be something to rank",
    ).toBeGreaterThan(0);

    // A freshly-registered worker has no skills, categories or experience, so
    // nothing can score. This is exactly the state that drives the
    // "complete your profile" prompt on both clients.
    expect(
      body.every((job: any) => job.match.percentage === 0),
      "a profile with nothing to match on must score every job at zero",
    ).toBe(true);
    expect(
      body.every((job: any) => job.match.level === "Potential match"),
      "zero percent is the lowest level",
    ).toBe(true);
  } finally {
    await worker.dispose();
  }
});
