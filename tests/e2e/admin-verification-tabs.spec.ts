import { expect, test, type Page } from "@playwright/test";

const admin = { id: "507f1f77bcf86cd799439011", email: "verification-admin@example.com", firstName: "Test", lastName: "Admin", role: "admin", systemRole: "admin", staffRole: "moderator", status: "active", isVerified: true };
const userId = "507f1f77bcf86cd799439012";
const recordId = "507f1f77bcf86cd799439013";

async function mockVerification(page: Page, options: { empty?: boolean; failRevoke?: boolean } = {}) {
  const mutations: Array<{ path: string; body: unknown }> = [];
  let verified = true;
  let addressStatus = "in-review";
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, admin);
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith("/auth/me")) body = { data: admin };
    if (path.endsWith("/admin/government-id-verifications")) body = options.empty ? [] : [{ _id: recordId, user: { _id: userId, role: "work" }, userName: "Alex Santos", govIdName: "Alex Maria Santos", documentType: "Philippine Passport", date: "2026-10-13T08:00:00Z", verified }];
    if (path.endsWith("/admin/users")) body = [{ _id: userId, firstName: "Alex", lastName: "Santos", email: "alex@example.com", role: "work", status: "active", verification: { identityDocument: { status: "in-review", documentUrl: "/uploads/id.png" }, addressDocument: { status: addressStatus, documentUrl: "/uploads/address.pdf" } } }];
    if (path.endsWith("/admin/stats") || path.endsWith("/admin/wallets")) body = {};
    if (path.endsWith("/admin/analytics-data")) body = { stats: {}, users: [], jobs: [], transactions: [] };
    if (req.method() === "PATCH") {
      mutations.push({ path, body: req.postDataJSON() });
      if (path.endsWith("/revoke")) {
        if (options.failRevoke) { status = 500; body = { message: "Unable to save revocation." }; }
        else { verified = false; body = { verified: false, verificationId: recordId }; }
      } else { addressStatus = req.postDataJSON().status; body = { verified: addressStatus === "complete" }; }
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return mutations;
}

test("Government ID shows recorded details and a profile link, confirms revocation and preserves the record", async ({ page }) => {
  const mutations = await mockVerification(page);
  await page.goto("/admin/verification");
  await expect(page.getByRole("tab", { name: "Government ID", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("columnheader")).toHaveText(["User Name", "Full Name in Government ID", "Government ID type", "Date verified", "Actions"]);
  const row = page.getByRole("row", { name: /Alex Santos/ });
  await expect(row).toContainText("Alex Maria Santos");
  await expect(row).toContainText("Philippine Passport");
  await expect(row.getByRole("link", { name: "View profile" })).toHaveAttribute("href", `/profiles/${userId}?viewAs=worker`);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View document" })).toHaveCount(0);
  await page.screenshot({ path: ".agent/admin-government-id-desktop.png", fullPage: true });
  await row.getByRole("button", { name: "Revoke verification" }).click();
  expect(mutations).toHaveLength(0);
  const dialog = page.getByRole("dialog", { name: "Revoke verification", exact: true });
  await dialog.getByRole("button", { name: "Revoke verification", exact: true }).click();
  await expect(row.getByRole("button", { name: "Verification revoked" })).toBeDisabled();
  await expect(row).toContainText("Alex Maria Santos");
  expect(mutations).toEqual([{ path: `/api/admin/government-id-verifications/${recordId}/revoke`, body: {} }]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Verification revoked" })).toBeDisabled();
});

test("Proof of Address retains its document, approval and required-reason rejection workflow", async ({ page }) => {
  const mutations = await mockVerification(page);
  await page.goto("/admin/verification");
  await page.getByRole("tab", { name: "Proof of Address", exact: true }).click();
  await expect(page.getByRole("columnheader")).toHaveText(["Applicant", "Document", "Actions"]);
  await expect(page.getByRole("link", { name: "View document" })).toHaveAttribute("href", /\/uploads\/address\.pdf$/);
  await expect(page.getByRole("table").getByText("Government ID")).toHaveCount(0);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reject submission" });
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(dialog.getByText("A reason is required to reject a submission.")).toBeVisible();
  expect(mutations).toHaveLength(0);
  await dialog.getByRole("textbox", { name: "Reason" }).fill("Please upload a recent utility bill.");
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByText("Nothing awaiting review")).toBeVisible();
  expect(mutations[0]).toEqual({ path: `/api/admin/verifications/${userId}/address`, body: { status: "rejected", rejectionReason: "Please upload a recent utility bill." } });
  await mockVerification(page);
  await page.reload();
  await page.getByRole("tab", { name: "Proof of Address", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Nothing awaiting review")).toBeVisible();
});

test("revocation failure leaves verification active and displays the error", async ({ page }) => {
  await mockVerification(page, { failRevoke: true });
  await page.goto("/admin/verification");
  await page.getByRole("button", { name: "Revoke verification" }).click();
  const dialog = page.getByRole("dialog", { name: "Revoke verification", exact: true });
  await dialog.getByRole("button", { name: "Revoke verification" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Unable to save revocation.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Revoke verification" })).toBeEnabled();
});

test("tabs support keyboard navigation, empty records and phone layouts", async ({ page }) => {
  await mockVerification(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/admin/verification");
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".agent/admin-government-id-phone.png", fullPage: true });
  await page.getByRole("tab", { name: "Government ID", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Proof of Address", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Government ID", exact: true })).toBeFocused();
  await mockVerification(page, { empty: true });
  await page.reload();
  await expect(page.getByText("No Government ID verification records", { exact: true })).toBeVisible();
});
