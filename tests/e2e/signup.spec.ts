import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "SignUpPass123!";

const unwrap = async (response: { json: () => Promise<any> }) => {
  const body = await response.json();
  return body?.data ?? body;
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

async function fillSignUpForm(page: Page, { email, phoneNumber }: { email: string; phoneNumber: string }) {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Worker" }).click();
  await page.getByLabel("Full Name").fill("Dummy Account");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Phone Number").fill(phoneNumber);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Confirm Password").fill(PASSWORD);
  await page.getByLabel(/I agree to the Terms and Conditions/).check();
}

test("Create Account registers a dummy user and sends an OTP", async ({ page }) => {
  const uniqueId = Date.now();
  const email = `signup-dummy-${uniqueId}@microjobs.local`;
  const phoneNumber = `0917${String(uniqueId).slice(-7)}`;

  await fillSignUpForm(page, { email, phoneNumber });

  const otpResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/otp/send") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Account" }).click();

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
  await fillSignUpForm(page, { email, phoneNumber: `0919${String(uniqueId).slice(-7)}` });

  let otpRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/otp/send") && request.method() === "POST") otpRequests += 1;
  });

  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("This email is already registered. Please use another email or log in.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeHidden();
  expect(otpRequests).toBe(0);
});
