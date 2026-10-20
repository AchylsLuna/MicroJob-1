import { expect, test, type Page } from "@playwright/test";

const account = { email: "e2e-user@microjobs.local", password: "ReviewPass123!" };

async function signIn(page: Page) {
  await page.getByPlaceholder("Enter your email").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(account.password);
  const completed = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/login" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const response = await completed;
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}

async function verifyCode(page: Page) {
  const codeResponse = await page.request.get(`/api/auth/debug/login-otp?email=${encodeURIComponent(account.email)}`);
  const code = String((await codeResponse.json()).data?.code || "");
  // Never include the value in failure messages or screenshots.
  expect(/^\d{6}$/.test(code)).toBe(true);
  const inputs = page.locator('input[maxlength="1"]');
  for (let index = 0; index < code.length; index += 1) await inputs.nth(index).fill(code[index]);
  await page.waitForURL(/\/(worker|employer)\//);
}

async function signOut(page: Page) {
  const completed = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/logout" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Open account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  expect((await completed).ok()).toBe(true);
  await page.waitForURL(/\/sign-in$/);
}

test("trusted sign-in skips email OTP after sign-out, rotation, and reopening the site", async ({ page }) => {
  await page.goto("/sign-in");
  expect((await signIn(page)).otpRequired).toBe(true);
  await expect(page.getByRole("heading", { name: "Verify your sign-in", exact: true })).toBeVisible();
  await expect(page.getByLabel("Trust this device for 30 days")).toBeChecked();
  await verifyCode(page);
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await signOut(page);
  const result = await signIn(page);
  expect(result.otpRequired).toBeUndefined();
  expect(Boolean(result.user?.id)).toBe(true);
  await page.waitForURL(/\/(worker|employer)\//);
  await signOut(page);
  await page.reload();
  expect((await signIn(page)).otpRequired).toBeUndefined();
  await page.waitForURL(/\/(worker|employer)\//);
});

test("unchecked device trust keeps email verification on the next sign-in", async ({ page }) => {
  await page.goto("/sign-in");
  expect((await signIn(page)).otpRequired).toBe(true);
  await page.getByLabel("Trust this device for 30 days").uncheck();
  await verifyCode(page);
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await signOut(page);
  expect((await signIn(page)).otpRequired).toBe(true);
  await expect(page.getByRole("heading", { name: "Verify your sign-in", exact: true })).toBeVisible();
});
