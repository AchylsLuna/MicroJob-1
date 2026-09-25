import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "SignUpPass123!";

const nameSuffix = (value: number) =>
  String(value)
    .split("")
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join("");

const unwrap = async (response: { json: () => Promise<unknown> }) => {
  const body = await response.json();
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: unknown }).data ?? body;
  }
  return body;
};

async function createExistingAccount(context: APIRequestContext, email: string, phoneNumber: string) {
  const response = await context.post("/api/auth/register", {
    data: {
      firstName: "Existing",
      lastName: "Account",
      email,
      password: PASSWORD,
      phoneNumber,
      role: "work",
    },
  });

  expect(response.ok(), `failed to seed existing account: ${await response.text()}`).toBeTruthy();
}

async function fillSignUpForm(page: Page, { email, fullName, phoneNumber }: { email: string; fullName: string; phoneNumber: string }) {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Worker" }).click();
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Phone Number").fill(phoneNumber);
  await page.locator("#signup-password").fill(PASSWORD);
  await page.locator("#signup-confirm-password").fill(PASSWORD);
  await page.getByLabel(/I agree to the Terms and Conditions/).check();
}

test("Create Account registers a dummy user and sends an OTP", async ({ page }) => {
  const uniqueId = Date.now();
  const email = `signup-dummy-${uniqueId}@microjobs.local`;
  const phoneNumber = `0917${String(uniqueId).slice(-7)}`;

  await fillSignUpForm(page, { email, fullName: `Dummy ${nameSuffix(uniqueId)}`, phoneNumber });

  const registrationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/register") && response.request().method() === "POST",
  );
  const otpResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/otp/send") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Account" }).click();

  expect((await registrationResponse).status()).toBe(201);
  const code = String((await unwrap(await otpResponse))?.code || "");
  expect(code, "test email delivery should expose the OTP").toMatch(/^\d{6}$/);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

  const inputs = page.locator('input[maxlength="1"]');
  for (let index = 0; index < code.length; index += 1) await inputs.nth(index).fill(code[index]);
  await page.waitForURL(/\/worker\//);
});

test("Create Account rejects an existing email without requesting an OTP", async ({ page }) => {
  const uniqueId = Date.now();
  const email = `signup-existing-${uniqueId}@microjobs.local`;
  await createExistingAccount(page.request, email, `0918${String(uniqueId).slice(-7)}`);
  await fillSignUpForm(page, {
    email,
    fullName: `Email ${nameSuffix(uniqueId)}`,
    phoneNumber: `0919${String(uniqueId).slice(-7)}`,
  });

  let otpRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/otp/send") && request.method() === "POST") otpRequests += 1;
  });

  const registrationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Account" }).click();
  const responseBody = await (await registrationResponse).json();
  expect(responseBody).toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
  await expect(page.getByText("This email address already exists.")).toBeVisible();
  await expect(page.locator("#signup-email")).toHaveClass(/border-red-400/);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeHidden();
  expect(otpRequests).toBe(0);
});

test("Create Account shows a phone-specific error without requesting an OTP", async ({ page }) => {
  const uniqueId = Date.now();
  const phoneNumber = `0918${String(uniqueId).slice(-7)}`;
  await createExistingAccount(page.request, `phone-owner-${uniqueId}@microjobs.local`, phoneNumber);
  await fillSignUpForm(page, {
    email: `phone-duplicate-${uniqueId}@microjobs.local`,
    fullName: `Phone ${nameSuffix(uniqueId)}`,
    phoneNumber,
  });

  let otpRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/otp/send") && request.method() === "POST") otpRequests += 1;
  });

  const registrationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Account" }).click();
  const responseBody = await (await registrationResponse).json();
  expect(responseBody).toMatchObject({ code: "PHONE_NUMBER_ALREADY_EXISTS" });
  await expect(page.getByText("This phone number already exists.")).toBeVisible();
  await expect(page.locator("#signup-phone")).toHaveClass(/border-red-400/);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeHidden();
  expect(otpRequests).toBe(0);
});
