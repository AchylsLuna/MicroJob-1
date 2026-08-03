import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("admin sign-in completes the MFA challenge before opening the dashboard", async ({ page }) => {
  let submittedMfaPayload: Record<string, unknown> | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/api/auth/login/mfa")) {
      submittedMfaPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            token: "test-access-token",
            user: {
              _id: "507f1f77bcf86cd799439011",
              email: "mfa-admin@microjobs.local",
              firstName: "MFA",
              lastName: "Admin",
              role: "admin",
              status: "active",
            },
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/api/auth/login")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            mfaRequired: true,
            mfaToken: "test-mfa-challenge",
            method: "authenticator",
          },
        }),
      });
      return;
    }

    const arrayEndpoints = ["/users", "/jobs", "/categories", "/recent-payouts", "/transactions", "/notifications"];
    const responseBody = arrayEndpoints.some((suffix) => pathname.endsWith(suffix)) ? [] : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responseBody) });
  });

  await page.goto("/admin-sign-in");
  await page.getByLabel("Email").fill("mfa-admin@microjobs.local");
  await page.getByPlaceholder("Enter your password").fill("AdminPass123!");
  await page.getByRole("button", { name: "Sign In as Admin" }).click();

  await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
  await expect(page.getByLabel("Authenticator or backup code")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByLabel("Authenticator or backup code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  expect(submittedMfaPayload).toEqual({ mfaToken: "test-mfa-challenge", code: "123456" });
});
