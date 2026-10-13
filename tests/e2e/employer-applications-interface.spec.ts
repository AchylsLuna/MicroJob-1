import { expect, test, type Page } from "@playwright/test";

const employer = { id: "507f1f77bcf86cd799439011", email: "interface@example.com", firstName: "Test", lastName: "Employer", role: "hire", systemRole: "hire", accountType: "employer", accountOptions: ["employer"], isVerified: true };
const jobs = [
  { _id: "job-one", title: "Park cleanup", salary: 500 },
  { _id: "job-two", title: "Garden planting", salary: 700 },
  { _id: "job-empty", title: "Delivery assistance", salary: 600 },
  { _id: "job-refunded", title: "Refunded listing", salary: 600, status: "Full refund" },
];

async function mockApplications(page: Page, options: { accepted?: boolean } = {}) {
  const applications = jobs.slice(0, 2).map((job, index) => ({
    _id: `app-${index}`, job, status: options.accepted ? "Offer Sent" : "Applied", createdAt: "2026-10-01T08:00:00Z", employerHidden: false,
    applicant: { _id: `worker-${index}`, firstName: index === 0 ? "Maria" : "Juan", lastName: "Santos", email: `worker${index}@example.com`, resumeUrl: "/uploads/resume.pdf" },
    offer: options.accepted ? { id: `offer-${index}`, status: "accepted", amount: job.salary } : null,
    workStatus: "In Progress", paymentStatus: "Secured", agreedAmount: job.salary,
  }));
  const mutations: Array<{ path: string; body: unknown }> = [];
  const applicationQueries: URL[] = [];
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, employer);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.endsWith("/auth/me")) body = { data: employer };
    if (url.pathname.endsWith("/jobs/history")) body = jobs;
    if (url.pathname.endsWith("/jobs/mine")) body = jobs.filter((job) => job.status !== "Full refund");
    if (url.pathname.endsWith("/reviews/eligible")) body = { asWorker: [], asEmployer: [] };
    if (url.pathname.endsWith("/applications/employer")) {
      applicationQueries.push(url);
      body = applications.filter((application) => application.job._id === url.searchParams.get("jobId") && (url.searchParams.get("includeHidden") === "true" || !application.employerHidden));
    }
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      mutations.push({ path: url.pathname, body: request.postData() ? request.postDataJSON() : null });
      const application = applications[0];
      if (url.pathname.endsWith("/status")) application.status = request.postDataJSON().status;
      if (url.pathname.endsWith("/offers")) {
        application.status = "Offer Sent";
        application.offer = { id: "offer-0", status: "pending", amount: request.postDataJSON().amount };
        body = { offer: application.offer };
      }
      if (url.pathname.endsWith("/confirm-hire")) {
        application.status = "Hired";
        application.offer!.status = "hired";
        body = { application, offer: application.offer };
      }
      if (url.pathname.endsWith("/cancel")) {
        application.status = "Shortlisted";
        application.offer!.status = "cancelled";
        body = { offer: application.offer };
      }
      if (url.pathname.endsWith("/payment/authorize")) { application.paymentStatus = "Authorized"; body = { application }; }
      if (url.pathname.endsWith("/employer/remove")) application.employerHidden = true;
      if (url.pathname.endsWith("/employer/restore")) application.employerHidden = false;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return {
    mutations, applicationQueries,
    respond: (reject = false) => {
      applications[0].offer!.status = reject ? "rejected" : "accepted";
      if (reject) applications[0].status = "Shortlisted";
    },
  };
}

test("table scopes applicants to every posted job, including empty jobs, and restores hidden rows", async ({ page }) => {
  const state = await mockApplications(page);
  await page.goto("/employer/applications");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText(["Name", "Stage", "Interview", "Applied on", "Resume", "View Profile", "Actions", "Hide"]);
  await expect(page.getByRole("button", { name: "Board", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Job", { exact: true }).locator("option")).toHaveText(jobs.map((job) => job.title));
  await expect(page.getByRole("heading", { name: jobs[0].title, exact: true })).toBeVisible();
  const maria = page.getByRole("row", { name: /Maria Santos/ });
  await expect(maria.getByRole("link", { name: "View Resume" })).toHaveAttribute("href", /\/uploads\/resume\.pdf$/);
  await maria.getByRole("button", { name: "Interview", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Schedule Interview" })).toBeVisible();
  await page.getByRole("dialog", { name: "Schedule Interview" }).getByRole("button", { name: /close/i }).click();
  await maria.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(maria).toHaveCount(0);
  await page.getByLabel("Show hidden", { exact: true }).check();
  await maria.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(maria.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
  await page.getByLabel("Job", { exact: true }).selectOption("job-two");
  await expect(page.getByRole("heading", { name: "Garden planting", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Juan Santos/ })).toBeVisible();
  await expect(maria).toHaveCount(0);
  await page.getByLabel("Job", { exact: true }).selectOption("job-empty");
  await expect(page.getByRole("heading", { name: "Delivery assistance", exact: true })).toBeVisible();
  await expect(page.getByText("No applications matched the current filters.")).toBeVisible();
  await expect.poll(() => state.applicationQueries.at(-1)?.searchParams.get("jobId")).toBe("job-empty");
});

test("Actions progresses from status and offer through applicant response, hire confirmation, and authorization", async ({ page }) => {
  const state = await mockApplications(page);
  await page.goto("/employer/applications");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "Applicant Actions" });
  await actions.getByLabel("Change Status", { exact: true }).selectOption("Shortlisted");
  await expect(page.getByRole("row", { name: /Maria Santos/ })).toContainText("Shortlisted");
  await expect(actions.getByLabel("Change Status").locator('option[value="Hired"]')).toHaveCount(0);
  await actions.getByRole("textbox", { name: "Offer amount" }).fill("499");
  await expect(actions.getByRole("button", { name: "Send a formal offer", exact: true })).toBeDisabled();
  await actions.getByRole("textbox", { name: "Offer amount" }).fill("550");
  await actions.getByRole("button", { name: "Send a formal offer", exact: true }).click();
  expect(state.mutations.filter((call) => call.path.endsWith("/offers"))).toHaveLength(0);
  await page.getByRole("dialog", { name: "Send Formal Offer", exact: true }).getByRole("button", { name: "Send Offer", exact: true }).click();
  await expect(actions.getByRole("status")).toHaveText("Applicant is reviewing your offer");
  await expect(actions.getByRole("button", { name: "Hire", exact: true })).toHaveCount(0);
  state.respond();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(actions.getByText("Do you wish to hire this applicant?", { exact: true })).toBeVisible();
  await expect(actions.getByRole("note")).toHaveText("Hiring an applicant will put the job in progress and you won't be able to delete it");
  await expect(actions.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
  await actions.getByRole("button", { name: "Hire", exact: true }).click();
  expect(state.mutations.filter((call) => call.path.endsWith("/confirm-hire"))).toHaveLength(0);
  await page.getByRole("dialog", { name: "Confirm Hire", exact: true }).getByRole("button", { name: "Confirm Hire", exact: true }).click();
  await expect(actions.getByRole("button", { name: "Authorize Payment", exact: true })).toBeVisible();
  await expect(actions.locator('[aria-current="step"]')).toHaveText("4. Payment");
  await expect(actions.getByRole("button", { name: "Approve & Pay", exact: true })).toHaveCount(0);
  await actions.getByRole("button", { name: "Authorize Payment", exact: true }).click();
  await expect(actions.getByText("Payment is authorized. Funds remain secured until you approve the submitted work.")).toBeVisible();
  expect(state.mutations.filter((call) => call.path.endsWith("/payment/authorize"))).toHaveLength(1);
});

test("Reject cancels accepted offer before rejecting the application", async ({ page }) => {
  const state = await mockApplications(page, { accepted: true });
  await page.goto("/employer/applications");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("dialog", { name: "Applicant Actions" }).getByRole("button", { name: "Reject", exact: true }).click();
  expect(state.mutations).toHaveLength(0);
  await page.getByRole("dialog", { name: "Reject applicant", exact: true }).getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByRole("row", { name: /Maria Santos/ })).toContainText("Rejected");
  expect(state.mutations.map((call) => call.path)).toEqual(["/api/job-offers/offer-0/cancel", "/api/applications/app-0/status"]);
  expect(state.mutations[1].body).toEqual({ status: "Rejected" });
  await expect(page.getByRole("dialog", { name: "Applicant Actions" }).getByRole("button", { name: "Hire", exact: true })).toHaveCount(0);
});

test("declined offers return to status and offer controls without allowing a hire", async ({ page }) => {
  const state = await mockApplications(page);
  await page.goto("/employer/applications");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "Applicant Actions" });
  await actions.getByRole("textbox", { name: "Offer amount" }).fill("500");
  await actions.getByRole("button", { name: "Send a formal offer", exact: true }).click();
  await page.getByRole("dialog", { name: "Send Formal Offer", exact: true }).getByRole("button", { name: "Send Offer", exact: true }).click();
  await expect(actions.getByText("Applicant is reviewing your offer")).toBeVisible();
  state.respond(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(actions.getByText("The applicant declined your offer. You may change the status or send a new offer.")).toBeVisible();
  await expect(actions.getByLabel("Change Status", { exact: true })).toHaveValue("Shortlisted");
  await expect(actions.getByRole("button", { name: "Hire", exact: true })).toHaveCount(0);
});

test("table and Actions dialog fit desktop and phone viewports", async ({ page }) => {
  await mockApplications(page, { accepted: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/employer/applications");
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({ path: "docs/assets/11-employer-applications.png", fullPage: true });
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "Applicant Actions" });
  await expect(actions.getByRole("button", { name: "Hire", exact: true })).toBeVisible();
  await page.screenshot({ path: ".agent/employer-applicant-actions-desktop.png" });
  await page.setViewportSize({ width: 375, height: 667 });
  const bounds = await actions.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(667);
  await expect(actions.getByRole("button", { name: "Hire", exact: true })).toBeVisible();
  await page.screenshot({ path: ".agent/employer-applicant-actions-phone.png" });
  await actions.getByRole("button", { name: /close/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const table = page.getByRole("table");
  expect(await table.evaluate((element) => element.parentElement!.scrollWidth > element.parentElement!.clientWidth)).toBe(true);
});
