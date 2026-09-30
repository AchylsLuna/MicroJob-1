import { expect, test } from "@playwright/test";

const storedUser = {
  id: "507f1f77bcf86cd799439012",
  email: "draft-worker@microjobs.local",
  firstName: "Initial",
  lastName: "Worker",
  role: "work",
  systemRole: "work",
  accountType: "worker",
  accountOptions: ["worker"],
  isVerified: true,
};

test("profile and settings load once while settings preserves an in-progress draft", async ({ page }) => {
  let profileRequests = 0;

  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, storedUser);

  await page.route("https://psgc.gitlab.io/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/api/auth/me")) {
      profileRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ...storedUser, firstName: "Server", lastName: "Profile" } }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/settings?tab=personal");
  // "About Me" rather than "First name": the name fields are deliberately
  // locked now (they mirror ID-verified data, so Settings.tsx renders them
  // `readOnly`), which made this test's premise impossible -- it was typing
  // into a field the product no longer lets anyone type into. The behaviour
  // under test is unchanged: an in-flight /auth/me refresh must not overwrite
  // what the user is part-way through editing.
  const draftField = page.getByLabel("About Me");
  await draftField.fill("My unsaved draft");

  await expect(page.getByText("Loading profile...")).toBeHidden();
  await expect(draftField).toHaveValue("My unsaved draft");
  await page.waitForTimeout(750);
  await expect(draftField).toHaveValue("My unsaved draft");
  expect(profileRequests).toBe(1);

  await page.goto("/worker/profile");
  await expect(page.getByLabel("Refreshing profile")).toBeHidden();
  await page.waitForTimeout(750);
  expect(profileRequests).toBe(2);
});
