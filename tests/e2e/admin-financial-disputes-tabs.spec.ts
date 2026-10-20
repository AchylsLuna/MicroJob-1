import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { FinancialDispute } from "../../client/src/services/api";

async function mockAdminDisputes(page: Page, staffRole: "support_staff" | "finance_team" | "superadmin") {
  const user = { id: "507f1f77bcf86cd799439011", email: "staff@example.com", firstName: "Test", lastName: "Staff", role: "admin", systemRole: "admin", staffRole, isVerified: true, status: "active" };
  const base: FinancialDispute = {
    id: "open-case", ticketId: "FD-OPEN", subject: "Unpaid work", investigationStatus: "UNDER_INVESTIGATION", settlementStatus: "PENDING", paymentStatus: "DISPUTED", fundStatus: "PARTIALLY_HELD",
    agreedJobAmount: 600, alreadyPaidAmount: 100, disputedAmount: 500, fundsHeldAmount: 300, outstandingAmount: 200,
    workerClaim: "The submitted work remains unpaid.", job: { title: "Park cleanup", description: "Clean the park grounds" }, worker: { firstName: "Maria", lastName: "Santos" }, employer: { companyName: "Cleanup Services" },
    evidence: [{ _id: "evidence-one", evidenceType: "PAYMENT_RECEIPT", uploaderRole: "worker", description: "Original payment receipt", fileUrl: "/uploads/receipt.pdf" }],
    messages: [{ _id: "message-one", authorRole: "support", createdAt: "2026-10-01T08:00:00Z", body: "Please share the payment receipt.", visibleToParties: true }],
    auditLogs: [{ _id: "audit-one", action: "DISPUTE_OPENED", timestamp: "2026-10-01T08:00:00Z" }],
  };
  const settlement = { settlementId: "settlement-one", settlementType: "PARTIAL_PAYMENT", decisionReason: "Release held funds.", workerSettlementAmount: 300, employerRefundAmount: 0, outstandingAmount: 200, financeUserId: "another-finance-user" };
  const disputes: FinancialDispute[] = [
    base,
    { ...base, id: "review-case", ticketId: "FD-REVIEW", investigationStatus: "FOR_FINANCE_REVIEW", investigationReport: { status: "COMPLETED" } },
    { ...base, id: "approval-case", ticketId: "FD-APPROVAL", investigationStatus: "PENDING_FINANCE_APPROVAL", investigationReport: { status: "COMPLETED" }, financeSettlement: settlement },
    { ...base, id: "self-case", ticketId: "FD-SELF", investigationStatus: "PENDING_FINANCE_APPROVAL", investigationReport: { status: "COMPLETED" }, financeSettlement: { ...settlement, financeUserId: user.id } },
  ];
  const mutations: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, user);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.endsWith("/auth/me")) body = { data: user };
    if (url.pathname.endsWith("/admin/finance/disputes")) body = disputes;
    if (request.method() === "POST") {
      const dispute = disputes.find((item) => url.pathname.includes(item.id))!;
      const payload = request.postData() ? request.postDataJSON() : {};
      mutations.push({ path: url.pathname, body: payload });
      if (url.pathname.endsWith("/assign-support")) dispute.assignedSupportUserId = { _id: user.id, firstName: "Test", lastName: "Staff" };
      if (url.pathname.endsWith("/messages")) dispute.messages = [...dispute.messages!, { _id: "new-message", authorRole: staffRole, body: payload.message, visibleToParties: payload.visibleToParties }];
      if (url.pathname.endsWith("/investigation-report")) { dispute.investigationReport = { ...payload, status: "COMPLETED" }; dispute.investigationStatus = "FOR_FINANCE_REVIEW"; }
      if (url.pathname.endsWith("/settlement")) { dispute.financeSettlement = { ...settlement, ...payload, financeUserId: user.id }; dispute.investigationStatus = "PENDING_FINANCE_APPROVAL"; }
      if (url.pathname.endsWith("/settlement/approve")) dispute.investigationStatus = "RESOLVED";
      body = { message: "Saved", dispute };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { mutations };
}

test("support uses evidence, conversation, investigation, and audit tabs without finance actions", async ({ page }) => {
  const state = await mockAdminDisputes(page, "support_staff");
  await page.goto("/admin/disputes");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  const tabs = page.getByRole("tablist", { name: "Case details" });
  await expect(tabs.getByRole("tab")).toHaveText(["Overview", "Evidence", "Conversation", "Investigation", "Audit trail"]);
  const overview = tabs.getByRole("tab", { name: "Overview", exact: true });
  await overview.focus();
  await overview.press("ArrowRight");
  const evidence = tabs.getByRole("tab", { name: "Evidence", exact: true });
  await expect(evidence).toBeFocused();
  const evidencePanel = page.getByRole("tabpanel", { name: "Evidence", exact: true });
  await expect(evidencePanel).toContainText("Original payment receipt");
  await expect(evidencePanel.getByRole("link", { name: "Open evidence" })).toHaveAttribute("href", /\/uploads\/receipt\.pdf$/);
  await page.getByRole("button", { name: "Assign to me and investigate", exact: true }).click();
  await expect(evidencePanel).toContainText("Assigned to Test Staff");
  await page.getByRole("textbox", { name: "Evidence request", exact: true }).fill("Please upload a receipt.");
  await tabs.getByRole("tab", { name: "Conversation", exact: true }).click();
  await page.getByRole("textbox", { name: "Add investigation note or participant message", exact: true }).fill("Internal draft note");
  await page.getByLabel("Visible to worker and employer").uncheck();
  await evidence.click();
  await expect(page.getByRole("textbox", { name: "Evidence request", exact: true })).toHaveValue("Please upload a receipt.");
  await page.getByRole("button", { name: "Request evidence", exact: true }).click();
  await tabs.getByRole("tab", { name: "Conversation", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Add investigation note or participant message", exact: true })).toHaveValue("Internal draft note");
  await page.getByRole("button", { name: "Add message", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Conversation", exact: true })).toContainText("Internal draft note");
  expect(state.mutations.at(-1)?.body).toEqual({ message: "Internal draft note", visibleToParties: false });
  await tabs.getByRole("tab", { name: "Investigation", exact: true }).click();
  await page.getByLabel("work Completion Findings", { exact: true }).fill("Work was completed.");
  await page.getByRole("button", { name: "Complete report and forward to Finance", exact: true }).click();
  await expect(tabs.getByRole("tab", { name: "Investigation", exact: true })).toHaveCount(0);
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: "Settlement", exact: true })).toHaveCount(0);
  await tabs.getByRole("tab", { name: "Audit trail", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Audit trail", exact: true })).toContainText("DISPUTE OPENED");
  await page.getByRole("button", { name: /FD-APPROVAL/ }).click();
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Settlement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve and process settlement", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit settlement for approval", exact: true })).toHaveCount(0);
});

test("finance retains settlement confirmations and cannot approve its own decision", async ({ page }) => {
  const state = await mockAdminDisputes(page, "finance_team");
  await page.goto("/admin/disputes");
  await expect(page.getByRole("tab", { name: "Investigation", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await expect(page.getByRole("button", { name: "Assign to me and investigate", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /FD-REVIEW/ }).click();
  await page.getByRole("tab", { name: "Settlement", exact: true }).click();
  await page.getByLabel("Settlement outcome").selectOption("PARTIAL_PAYMENT");
  await page.getByLabel("Worker amount", { exact: true }).fill("300");
  await page.getByLabel("Employer refund", { exact: true }).fill("0");
  await page.getByLabel("Mandatory decision reason").fill("Release held funds.");
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await page.getByRole("tab", { name: "Settlement", exact: true }).click();
  await expect(page.getByLabel("Mandatory decision reason")).toHaveValue("Release held funds.");
  await page.getByRole("button", { name: "Submit settlement for approval", exact: true }).click();
  expect(state.mutations).toHaveLength(0);
  await page.getByRole("dialog", { name: "Submit Finance settlement?", exact: true }).getByRole("button", { name: "Submit for approval", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve and process settlement", exact: true })).toBeDisabled();
  expect(state.mutations[0].body).toEqual({ settlementType: "PARTIAL_PAYMENT", workerAmount: 300, employerRefund: 0, decisionReason: "Release held funds." });
  await page.getByRole("button", { name: /FD-APPROVAL/ }).click();
  await page.getByRole("tab", { name: "Settlement", exact: true }).click();
  await page.getByRole("button", { name: "Approve and process settlement", exact: true }).click();
  expect(state.mutations).toHaveLength(1);
  await page.getByRole("dialog", { name: "Approve and process settlement?", exact: true }).getByRole("button", { name: "Approve and process", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve and process settlement", exact: true })).toHaveCount(0);
  expect(state.mutations.at(-1)?.path).toBe("/api/admin/finance/disputes/approval-case/settlement/approve");
  await page.getByRole("button", { name: /FD-SELF/ }).click();
  await page.getByRole("tab", { name: "Settlement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve and process settlement", exact: true })).toBeDisabled();
});

test("admin dispute tabs match the participant layout at phone, tablet, and laptop widths", async ({ page }) => {
  await mockAdminDisputes(page, "superadmin");
  await page.goto("/admin/disputes");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: "Financial Disputes", exact: true })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Case details" });
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await Promise.all((await tabs.getByRole("tab").all()).map((tab) => tab.boundingBox()));
    expect(new Set(bounds.map((bound) => bound!.y)).size).toBe(1);
    if (width === 375) expect(await tabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    for (const name of ["Overview", "Evidence", "Conversation", "Investigation", "Audit trail"]) {
      await tabs.getByRole("tab", { name, exact: true }).click();
      await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    if (width >= 1024) {
      const cases = await page.getByRole("heading", { name: "Cases", exact: true }).boundingBox();
      const details = await tabs.boundingBox();
      expect(details!.x).toBeGreaterThan(cases!.x + cases!.width);
      expect(details!.y).toBeLessThan(cases!.y);
    }
    await tabs.getByRole("tab", { name: "Evidence", exact: true }).click();
    if ([375, 1024].includes(width)) {
      await page.getByRole("tabpanel", { name: "Evidence", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.agent/admin-disputes-evidence-${width}.png` });
    }
  }
  const results = await new AxeBuilder({ page }).include('[role="tablist"]').include('[role="tabpanel"]').analyze();
  expect(results.violations).toEqual([]);
});
