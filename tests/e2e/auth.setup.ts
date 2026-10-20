import { expect, test as setup } from "@playwright/test";

/**
 * Signs the seeded worker in once and saves the resulting session for the
 * `responsive:*` projects to reuse.
 *
 * Each of those projects used to sign in for itself, and with seven device
 * profiles in the matrix -- on top of the logins the rest of the suite already
 * does -- the shared seeded account stopped accepting new logins part-way
 * through a full run. The later profiles then failed on the sign-in form rather
 * than on anything they were meant to measure.
 *
 * The e2e stack uses cookie sessions (the bearer transport is Azure-only, and
 * `VITE_AUTH_TRANSPORT` is not set here), so `storageState` captures both the
 * session cookie and the `auth_user` / `current_user` entries the client reads
 * on boot -- everything needed to start already signed in.
 */

const WORKER = { email: "e2e-user@microjobs.local", password: "ReviewPass123!" };
/**
 * The superadmin `start-e2e-server.cjs` seeds. The overlay audit needs it
 * because three of the modals it measures only exist on admin routes, and a
 * fresh in-memory database has no rows to open them from otherwise.
 */
const ADMIN = { email: "e2e-admin@microjobs.local", password: "AdminPass123!" };

export const WORKER_STATE = "tests/e2e/.auth/worker.json";
export const ADMIN_STATE = "tests/e2e/.auth/admin.json";

setup("authenticate worker", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByPlaceholder("Enter your email").fill(WORKER.email);
  await page.getByPlaceholder("Enter your password").fill(WORKER.password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  await loginResponse;

  // A trusted device skips the OTP step, so wait for whichever state arrives.
  const otpInput = page.locator('input[maxlength="1"]').first();
  const sawOtp = await otpInput
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (sawOtp) {
    const otpResponse = await page.request.get(
      `/api/auth/debug/login-otp?email=${encodeURIComponent(WORKER.email)}`,
    );
    const otp = String((await otpResponse.json()).data?.code || "");
    expect(otp, "debug OTP endpoint should return a six-digit code").toMatch(/^\d{6}$/);
    const inputs = page.locator('input[maxlength="1"]');
    for (let index = 0; index < otp.length; index += 1) await inputs.nth(index).fill(otp[index]);
  }

  await page.waitForURL(/\/worker\//);
  await page.context().storageState({ path: WORKER_STATE });
});

/**
 * The admin sign-in form is a separate route with its own submit label, and the
 * seeded superadmin has no MFA enrolled, so this flow has no second factor to
 * clear -- unlike `admin-critical.spec.ts`, which stubs an MFA challenge to
 * test the challenge itself.
 */
setup("authenticate admin", async ({ page }) => {
  await page.goto("/admin-sign-in");
  await page.getByPlaceholder("Enter your email").fill(ADMIN.email);
  await page.getByPlaceholder("Enter your password").fill(ADMIN.password);
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  await page.context().storageState({ path: ADMIN_STATE });
});
