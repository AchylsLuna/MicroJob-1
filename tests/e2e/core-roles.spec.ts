import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signInWorker(page: Page) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("Enter your email").fill("e2e-user@microjobs.local");
  await page.getByPlaceholder("Enter your password").fill("ReviewPass123!");
  // The login OTP is issued synchronously inside POST /auth/login itself (it's
  // never echoed back to the client in any response, by design -- see
  // mfaHelpers.issueLoginOtpChallenge), so wait for that request to resolve,
  // then pull the code from the NODE_ENV=test-only debug endpoint rather than
  // sniffing network responses for a code that no longer travels over the wire.
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  await loginResponse;
  const otpResponse = await page.request.get("/api/auth/debug/login-otp?email=e2e-user@microjobs.local");
  // sendSuccess() nests its payload under `.data` (the client SDK normally
  // unwraps this; a raw page.request call sees the wire shape directly).
  const otp = String((await otpResponse.json()).data?.code || "");
  expect(otp).toMatch(/^\d{6}$/);
  const inputs = page.locator('input[maxlength="1"]');
  for (let index = 0; index < otp.length; index += 1) await inputs.nth(index).fill(otp[index]);
  await page.waitForURL(/\/worker\//);
}

test("public routes remain accessible without overflow", async ({ page }) => {
  test.setTimeout(90_000);
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

test("password recovery strength panel stays compact and on-brand", async ({ page }) => {
  await page.route("**/api/auth/password-reset/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "OK" }) }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("worker@microjobs.local");
  await page.getByRole("button", { name: "Send recovery code" }).click();
  await page.getByLabel("Six-digit recovery code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByRole("heading", { name: "Create a new password" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Password strength" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const changePasswordButton = page.getByRole("button", { name: "Change password" });
  await expect(changePasswordButton).toBeDisabled();
  expect(await changePasswordButton.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(28, 77, 141)");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel("New password", { exact: true }).fill("ModernPass123!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("ModernPass123!");
  await changePasswordButton.click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  const signInButton = page.getByRole("button", { name: "Back to sign in" });
  await expect(signInButton).toBeVisible();
  const successButtonBox = await signInButton.boundingBox();
  expect(successButtonBox?.height).toBeGreaterThanOrEqual(52);
  expect(successButtonBox?.width).toBeLessThan(300);
  expect(await signInButton.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("10px");
});

test("worker and employer shells remain responsive and accessible", async ({ page }) => {
  await signInWorker(page);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/worker/find-jobs");
    await expect(page.getByRole("heading", { name: "Find your next opportunity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Jobs in: Quezon City" })).toBeVisible();
    await expect(page.getByText("Philippines", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // /worker/find-jobs is the worker's home page (NavBar.tsx sets
    // `homeContext: true` for it), which grows the header to 80px to fit a
    // local-area subtitle row -- every other page keeps the base 64px.
    const headerBounds = await page.locator("header").boundingBox();
    expect(headerBounds?.height).toBe(80);
    if (width >= 1024) {
      // The dashboard shell gives every role the desktop sidebar (there is no
      // role gate on it), so the worker gets one too and `main` starts after it
      // rather than at the viewport edge. This block used to assert the
      // opposite -- a worker shell with no sidebar and a full-width header --
      // which is not what the app builds.
      await expect(page.getByRole("complementary", { name: "Primary navigation" })).toHaveCount(1);
      const mainBounds = await page.locator("main").boundingBox();
      expect(mainBounds?.x).toBeGreaterThan(0);

      // Exactly one navigation landmark at every desktop width. The header
      // used to carry a second `<nav>` from `xl` upward listing the same
      // destinations as the sidebar, so above 1280px a screen reader announced
      // the same menu twice. That nav has been removed; the sidebar is the
      // worker's desktop navigation at every width from `lg` up.
      await expect(page.getByRole("navigation", { name: "Worker primary navigation" })).toHaveCount(0);
      // The page title stays in the header at all widths now. It was
      // `xl:hidden` for workers only so the removed nav could take its place.
      await expect(page.locator("header").getByRole("heading", { level: 1 })).toBeVisible();
    } else {
      const bottomNavigation = page.getByRole("navigation", { name: "Worker mobile navigation" });
      await expect(bottomNavigation).toBeVisible();
      await expect(bottomNavigation.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
      await expect(bottomNavigation.getByRole("tab", { name: "Profile" }).getByText("DU")).toBeVisible();
      const menuButton = page.getByRole("button", { name: "Open navigation menu" });
      await menuButton.click();
      const drawer = page.getByRole("dialog", { name: "Navigation menu" });
      await expect(drawer).toBeVisible();
      await expect(page.getByRole("button", { name: "Close navigation menu" }).last()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(menuButton).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  const workerBottomNavigation = page.getByRole("navigation", { name: "Worker mobile navigation" });
  for (const target of [
    { label: "Jobs", path: "/worker/find-jobs" },
    { label: "E-Wallet", path: "/worker/e-wallet" },
    { label: "Messages", path: "/worker/messages" },
    { label: "Profile", path: "/worker/profile" },
  ]) {
    await workerBottomNavigation.getByRole("tab", { name: target.label }).click();
    await expect(page).toHaveURL(new RegExp(`${target.path.replaceAll("/", "\\/")}$`));
    await expect(workerBottomNavigation.getByRole("tab", { name: target.label })).toHaveAttribute("aria-selected", "true");
    await expect(workerBottomNavigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  }
  await page.goto("/worker/find-jobs");
  const workerLocalArea = page.getByRole("button", { name: /Quezon City.*Open Philippine location settings/i });
  await expect(workerLocalArea).toBeVisible();
  await workerLocalArea.click();
  await expect(page).toHaveURL(/\/worker\/settings\?tab=personal/);
  await expect(page.getByLabel("First name")).toBeVisible();
  await workerBottomNavigation.getByRole("tab", { name: "Jobs" }).click();
  await expect(page).toHaveURL(/\/worker\/find-jobs/);
  await page.goto("/worker/saved-jobs");
  await expect(workerBottomNavigation.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
  await expect(workerBottomNavigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  await page.goto("/worker/settings?tab=personal");
  await expect(page.getByRole("navigation", { name: "Worker mobile navigation" })).toBeVisible();
  await expect(workerBottomNavigation.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await expect(workerBottomNavigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  await page.getByRole("tab", { name: "Jobs" }).click();
  await page.waitForURL(/\/worker\/find-jobs/);
  await expect(page.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
  await page.goto("/settings?tab=privacy");
  await expect(page).toHaveURL(/\/worker\/settings\?tab=privacy/);
  await page.goto("/worker/find-jobs");
  const heroSearch = page.getByRole("searchbox", { name: "Search jobs" });
  await heroSearch.fill("designer");
  await expect(page).toHaveURL(/q=designer/);
  await expect(page.getByLabel("Sort jobs")).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/worker/find-jobs");
  await expect(page.getByTestId("header-context-action")).toHaveCount(0);
  const moreButton = page.getByRole("button", { name: "More" });
  await moreButton.click();
  await expect(page.getByRole("menu", { name: "More navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "More navigation" })).toBeHidden();
  await expect(moreButton).toBeFocused();
  await moreButton.click();
  await page.getByRole("menuitem", { name: "Saved Jobs" }).click();
  await page.waitForURL(/\/worker\/saved-jobs/);
  await expect(page.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
  await page.goto("/worker/find-jobs");
  const notificationsButton = page.locator('button[aria-label^="Notifications"]');
  await notificationsButton.click();
  await expect(page.getByRole("menu", { name: "Notifications" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(notificationsButton).toBeFocused();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(page.getByRole("menu", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "View profile" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeFocused();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: /Switch to Employer/i }).click();
  await page.waitForURL(/\/employer\//);
  await page.goto("/settings?tab=personal");
  await expect(page).toHaveURL(/\/employer\/settings\?tab=personal/);
  const employerBottomNavigation = page.getByRole("navigation", { name: "Employer mobile navigation" });
  await expect(employerBottomNavigation).toBeVisible();
  await expect(employerBottomNavigation.getByRole("tab", { name: "Profile" }).getByText("DU")).toBeVisible();
  await expect(employerBottomNavigation.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await expect(employerBottomNavigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  for (const target of [
    { label: "Home", path: "/employer/dashboard" },
    { label: "Applications", path: "/employer/applications" },
    { label: "Post Job", path: "/employer/post-job" },
    { label: "Messages", path: "/employer/messages" },
    { label: "Alerts", path: "/employer/notifications" },
    { label: "Profile", path: "/employer/profile" },
  ]) {
    await employerBottomNavigation.getByRole("tab", { name: target.label }).click();
    await expect(page).toHaveURL(new RegExp(`${target.path.replaceAll("/", "\\/")}$`));
    await expect(employerBottomNavigation.getByRole("tab", { name: target.label })).toHaveAttribute("aria-selected", "true");
    await expect(employerBottomNavigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  }
  await employerBottomNavigation.getByRole("tab", { name: "Home" }).click();
  await page.waitForURL(/\/employer\/dashboard/);
  await expect(page.getByRole("button", { name: /Quezon City.*Open Philippine location settings/i })).toBeVisible();
  await page.goto("/employer/applications");
  await expect(page.getByRole("heading", { name: /Applications/i }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
  // 304px is what the shell sets (`w-[304px]` in DashboardLayout.tsx, against
  // `w-[108px]` collapsed). The old 280 predates the sidebar being widened.
  expect((await page.getByRole("complementary", { name: "Primary navigation" }).boundingBox())?.width).toBe(304);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("profile settings support keyboard tabs and accessible validation", async ({ page }) => {
  await signInWorker(page);
  await page.route("https://psgc.gitlab.io/api/**", (route) => {
    const url = route.request().url();
    const body = url.endsWith("/provinces/")
      ? [{ code: "130000000", name: "Metro Manila" }]
      : url.endsWith("/cities-municipalities/")
        ? [{ code: "137404000", name: "Quezon City", provinceCode: "130000000" }]
        : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/worker/settings?tab=personal");
  const mainTabs = page.getByRole("tablist", { name: "Settings sections" });
  // `exact` because the accessible-name match is a substring by default, and
  // this tablist also contains "Account Verification" -- without it the locator
  // resolves to two elements and fails Playwright's strict-mode check.
  const accountTab = mainTabs.getByRole("tab", { name: "Account", exact: true });
  await expect(accountTab).toHaveAttribute("aria-selected", "true");
  await accountTab.focus();
  // The tab order is Account, Account Verification, Security & Privacy,
  // Payments. This used to expect one ArrowRight to land on Security & Privacy,
  // which stopped being true when the Verification tab was added between them
  // -- the roving tabindex was doing the right thing and the assertion had gone
  // stale. Step through both so the ordering itself is covered.
  await page.keyboard.press("ArrowRight");
  const verificationTab = mainTabs.getByRole("tab", { name: "Account Verification" });
  await expect(verificationTab).toBeFocused();
  await expect(verificationTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  const privacyTab = mainTabs.getByRole("tab", { name: "Security & Privacy" });
  await expect(privacyTab).toBeFocused();
  await expect(privacyTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(accountTab).toBeFocused();

  const accountTabs = page.getByRole("tablist", { name: "Account settings sections" });
  const personalTab = accountTabs.getByRole("tab", { name: "Personal Information" });
  await personalTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(accountTabs.getByRole("tab", { name: "Experience" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(personalTab).toBeFocused();

  // The name fields are read-only now (they mirror ID-verified data), so the
  // name-format rule this used to trip can no longer be reached through the
  // form. LinkedIn is the nearest still-editable field with a client-side rule,
  // and it exercises the same contract: the message is announced, focus moves
  // to the offending field, and that field is marked aria-invalid.
  const firstName = page.getByLabel("First name");
  await expect(firstName).not.toHaveValue("");
  const linkedin = page.getByLabel("LinkedIn URL");
  await linkedin.fill("ftp://example.com");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Scoped by id: the settings page can have a second `role="alert"` on screen
  // (the toast region), which makes a bare role query ambiguous.
  await expect(page.locator("#settings-profile-error")).toContainText(
    "LinkedIn must be a valid HTTPS URL.",
  );
  await expect(linkedin).toBeFocused();
  await expect(linkedin).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("admin user management is real and responsive", async ({ page }) => {
  await page.goto("/admin-sign-in");
  await page.getByPlaceholder("Enter your email").fill("e2e-admin@microjobs.local");
  await page.getByPlaceholder("Enter your password").fill("AdminPass123!");
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("header-context-action")).toHaveCount(0);
  for (const height of [600, 720, 768, 900]) {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    const navigation = page.getByRole("navigation", { name: "Admin menu" });
    const bounds = await sidebar.boundingBox();
    expect((await page.locator("header").boundingBox())?.height).toBe(64);
    expect(bounds?.y).toBe(0);
    expect(bounds?.height).toBe(height);
    // The admin menu has grown past what a short viewport can show without
    // scrolling (16 links across 5 groups) -- Sidebar.tsx deliberately makes
    // the <nav> internally scrollable for exactly this case, so overflowing
    // is fine as long as it scrolls rather than clipping content or breaking
    // layout. Only demand "fits with no scroll" when it actually fits.
    const navMetrics = await navigation.evaluate((element) => ({
      overflowing: element.scrollHeight > element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    if (navMetrics.overflowing) {
      expect(navMetrics.overflowY).toBe("auto");
    } else {
      expect(["auto", "visible"]).toContain(navMetrics.overflowY);
    }
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
  await page.getByRole("button", { name: "Add account" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add account" });
  await createDialog.getByLabel("First name").fill("Created");
  await createDialog.getByLabel("Last name").fill("Administrator");
  await createDialog.getByLabel("Email").fill("created-admin@microjobs.local");
  await createDialog.getByLabel("Temporary password").fill("TempAdmin123!");
  await createDialog.getByLabel("Role").selectOption("admin");
  await createDialog.getByRole("button", { name: "Create account" }).click();
  await expect(createDialog).toBeHidden();
  const createdAdminRow = page.getByRole("row").filter({ hasText: "created-admin@microjobs.local" });
  await expect(createdAdminRow).toBeVisible();
  await createdAdminRow.getByRole("button", { name: "Open user actions" }).click();
  await page.getByRole("button", { name: "Delete User" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete user" });
  await deleteDialog.getByRole("button", { name: "Delete user" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(createdAdminRow).toHaveCount(0);
  const roleFilter = page.getByLabel("Filter accounts by role");
  await roleFilter.selectOption("privileged");
  await expect(page.getByText("Superadmin").first()).toBeVisible();
  await roleFilter.selectOption("all");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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

test("notification menu loads unread data and marks all as read", async ({ page }) => {
  await signInWorker(page);
  let readAllCalls = 0;
  let hasUnreadNotification = true;
  await page.route("**/api/notifications**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH" && request.url().includes("/read-all")) {
      readAllCalls += 1;
      hasUnreadNotification = false;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "All notifications marked as read." }) });
      return;
    }
    if (request.method() === "GET") {
      // listNotifications (server/controllers/NotificationController.js) wraps
      // its payload as { notifications, unreadCount, nextCursor } -- the
      // client reads `payload.unreadCount` directly rather than counting
      // items itself, so a bare array here silently produces 0 unread.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: [{
            _id: "507f1f77bcf86cd799439011",
            type: "system",
            title: "Profile verified",
            message: "Your worker profile is ready.",
            readAt: hasUnreadNotification ? null : new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }],
          unreadCount: hasUnreadNotification ? 1 : 0,
          nextCursor: null,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/worker/find-jobs");
  const notificationButton = page.locator('button[aria-label^="Notifications"]');
  await expect(notificationButton).toHaveAttribute("aria-label", /1 unread/);
  await notificationButton.click();
  const notificationMenu = page.getByRole("menu", { name: "Notifications" });
  await expect(notificationMenu.getByText("Profile verified")).toBeVisible();
  await notificationMenu.getByRole("button", { name: "Mark all as read" }).click();
  await expect.poll(() => readAllCalls).toBe(1);
  await expect(notificationButton).toHaveAttribute("aria-label", "Notifications");
});
