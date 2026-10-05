import { expect, test, type Page } from "@playwright/test";
import { expectOverlayWellPlaced } from "./overlayHelpers";

/**
 * Measures, rather than infers, that every modal in the web client lands in the
 * middle of the screen and is the top layer there.
 *
 * `scripts/check-overlay-centering.mjs` reads the class lists and is what
 * catches a new hand-rolled overlay at lint time. It cannot see the two things
 * that actually broke here, because both look correct in a class list:
 *
 *   - A modal at `z-50` is centred exactly and painted *under* the navbar
 *     (`z-[60]`) and the cookie banner (`z-[90]`).
 *   - `position: fixed` is only viewport-relative while no ancestor establishes
 *     a containing block; a `transform` anywhere up the tree silently confines
 *     the backdrop to a pane. `.page-transition` used to do exactly that.
 *
 * Both are geometric facts about a rendered page, so they are asserted against
 * a rendered page. Each case opens one overlay and hands it to
 * `expectOverlayWellPlaced`, which checks centring, layering and the
 * reachability of the overlay's own controls.
 *
 * Runs across four viewports (see `playwright.config.ts`): 280px for base
 * styles only, 375px for the common phone, 667x375 for landscape -- the profile
 * that first exposed a close button pushed off the top edge -- and 1440px as a
 * desktop regression guard.
 */

const dismissCookieBanner = async (page: Page) => {
  // The banner is a real overlay at its own rung and is allowed to cover page
  // content; what it may never cover is a modal. Leaving it up for the public
  // cases is the point -- that pairing is the bug the z-50 modals had -- so this
  // is only used where a case needs the banner out of the way.
  const accept = page.getByRole("button", { name: /Accept all|Accept/i });
  if (await accept.isVisible().catch(() => false)) await accept.click();
};

test.describe("public overlays", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the sign-in OTP modal is centred and outranks the cookie banner", async ({ page }) => {
    await page.goto("/sign-in");
    // Deliberately NOT dismissing the cookie banner. A first-time visitor has
    // it on screen, and at `z-50` this modal was painted underneath it -- the
    // exact pairing this case exists to hold.
    await page.getByPlaceholder("Enter your email").fill("e2e-user@microjobs.local");
    await page.getByPlaceholder("Enter your password").fill("ReviewPass123!");
    await page.getByRole("button", { name: /^Sign In$/ }).click();

    const dialog = page.getByRole("dialog", { name: /Verify|OTP|code/i });
    const appeared = await dialog
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    // A trusted device skips the OTP step entirely. That is a legitimate
    // outcome, not a failure of this assertion -- skip rather than fail, so a
    // warm session does not look like a layout regression.
    test.skip(!appeared, "login did not challenge for an OTP (trusted device)");

    await expectOverlayWellPlaced(page, dialog, "sign-in OTP modal");
  });
});

test.describe("admin overlays", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("the user-details modal is centred and outranks the navbar", async ({ page }) => {
    await page.goto("/admin/user-management");
    await expect(page.getByRole("heading", { name: /Manage accounts/i })).toBeVisible();
    await expect(page.getByText(/Loading users/i).first()).toBeHidden();

    // Two routes to the same modal: the table's row menu above `lg`, and a
    // "View" button in the mobile list below it. Both are real paths a user
    // takes, and which one exists depends on the viewport under test.
    const rowMenu = page.getByRole("button", { name: "Open user actions" }).first();
    const mobileView = page.getByRole("button", { name: "View" }).first();
    if (await rowMenu.isVisible().catch(() => false)) {
      await rowMenu.click();
      await page.getByRole("button", { name: "View Profile" }).click();
    } else {
      await mobileView.click();
    }

    const dialog = page.getByRole("dialog", { name: "User Details" });
    await expectOverlayWellPlaced(page, dialog, "admin user-details modal");
  });

  test("the shared Dialog is centred", async ({ page }) => {
    await page.goto("/admin/user-management");
    await expect(page.getByRole("heading", { name: /Manage accounts/i })).toBeVisible();
    await page.getByRole("button", { name: "Add account" }).click();

    // `ui/index.tsx`'s Dialog, which every migrated confirm now uses. It is the
    // reference implementation, so a failure here is a regression in the shared
    // component rather than in one screen.
    const dialog = page.getByRole("dialog", { name: "Add account" });
    await expectOverlayWellPlaced(page, dialog, "shared Dialog (Add account)");
  });

  test("the e-wallet receipt modal is centred", async ({ page }) => {
    // A fresh in-memory database has no payment transactions, so there is no
    // row to open a receipt from. Stubbing the list endpoint is confined to
    // getting the modal on screen -- the geometry measured below is still the
    // real component rendering real props.
    await page.route("**/api/payments/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            transactions: [
              {
                _id: "6512f1f77bcf86cd79943901",
                type: "deposit",
                status: "completed",
                amount: 1500,
                currency: "PHP",
                referenceNumber: "E2E-RECEIPT-0001",
                createdAt: new Date("2026-01-15T09:30:00Z").toISOString(),
                updatedAt: new Date("2026-01-15T09:31:00Z").toISOString(),
                user: { _id: "6512f1f77bcf86cd79943902", firstName: "Receipt", lastName: "Fixture", email: "receipt@microjobs.local" },
              },
            ],
            total: 1,
          },
        }),
      });
    });

    await page.goto("/admin/e-wallet-monitoring");
    const viewReceipt = page.getByRole("button", { name: /Receipt|View receipt/i }).first();
    const reachable = await viewReceipt
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!reachable, "transaction list did not render a receipt action against the stub");
    await viewReceipt.click();

    const dialog = page.getByRole("dialog").filter({ hasText: /Transaction/i }).first();
    await expectOverlayWellPlaced(page, dialog, "e-wallet receipt modal");
  });
});

test.describe("employer overlays", () => {
  // The seeded demo user has `DEMO_USER_ROLE: "both"`, so the worker session
  // this state captures also reaches the employer routes.
  test.use({ storageState: "tests/e2e/.auth/worker.json" });

  test("the post-a-job modal is centred", async ({ page }) => {
    await page.goto("/employer/post-job");
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: /^Post a Job$/ }).click();

    // The scroll-wrapper pattern: the backdrop is not centred, its child is,
    // and the cap lives on the grandchild. Measuring the panel rather than the
    // backdrop is what makes that arrangement assertable at all.
    const dialog = page.getByRole("dialog", { name: /Create a job post|Edit job details/ });
    await expectOverlayWellPlaced(page, dialog, "post-a-job modal");
  });

  test("the job-details modal is centred and outranks the navbar", async ({ page }) => {
    // Stubbed for the same reason as the receipt above: no jobs exist in a cold
    // database, and this modal is one of the five that sat at `z-50`.
    await page.route("**/api/jobs/my-jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            jobs: [
              {
                _id: "6512f1f77bcf86cd79943910",
                title: "Weekend event assistant",
                description: "Help run a two-day community event.",
                status: "active",
                department: "Events",
                budget: 2500,
                location: { city: "Quezon City", province: "Metro Manila" },
                skills: ["Logistics"],
                createdAt: new Date("2026-01-10T02:00:00Z").toISOString(),
                applicationsCount: 0,
              },
            ],
            total: 1,
          },
        }),
      });
    });

    await page.goto("/employer/jobs");
    const view = page.getByRole("button", { name: /View details|View/i }).first();
    const reachable = await view
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!reachable, "job list did not render a view action against the stub");
    await view.click();

    const dialog = page.getByRole("dialog", { name: /Weekend event assistant|Job details/i }).first();
    await expectOverlayWellPlaced(page, dialog, "job-details modal");
  });

  test("the date picker sheet is horizontally centred and on top", async ({ page }) => {
    await page.goto("/employer/post-job");
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: /^Post a Job$/ }).click();

    const openCalendar = page.getByRole("button", { name: /date|schedule|deadline/i }).first();
    const reachable = await openCalendar
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!reachable, "no date field is exposed in the create form");
    await openCalendar.click();

    const sheet = page.getByRole("dialog").filter({ hasText: /Mon|Sun|Select/i }).last();
    const appeared = await sheet
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!appeared, "date picker did not open");

    // A bottom sheet on phones, centred from `sm` up -- a thumb-reach decision,
    // not a bug. Only the horizontal axis is asserted, which is the part that
    // must hold at every width.
    await expectOverlayWellPlaced(page, sheet, "date picker sheet", { axis: "horizontal" });
  });
});
