import { expect, test, type Locator, type Page } from "@playwright/test";

async function rejectLogin(page: Page, message: string) {
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message }),
  }));
  await page.goto("/sign-in");
  await page.getByLabel("Email Address").fill("worker@example.ph");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword1!");
  await page.getByRole("button", { name: /^Sign In$/ }).click();
}

async function expectErrorBelowInput(input: Locator, error: Locator) {
  await expect(error).toBeVisible();
  const inputBox = await input.boundingBox();
  const errorBox = await error.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(errorBox).not.toBeNull();
  expect(errorBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  const errorId = await error.getAttribute("id");
  expect(errorId).not.toBeNull();
  await expect(input).toHaveAttribute("aria-describedby", errorId!);
  await expect(input).toHaveAttribute("aria-invalid", "true");
}

for (const width of [375, 1440]) {
  test(`password error appears below its input and clears on edit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await rejectLogin(page, "Incorrect password. Please try again.");

    const password = page.getByLabel("Password", { exact: true });
    const error = page.locator("#signin-password-error");
    await expectErrorBelowInput(password, error);
    await expect(error).toHaveText("Incorrect password. Please try again.");

    await password.fill("CorrectPassword1!");
    await expect(password).toHaveValue("CorrectPassword1!");
    await expect(error).toBeHidden();
    await expect(password).not.toHaveAttribute("aria-invalid", "true");
  });
}

test("ambiguous credential rejection stays at form level and clears on password edit", async ({ page }) => {
  const message = "The email, username, or password is incorrect. Please try again.";
  await rejectLogin(page, message);

  const email = page.getByLabel("Email Address");
  const password = page.getByLabel("Password", { exact: true });
  const error = page.getByRole("alert").filter({ hasText: message });
  await expect(error).toBeVisible();
  await expect(page.locator("#signin-password-error")).toBeHidden();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "signin-form-error");
  await expect(password).toHaveAttribute("aria-describedby", "signin-form-error");

  await password.fill("CorrectPassword1!");
  await expect(error).toBeHidden();
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await expect(password).not.toHaveAttribute("aria-invalid", "true");
});

test("required field errors sit below their inputs and clear independently", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: /^Sign In$/ }).click();

  const email = page.getByLabel("Email Address");
  const password = page.getByLabel("Password", { exact: true });
  await expectErrorBelowInput(email, page.locator("#signin-email-error"));
  await expectErrorBelowInput(password, page.locator("#signin-password-error"));

  await email.fill("worker@example.ph");
  await expect(page.locator("#signin-email-error")).toBeHidden();
  await expect(page.locator("#signin-password-error")).toBeVisible();
  await password.fill("CorrectPassword1!");
  await expect(page.locator("#signin-password-error")).toBeHidden();
});
