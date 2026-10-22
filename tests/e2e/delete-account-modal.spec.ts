import { expect, test, type Page } from "@playwright/test";
import { expectOverlayWellPlaced } from "./overlayHelpers";

async function mockSettings(page: Page, account: "worker" | "employer" = "worker") {
  const user = {
    id: "507f1f77bcf86cd799439012", email: "delete-modal@example.ph", firstName: "Modal", lastName: "Account",
    role: account === "worker" ? "user" : "employer", accountType: account, accountOptions: [account], isVerified: true,
  };
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("delete_modal_fixture_initialized")) {
      localStorage.setItem("auth_user", JSON.stringify(value));
      localStorage.setItem("current_user", JSON.stringify(value));
      localStorage.setItem("cookie_consent_v1", JSON.stringify({ necessary: true, decidedAt: "2026-10-13T00:00:00Z" }));
      sessionStorage.setItem("delete_modal_fixture_initialized", "true");
    }
  }, user);
  await page.route("**/api/**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(new URL(route.request().url()).pathname.endsWith("/auth/me") ? { data: user } : []),
  }));
  await page.goto(`/${account}/settings?tab=privacy`);
  return page.getByRole("button", { name: "Delete account", exact: true });
}

for (const [width, height] of [[280, 653], [375, 667], [667, 375], [1440, 900]]) {
  test(`delete account modal fits and cancels without deleting at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const trigger = await mockSettings(page);
    let deletionCalls = 0;
    await page.route("**/api/auth/me/delete", (route) => {
      deletionCalls += 1;
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Test deletion rejected." }) });
    });
    await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Delete account", exact: true });
    const password = dialog.getByLabel("Current password", { exact: true });
    const confirmation = dialog.getByLabel("Type DELETE to confirm", { exact: true });
    const submit = dialog.getByRole("button", { name: "Delete my account", exact: true });
    await expect(password).toBeFocused();
    await expectOverlayWellPlaced(page, dialog, "delete account confirmation");
    await expect(submit).toBeDisabled();
    await confirmation.fill("DELETE");
    await expect(submit).toBeDisabled();
    await password.fill("ConfirmationPass1!");
    await confirmation.fill("REMOVE");
    await expect(submit).toBeDisabled();
    await confirmation.fill("DELETE");
    await expect(submit).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(password).toHaveValue("");
    await expect(confirmation).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(deletionCalls).toBe(0);
  });
}

test("delete account modal blocks dismissal and repeat submission while pending and preserves errors", async ({ page }) => {
  const trigger = await mockSettings(page, "employer");
  let deletionCalls = 0;
  let submitted: unknown;
  let finishRequest!: () => void;
  const pending = new Promise<void>((resolve) => { finishRequest = resolve; });
  await page.route("**/api/auth/me/delete", async (route) => {
    deletionCalls += 1;
    submitted = route.request().postDataJSON();
    await pending;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Current password is incorrect." }) });
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete account", exact: true });
  await dialog.getByLabel("Current password", { exact: true }).fill("ConfirmationPass1!");
  await dialog.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
  await dialog.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect.poll(() => deletionCalls).toBe(1);
  expect(submitted).toEqual({ currentPassword: "ConfirmationPass1!", confirm: "DELETE" });
  await expect(dialog.getByRole("button", { name: "Deleting...", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Close dialog", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Type DELETE to confirm", { exact: true }).press("Enter");
  expect(deletionCalls).toBe(1);
  finishRequest();
  await expect(dialog.getByRole("alert")).toHaveText("Current password is incorrect.");
  await expect(dialog.getByLabel("Current password", { exact: true })).toHaveValue("ConfirmationPass1!");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete my account", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
});

test("successful mocked deletion signs out and returns to sign-in", async ({ page }) => {
  const trigger = await mockSettings(page);
  let deletionCalls = 0;
  await page.route("**/api/auth/me/delete", (route) => {
    deletionCalls += 1;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ message: "Account deleted." }) });
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete account", exact: true });
  await dialog.getByLabel("Current password", { exact: true }).fill("ConfirmationPass1!");
  await dialog.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
  await dialog.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome Back!", exact: true })).toBeVisible();
  expect(deletionCalls).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("auth_user"))).toBeNull();
});
