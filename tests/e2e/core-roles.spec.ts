import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signInWorker(page: Page) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("Enter your email").fill("e2e-user@microjobs.local");
  await page.getByPlaceholder("Enter your password").fill("ReviewPass123!");
  const otpResponse = page.waitForResponse((response) => response.url().includes("/api/auth/otp/send"));
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  const otp = String((await (await otpResponse).json()).code || "");
  expect(otp).toMatch(/^\d{6}$/);
  const inputs = page.locator('input[maxlength="1"]');
  for (let index = 0; index < otp.length; index += 1) await inputs.nth(index).fill(otp[index]);
  await page.waitForURL(/\/worker\//);
}

test("public routes remain accessible without overflow", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  for (const route of ["/", "/sign-in", "/sign-up", "/forgot-password", "/terms", "/privacy", "/cookie-policy"]) {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  expect(consoleErrors).toEqual([]);
});

test("worker and employer shells remain responsive and accessible", async ({ page }) => {
  await signInWorker(page);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/worker/find-jobs");
    await expect(page.getByRole("heading", { name: "Find Jobs" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 1024) {
      const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
      const sidebarBounds = await sidebar.boundingBox();
      expect(sidebarBounds?.height).toBe(900);
      expect(sidebarBounds?.y).toBe(0);
      await expect
        .poll(() => sidebar.evaluate((element) => getComputedStyle(element).overflowY))
        .toBe("hidden");
      await page.getByRole("navigation", { name: "Worker menu" }).evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(0);
    }
    await page.screenshot({ path: `docs/ui-verification/week6-worker-find-jobs-${width}px.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: /Switch to Employer/i }).click();
  await page.waitForURL(/\/employer\//);
  await page.goto("/employer/applications");
  await expect(page.getByRole("heading", { name: /Applications/i }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/ui-verification/week6-employer-applications-375px.png", fullPage: true });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("admin user management is real and responsive", async ({ page }) => {
  await page.goto("/admin-sign-in");
  await page.getByPlaceholder("Enter your email").fill("e2e-admin@microjobs.local");
  await page.getByPlaceholder("Enter your password").fill("AdminPass123!");
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  for (const height of [600, 720, 768, 900]) {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    const navigation = page.getByRole("navigation", { name: "Admin menu" });
    const bounds = await sidebar.boundingBox();
    expect(bounds?.y).toBe(0);
    expect(bounds?.height).toBe(height);
    expect(await navigation.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    expect(await navigation.evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
    const navigationTargets = navigation.locator("button");
    for (let index = 0; index < await navigationTargets.count(); index += 1) {
      expect((await navigationTargets.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const content = page.locator("main").locator("..");
    await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect((await sidebar.boundingBox())?.y).toBe(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const dashboardAxeResults = await new AxeBuilder({ page }).analyze();
  expect(dashboardAxeResults.violations).toEqual([]);
  await page.goto("/admin/user-management");
  await expect(page.getByRole("heading", { name: /Manage accounts/i })).toBeVisible();
  await expect(page.getByText(/Loading users/i).first()).toBeHidden();
  const roleFilter = page.getByLabel("Filter accounts by role");
  await roleFilter.selectOption("privileged");
  await expect(page.getByText("Superadmin").first()).toBeVisible();
  await roleFilter.selectOption("all");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/ui-verification/week6-admin-users-320px.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  const workerRow = page.getByRole("row").filter({ hasText: "e2e-user@microjobs.local" });
  await workerRow.getByRole("button", { name: "Open user actions" }).click();
  await page.getByRole("button", { name: "Edit User" }).click();
  const dialog = page.getByRole("dialog", { name: /Edit user/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(workerRow.getByRole("button", { name: "Open user actions" })).toBeFocused();
});

test("worker API failure exposes recovery UI", async ({ page }) => {
  await signInWorker(page);
  await page.route("**/api/jobs**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Verification outage" }) }));
  await page.goto("/worker/find-jobs");
  await expect(page.getByRole("button", { name: /Try again/i })).toBeVisible();
});
