import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { FinancialDispute } from "../../client/src/services/api";

async function mockDisputes(page: Page, accountType: "worker" | "employer", appealOnly = false) {
  const user = { id: "507f1f77bcf86cd799439011", email: "disputes@example.com", firstName: "Test", lastName: "User", role: accountType === "worker" ? "work" : "hire", systemRole: accountType === "worker" ? "work" : "hire", accountType, accountOptions: [accountType], isVerified: true };
  const openCase: FinancialDispute = {
    id: "open-case", ticketId: "FD-OPEN", subject: "Unpaid work", investigationStatus: "AWAITING_EMPLOYER_RESPONSE", settlementStatus: "PENDING", paymentStatus: "DISPUTED", fundStatus: "PARTIALLY_HELD",
    agreedJobAmount: 600, alreadyPaidAmount: 100, disputedAmount: 500, fundsHeldAmount: 300, outstandingAmount: 200,
    workerClaim: "The submitted work remains unpaid.", job: { title: "Park cleanup" }, worker: { firstName: "Maria", lastName: "Santos" }, employer: { companyName: "Cleanup Services" },
    evidence: [{ _id: "evidence-one", evidenceType: "CHAT_REFERENCE", uploaderRole: "worker", description: "Original payment discussion" }], messages: [{ _id: "message-one", authorRole: "support", createdAt: "2026-10-01T08:00:00Z", body: "Please share the payment receipt." }],
  };
  const settlement = { settlementId: "settlement-one", settlementType: "PARTIAL_PAYMENT", decisionReason: "Release held funds and record outstanding payment.", workerSettlementAmount: 300, employerRefundAmount: 0, outstandingAmount: 200 };
  const closedCase: FinancialDispute = { ...openCase, id: "closed-case", ticketId: "FD-CLOSED", investigationStatus: "RESOLVED", employerResponse: "The payment was partial.", financeSettlement: appealOnly ? undefined : settlement, settlementHistory: appealOnly ? [] : [{ ...settlement, settlementId: "previous-settlement" }] };
  const disputes = [openCase, closedCase];
  const mutations: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, user);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.endsWith("/auth/me")) body = { data: user };
    if (url.pathname.endsWith("/financial-disputes")) body = { disputes };
    if (request.method() === "POST") {
      const dispute = disputes.find((item) => url.pathname.includes(item.id))!;
      const payload = request.postDataJSON();
      mutations.push({ path: url.pathname, body: payload });
      if (url.pathname.endsWith("/messages")) dispute.messages!.push({ _id: "new-message", authorRole: accountType, createdAt: "2026-10-02T08:00:00Z", body: payload.message });
      if (url.pathname.endsWith("/employer-response")) dispute.employerResponse = payload.response;
      if (url.pathname.endsWith("/appeal")) dispute.appealSubmittedAt = "2026-10-02T08:00:00Z";
      body = { message: "Saved", dispute };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { mutations };
}

test("Settlement disappears and Overview becomes active when its last available action is completed", async ({ page }) => {
  await mockDisputes(page, "employer", true);
  await page.goto("/employer/financial-disputes");
  await page.getByRole("button", { name: /FD-CLOSED/ }).click();
  await page.getByRole("tab", { name: "Settlement", exact: true }).click();
  await page.getByLabel("Why should this decision be reviewed?").fill("Please review the receipt.");
  await page.getByRole("button", { name: "Submit appeal", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Settlement", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Overview", exact: true })).toBeVisible();
});

for (const accountType of ["worker", "employer"] as const) {
  test(`${accountType} dispute tabs support keyboard navigation, preserve drafts, and reset for another case`, async ({ page }) => {
    const state = await mockDisputes(page, accountType);
    await page.goto(`/${accountType}/financial-disputes`);
    const tabs = page.getByRole("tablist", { name: "Case details" });
    const overview = tabs.getByRole("tab", { name: "Overview" });
    await expect(overview).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab")).toHaveText(["Overview", "Evidence", "Conversation"]);
    await expect(page.getByRole("tabpanel", { name: "Overview" })).toContainText("The submitted work remains unpaid.");
    await overview.focus();
    await overview.press("ArrowRight");
    const evidence = tabs.getByRole("tab", { name: "Evidence" });
    await expect(evidence).toBeFocused();
    await expect(evidence).toHaveAttribute("tabindex", "0");
    await expect(overview).toHaveAttribute("tabindex", "-1");
    await expect(page.getByRole("tabpanel", { name: "Evidence" })).toContainText("Original payment discussion");
    await page.getByLabel("Evidence statement").fill("Draft evidence reference");
    await page.getByLabel("File (optional for chat reference)").setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("test receipt") });
    await evidence.press("ArrowRight");
    const conversation = tabs.getByRole("tab", { name: "Conversation" });
    await expect(conversation).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Conversation" })).toContainText("Please share the payment receipt.");
    await page.getByLabel("Response", { exact: true }).fill("Please review my receipt.");
    await conversation.press("ArrowRight");
    await expect(overview).toBeFocused();
    await overview.press("ArrowLeft");
    await expect(conversation).toBeFocused();
    await page.getByRole("button", { name: "Send response", exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: "Conversation" })).toContainText("Please review my receipt.");
    await conversation.press("Home");
    await expect(overview).toBeFocused();
    if (accountType === "employer") {
      await page.getByLabel("Employer explanation").fill("I am checking the payment.");
      await page.getByRole("button", { name: "Submit response", exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: "Overview" })).toContainText("I am checking the payment.");
    }
    await overview.press("End");
    await expect(conversation).toBeFocused();
    await evidence.click();
    await expect(page.getByLabel("Evidence statement")).toHaveValue("Draft evidence reference");
    expect(await page.getByLabel("File (optional for chat reference)").evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("receipt.pdf");
    await page.getByRole("button", { name: /FD-CLOSED/ }).click();
    await expect(overview).toHaveAttribute("aria-selected", "true");
    const settlement = tabs.getByRole("tab", { name: "Settlement" });
    await settlement.click();
    const panel = page.getByRole("tabpanel", { name: "Settlement" });
    await expect(panel.getByRole("heading", { name: "Finance settlement", exact: true })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Previous Finance decisions" })).toBeVisible();
    await page.getByLabel("Why should this decision be reviewed?").fill("Please consider the new receipt.");
    await page.getByRole("button", { name: "Submit appeal", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Appeal decision" })).toHaveCount(0);
    await expect(settlement).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: /FD-OPEN/ }).click();
    await expect(overview).toHaveAttribute("aria-selected", "true");
    await expect(settlement).toHaveCount(0);
    expect(state.mutations.map((call) => call.path)).toEqual([
      "/api/financial-disputes/open-case/messages",
      ...(accountType === "employer" ? ["/api/financial-disputes/open-case/employer-response"] : []),
      "/api/financial-disputes/closed-case/appeal",
    ]);
    const accessibility = await new AxeBuilder({ page }).include('[role="tablist"]').include('[role="tabpanel"]').analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test(`${accountType} dispute tabs stay in one row and cases split at laptop width`, async ({ page }) => {
    await mockDisputes(page, accountType);
    await page.goto(`/${accountType}/financial-disputes`);
    await page.getByRole("button", { name: "Reject all", exact: true }).click();
    await page.getByRole("button", { name: /FD-CLOSED/ }).click();
    const tablist = page.getByRole("tablist", { name: "Case details" });
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await Promise.all((await tablist.getByRole("tab").all()).map((tab) => tab.boundingBox()));
      expect(new Set(bounds.map((bound) => bound!.y)).size).toBe(1);
      if (width === 375) expect(await tablist.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      for (const name of ["Overview", "Evidence", "Conversation", "Settlement"]) {
        await tablist.getByRole("tab", { name, exact: true }).click();
        await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (accountType === "employer" && [375, 1024].includes(width)) {
          await page.getByRole("tabpanel", { name, exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: `.agent/financial-disputes-${name.toLowerCase()}-${width}.png` });
        }
      }
      if (width >= 1024) {
        const cases = await page.getByRole("heading", { name: "Cases", exact: true }).boundingBox();
        const details = await tablist.boundingBox();
        expect(details!.x).toBeGreaterThan(cases!.x + cases!.width);
        expect(details!.y).toBeLessThan(cases!.y);
      }
    }
  });
}
