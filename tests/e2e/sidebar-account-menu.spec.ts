import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectInteractiveElementsReachable } from "./responsiveHelpers";

async function mockAccount(page: Page, account: "worker" | "employer" | "admin" | "both" = "both") {
  const user = {
    id: "507f1f77bcf86cd799439012", email: "sidebar@example.ph", firstName: "Sidebar", lastName: "Account With A Long Name",
    role: account === "worker" ? "user" : account, systemRole: account === "worker" ? "work" : account,
    accountType: account === "employer" ? "employer" : "worker", isVerified: true,
    accountPreference: account, accountOptions: account === "both" ? ["worker", "employer"] : [account === "employer" ? "employer" : "worker"],
    staffRole: account === "admin" ? "superadmin" : null,
  };
  await page.addInitScript((value) => {
    localStorage.setItem("auth_user", JSON.stringify(value));
    localStorage.setItem("current_user", JSON.stringify(value));
    localStorage.setItem("cookie_consent_v1", JSON.stringify({ necessary: true, decidedAt: "2026-10-13T00:00:00Z" }));
  }, user);
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(
      url.pathname.endsWith("/auth/me") ? { data: user } : [],
    ) });
  });
  await page.goto(account === "admin" ? "/admin/dashboard" : account === "employer" ? "/employer/dashboard" : "/worker/find-jobs");
}

async function openAccount(page: Page) {
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole("button", { name: "Open navigation menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Navigation menu", exact: true })).toBeVisible();
  }
  const trigger = page.getByRole("complementary", { name: "Primary navigation" })
    .getByRole("button", { name: "Open account menu", exact: true });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Account", exact: true });
  await expect(menu).toBeVisible();
  return { trigger, menu };
}

for (const [width, height] of [[280, 653], [375, 667], [667, 375], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`sidebar account popup fits and aligns at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockAccount(page);
    const { trigger, menu } = await openAccount(page);
    const triggerBox = (await trigger.boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.height).toBeGreaterThan(100);
    expect(Math.abs(menuBox.x - triggerBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(menuBox.width - triggerBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(triggerBox.y - menuBox.y - menuBox.height - 8)).toBeLessThanOrEqual(1);
    expect(menuBox.y).toBeGreaterThanOrEqual(8);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
    await expect(trigger).toContainText("Worker");
    await expectInteractiveElementsReachable(page, "sidebar account actions", '[role="menu"]');
    const accessibility = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
    expect(accessibility.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    if (width < 1024) {
      const drawer = page.getByRole("dialog", { name: "Navigation menu", exact: true });
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(page.getByRole("button", { name: "Open navigation menu", exact: true })).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("account popup follows resizing and clears when the sidebar hides or changes mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAccount(page);
  const { trigger, menu } = await openAccount(page);
  await page.setViewportSize({ width: 1024, height: 375 });
  await expect(menu).toBeVisible();
  await expect.poll(async () => (await menu.boundingBox())!.y).toBeGreaterThanOrEqual(8);
  await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Open navigation menu", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(menu).toBeHidden();
  await openAccount(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "Navigation menu", exact: true })).toBeHidden();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("account menu supports keyboard navigation, tab dismissal and outside clicks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAccount(page);
  const { trigger, menu } = await openAccount(page);
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "Sign out", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Switch to Employer", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 375 });
  await trigger.press("ArrowUp");
  await expect(menu.getByRole("menuitem", { name: "Sign out", exact: true })).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: "Sign out", exact: true })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await trigger.press("ArrowDown");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await trigger.click();
  await page.getByRole("heading", { name: "Job search", exact: true }).click();
  await expect(menu).toBeHidden();
});

for (const account of ["worker", "employer", "admin", "both"] as const) {
  test(`${account} account keeps its allowed actions and sign-out`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAccount(page, account);
    const { trigger, menu } = await openAccount(page);
    await expect(page.locator("header").getByRole("button", { name: "Open account menu" })).toHaveCount(0);
    await expect(trigger).toContainText(account === "admin" ? "Admin" : account === "employer" ? "Employer" : "Worker");
    await expect(menu.getByRole("menuitem", { name: "View profile", exact: true })).toHaveCount(account === "worker" || account === "both" ? 1 : 0);
    await expect(menu.getByRole("menuitem", { name: "Ratings & reviews", exact: true })).toHaveCount(account === "admin" ? 0 : 1);
    await expect(menu.getByRole("menuitem", { name: "Switch to Employer", exact: true })).toHaveCount(account === "both" ? 1 : 0);
    await menu.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(account === "admin" ? /\/admin-sign-in$/ : /\/sign-in$/);
    await expect(page.getByRole("complementary", { name: "Primary navigation" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("auth_user"))).toBeNull();
  });
}

test("profile and review links close the drawer and account switching updates the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockAccount(page);
  let opened = await openAccount(page);
  await opened.menu.getByRole("menuitem", { name: "View profile", exact: true }).click();
  await expect(page).toHaveURL(/\/worker\/profile$/);
  await expect(page.locator("main").getByRole("heading", { name: "Sidebar Account With A Long Name", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Navigation menu", exact: true })).toBeHidden();
  opened = await openAccount(page);
  await opened.menu.getByRole("menuitem", { name: "Switch to Employer", exact: true }).click();
  await expect(page).toHaveURL(/\/employer\/dashboard$/);
  await expect(page.locator("header").getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Navigation menu", exact: true })).toBeHidden();
  opened = await openAccount(page);
  await expect(opened.trigger).toContainText("Employer");
  await opened.menu.getByRole("menuitem", { name: "Ratings & reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/profiles\/507f1f77bcf86cd799439012\?viewAs=employer$/);
});

test("location placeholder translates while blank searches stay nationwide", async ({ page }) => {
  await mockAccount(page, "worker");
  const location = page.getByRole("combobox", { name: "Job search location" });
  await expect(location).toHaveAttribute("placeholder", "Location");
  await expect(location).toHaveValue("");
  await page.evaluate(async () => {
    const modulePath = "/src/i18n/index.ts";
    const { default: i18n } = await import(modulePath);
    await i18n.changeLanguage("tl");
  });
  await expect(page.getByRole("combobox", { name: "Lokasyon para sa paghahanap ng trabaho" })).toHaveAttribute("placeholder", "Lokasyon");
});
