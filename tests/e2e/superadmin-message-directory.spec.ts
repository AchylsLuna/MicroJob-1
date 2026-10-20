import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mockMessaging(page: Page, role = "superadmin", failFirst = false, staffRole: string | null = "admin_team") {
  const user = { id: "507f1f77bcf86cd799439011", email: "owner@example.com", firstName: "Test", lastName: "Owner", role, systemRole: role, staffRole: role === "superadmin" ? "superadmin" : role === "admin" ? staffRole : null, isVerified: true, status: "active" };
  const recipients = Array.from({ length: 25 }, (_, index) => ({
    id: `507f1f77bcf86cd799439${String(index + 100).padStart(3, "0")}`,
    name: index === 0 ? "Ana Finance" : index === 1 ? "Maria Santos" : `Person ${String(index).padStart(2, "0")}`,
    email: index === 0 ? "ana@example.com" : `person${index}@example.com`,
    role: index === 0 ? "finance_team" : index % 2 ? "work" : "hire",
    isStaff: index === 0,
  }));
  const state = { queries: [] as string[], messages: [] as Record<string, unknown>[] };
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, user);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    let status = 200;
    if (url.pathname.endsWith("/auth/me")) body = { data: user };
    if (url.pathname.endsWith("/messages/recipients")) {
      state.queries.push(url.search);
      if (failFirst && state.queries.length === 1) { status = 500; body = { message: "Temporary test failure" }; }
      else {
        const search = (url.searchParams.get("search") || "").toLowerCase();
        const audience = url.searchParams.get("audience");
        const matches = recipients.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(search) && (audience === "admins" ? item.isStaff : audience === "users" ? !item.isStaff : true));
        const pageNumber = Number(url.searchParams.get("page") || 1);
        body = { data: { recipients: matches.slice((pageNumber - 1) * 20, pageNumber * 20), page: pageNumber, pageCount: Math.max(1, Math.ceil(matches.length / 20)), pageSize: 20, total: matches.length } };
      }
    }
    if (url.pathname.endsWith("/messages") && request.method() === "POST") {
      const payload = request.postDataJSON();
      state.messages.push(payload);
      body = { data: { _id: `message-${state.messages.length}`, sender: { _id: user.id }, receiver: { _id: payload.receiverId }, content: payload.content, clientMessageId: payload.clientMessageId, createdAt: new Date().toISOString() } };
      status = 201;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(role === "work" ? "/worker/messages" : role === "hire" ? "/employer/messages" : "/admin/messages");
  return { state, recipients };
}

async function openDirectory(page: Page) {
  await page.getByRole("button", { name: "New message", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a recipient", exact: true });
  await expect(dialog.getByRole("table")).toBeVisible();
  return dialog;
}

test("superadmin searches, filters, and pages through recipients", async ({ page }) => {
  await mockMessaging(page);
  const dialog = await openDirectory(page);
  await expect(dialog.getByRole("row")).toHaveCount(21);
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog).toContainText("Showing 21–25 of 25");
  await expect(dialog.getByRole("row")).toHaveCount(6);
  await dialog.getByLabel("Search people", { exact: true }).fill("Maria Santos");
  await expect(dialog).toContainText("Showing 1–1 of 1");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  await dialog.getByLabel("Search people", { exact: true }).fill("ana@example.com");
  await expect(dialog.getByRole("button", { name: "Message Ana Finance", exact: true })).toBeVisible();
  await dialog.getByLabel("Search people", { exact: true }).fill("");
  await dialog.getByLabel("Recipient group").selectOption("admins");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  await expect(dialog).toContainText("Finance team");
  await dialog.getByLabel("Recipient group").selectOption("users");
  await expect(dialog).toContainText("Showing 1–20 of 24");
  await expect(dialog.getByRole("button", { name: "Message Ana Finance", exact: true })).toHaveCount(0);
  await dialog.getByLabel("Search people", { exact: true }).fill("no-such-person");
  await expect(dialog.getByRole("status")).toHaveText("No people match your search.");
});

test("selecting staff or a user opens the existing composer and sends to that recipient", async ({ page }) => {
  const { state, recipients } = await mockMessaging(page);
  for (const recipient of recipients.slice(0, 2)) {
    const dialog = await openDirectory(page);
    await dialog.getByRole("button", { name: `Message ${recipient.name}`, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: `View ${recipient.name}'s profile`, exact: true })).toBeVisible();
    if (recipient.isStaff) await expect(page.getByRole("button", { name: `View ${recipient.name}'s profile`, exact: true })).toBeDisabled();
    expect(state.messages).toHaveLength(recipients.indexOf(recipient));
    await page.getByRole("textbox", { name: "Message", exact: true }).fill(`Hello ${recipient.name}`);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect.poll(() => state.messages.length).toBe(recipients.indexOf(recipient) + 1);
    expect(state.messages.at(-1)).toMatchObject({ receiverId: recipient.id, content: `Hello ${recipient.name}` });
    expect(state.messages.at(-1)).not.toHaveProperty("jobId");
  }
});

test("directory retries a failed request and fits phone, tablet, and desktop", async ({ page }) => {
  await mockMessaging(page, "superadmin", true);
  await page.getByRole("button", { name: "New message", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a recipient", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("Unable to load recipients.");
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(dialog.getByRole("table")).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(dialog.getByLabel("Search people", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close dialog", exact: true })).toBeVisible();
  }
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(result.violations).toEqual([]);
});

for (const staffRole of ["admin_team", "moderator", "finance_team", "analytics_team", "support_staff", null]) {
  test(`${staffRole || "legacy admin"} can start a user warning conversation`, async ({ page }) => {
    const { state, recipients } = await mockMessaging(page, "admin", false, staffRole);
    const dialog = await openDirectory(page);
    await dialog.getByLabel("Recipient group").selectOption("users");
    await dialog.getByLabel("Search people", { exact: true }).fill("Maria Santos");
    await dialog.getByRole("button", { name: "Message Maria Santos", exact: true }).click();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Possible scam: please review this job before sharing information.");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect.poll(() => state.messages.length).toBe(1);
    expect(state.messages[0]).toMatchObject({ receiverId: recipients[1].id, content: "Possible scam: please review this job before sharing information." });
  });
}

for (const role of ["work", "hire"]) {
  test(`${role} cannot open the staff directory`, async ({ page }) => {
    const { state } = await mockMessaging(page, role);
    await expect(page.getByRole("textbox", { name: "Search conversations", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New message", exact: true })).toHaveCount(0);
    expect(state.queries).toEqual([]);
  });
}
