import { expect, test, type Page } from "@playwright/test";
import { auditScreen, expectInteractiveElementsReachable } from "./responsiveHelpers";

/**
 * Walks the app at each device profile in playwright.config.ts's `responsive:*`
 * projects and asserts, geometrically, that everything fits and nothing covers
 * anything else.
 *
 * The profile is supplied by the project, so this file never sets a viewport
 * itself -- one spec, run once per device.
 */

/** Give lazy routes and entry animations a moment to settle before measuring. */
/**
 * `page.goto` that tolerates the app redirecting to the same URL while the
 * navigation is still in flight -- role routing does that on first entry to a
 * dashboard route, and Playwright reports it as "interrupted by another
 * navigation" rather than following it.
 */
async function goto(page: Page, route: string) {
  try {
    await page.goto(route);
  } catch (error) {
    if (!String(error).includes("interrupted by another navigation")) throw error;
    await page.waitForLoadState("load");
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(250);
}

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/jobs",
  "/terms",
  "/privacy",
  "/cookie-policy",
];

const WORKER_ROUTES = [
  "/worker/find-jobs",
  "/worker/applied-jobs",
  "/worker/saved-jobs",
  "/worker/messages",
  "/worker/notifications",
  "/worker/e-wallet",
  "/worker/profile",
  "/worker/settings",
  "/worker/support",
];

test.describe("responsive audit", () => {
  test("public routes fit the viewport with nothing covered", async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    // Tap-target sizing is deliberately not asserted here. It is a real and
    // separate concern -- the public footer's link rows measure ~15px tall on a
    // phone, well under the 44px guideline -- but it is an accessibility
    // question, not a "does it fit and does anything cover it" question, and
    // folding it in buries the layout failures this suite exists to surface.
    // `expectAdequateTapTargets` in ./responsiveHelpers is ready for whenever
    // that gets picked up as its own piece of work.
    for (const route of PUBLIC_ROUTES) {
      await goto(page, route);
      await settle(page);
      await auditScreen(page, `${testInfo.project.name} ${route}`);
    }
  });

  // One signed-in test per device, not two. The seeded account is shared by
  // every project in a run, and the server starts refusing logins somewhere
  // around the eleventh in quick succession -- with two signed-in tests across
  // seven profiles that is 14, and the last projects failed on login rather
  // than on anything they were meant to measure. Signing in once per profile
  // keeps it to seven and halves the suite's runtime.
  test("dashboard routes and open overlays fit with nothing covered", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const label = testInfo.project.name;

    // Already signed in: the `setup` project authenticates once and these
    // projects load its storageState (see playwright.config.ts).
    for (const route of WORKER_ROUTES) {
      await goto(page, route);
      await settle(page);
      await auditScreen(page, `${testInfo.project.name} ${route}`);
    }

    // Find Jobs is a "home context" route, so the header is 80px rather than
    // 64px here -- the case where the dropdowns' old hardcoded 72px offset put
    // them on top of the header instead of below it.
    await goto(page, "/worker/find-jobs");
    await settle(page);

    const header = page.locator("header").first();
    const headerBox = await header.boundingBox();
    expect(headerBox, "dashboard header should be visible").not.toBeNull();

    // Below Tailwind's `sm` the dropdowns are full-width sheets pinned under
    // the header, so "starts at the header's bottom edge" is the right
    // assertion. At `sm` and up they switch to ordinary popovers anchored to
    // their own trigger button, which sits inside the header -- hanging a few
    // pixels over the header's lower edge is what an anchored dropdown is
    // supposed to do, so that check only applies to the sheet mode.
    const viewport = page.viewportSize();
    const isSheetMode = (viewport?.width ?? 0) < 640;

    // Scoped to the header. Unscoped, `.first()` matches in DOM order and the
    // desktop sidebar -- which renders before the header and has its own
    // "Notifications" and account entries -- shadowed these, so the click
    // navigated instead of opening the popover.
    const headerScope = page.locator("header").first();

    // --- Notifications popover ---
    const bell = headerScope.getByRole("button", { name: /notification/i }).first();
    if (await bell.isVisible()) {
      await bell.click();
      const popover = page.getByRole("menu", { name: /notification/i }).first();
      await expect(popover).toBeVisible();
      const popoverBox = await popover.boundingBox();
      expect(popoverBox).not.toBeNull();

      // Starts below the header rather than on top of it.
      if (isSheetMode) {
        expect(
          popoverBox!.y,
          `${label}: notifications popover starts above the header bottom (${popoverBox!.y} < ${headerBox!.y + headerBox!.height})`,
        ).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      }

      // Ends above the mobile tab bar rather than behind it.
      const navBox = await page.locator("nav[aria-label*='mobile navigation']").boundingBox();
      if (navBox) {
        expect(
          popoverBox!.y + popoverBox!.height,
          `${label}: notifications popover runs under the bottom tab bar`,
        ).toBeLessThanOrEqual(navBox.y + 1);
      }

      // Everything inside the popover is actually clickable.
      await expectInteractiveElementsReachable(page, `${label} notifications popover`, '[role="menu"]');
      await page.keyboard.press("Escape");
    }

    // --- Account menu ---
    const account = headerScope.getByRole("button", { name: /account menu/i }).first();
    if (await account.isVisible()) {
      await account.click();
      const menu = page.getByRole("menu", { name: /account/i }).first();
      await expect(menu).toBeVisible();
      const menuBox = await menu.boundingBox();
      if (isSheetMode) {
        expect(
          menuBox!.y,
          `${label}: account menu starts above the header bottom`,
        ).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      }
      await expectInteractiveElementsReachable(page, `${label} account menu`, '[role="menu"]');
      await page.keyboard.press("Escape");
    }

    // --- Mobile navigation drawer ---
    const hamburger = headerScope.getByRole("button", { name: /navigation menu/i }).first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      const drawer = page.getByRole("dialog", { name: /navigation/i }).first();
      await expect(drawer).toBeVisible();
      await expectInteractiveElementsReachable(page, `${label} nav drawer`, '[role="dialog"]');
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    }

    // --- Message dock trigger clears the tab bar ---
    const dockTrigger = page.getByRole("button", { name: /messages/i }).filter({ hasNotText: /^$/ }).last();
    if (await dockTrigger.isVisible().catch(() => false)) {
      const dockBox = await dockTrigger.boundingBox();
      const navBox = await page.locator("nav[aria-label*='mobile navigation']").boundingBox();
      if (dockBox && navBox) {
        expect(
          dockBox.y + dockBox.height,
          `${label}: message dock trigger overlaps the bottom tab bar`,
        ).toBeLessThanOrEqual(navBox.y + 1);
      }
    }
  });
});
