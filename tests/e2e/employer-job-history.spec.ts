import { expect, test, type Page } from "@playwright/test";

const employer = { id: "507f1f77bcf86cd799439011", email: "history@example.com", firstName: "Test", lastName: "Employer", role: "hire", systemRole: "hire", accountType: "employer", accountOptions: ["employer"], isVerified: true };
const job = { _id: "history-job", title: "Park cleanup", description: "Clean the park grounds", location: "Pasig", salary: 500, status: "Completed", positionsNeeded: 1, hiredCount: 1, amountHeld: 0, amountPaid: 600, canDelete: false };
const application = { _id: "history-app", status: "Hired", job, applicant: { _id: "worker-one", firstName: "Maria", lastName: "Santos", email: "maria@example.com" }, coverLetter: "I have cleanup experience.", agreedAmount: 600, workStatus: "Completed", paymentStatus: "Paid", employerHidden: true };

async function mockEmployer(page: Page, mode: "history" | "hire" = "history", historyJobs = [job]) {
  let reviewed = false;
  let hireCalls = 0;
  const applicationQueries: URL[] = [];
  await page.addInitScript((user) => {
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("current_user", JSON.stringify(user));
  }, employer);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname.endsWith("/auth/me")) body = { data: employer };
    if (url.pathname.endsWith("/jobs/history")) body = historyJobs;
    if (url.pathname.endsWith("/jobs/mine")) body = [job, { ...job, _id: "ongoing-job", title: "Ongoing cleanup", status: "In Progress" }];
    if (url.pathname.endsWith("/applications/employer")) {
      applicationQueries.push(url);
      body = mode === "history" ? [application] : [{ ...application, status: "Offer Sent", employerHidden: false, offer: { id: "offer-one", status: "accepted", amount: 600 } }];
    }
    if (url.pathname.endsWith("/reviews/eligible")) body = { asWorker: [], asEmployer: [{ applicationId: application._id, job, canReview: !reviewed, existingReview: reviewed ? { rating: 5 } : null }] };
    if (url.pathname.endsWith("/reviews") && route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toMatchObject({ applicationId: application._id, rating: 5 });
      reviewed = true; body = { review: { rating: 5 } };
    }
    if (url.pathname.endsWith("/confirm-hire")) { hireCalls += 1; body = { application }; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { applicationQueries, hireCalls: () => hireCalls, setHistory: (items: typeof historyJobs) => { historyJobs = items; } };
}

test("job history paginates ten rows, refreshes to page one, and handles a smaller history", async ({ page }) => {
  const jobs = Array.from({ length: 23 }, (_, index) => ({ ...job, _id: `job-${index}`, title: `Cleanup ${index + 1}` }));
  const state = await mockEmployer(page, "history", jobs);
  await page.goto("/employer/job-history");
  const rows = page.getByRole("table").locator("tbody tr");
  const pagination = page.getByRole("navigation", { name: "Job history pages" });
  await expect(rows).toHaveCount(10);
  await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 23");
  await expect(pagination.getByRole("button", { name: "Prev", exact: true })).toBeDisabled();
  await pagination.getByRole("button", { name: "Next", exact: true }).click();
  await expect(rows.first()).toContainText("Cleanup 11");
  await expect(page.getByRole("status")).toHaveText("Showing 11–20 of 23");
  await pagination.getByRole("button", { name: "Go to page 3", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole("status")).toHaveText("Showing 21–23 of 23");
  await expect(pagination.getByRole("button", { name: "Go to page 3" })).toHaveAttribute("aria-current", "page");
  await expect(pagination.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await pagination.getByRole("button", { name: "Prev", exact: true }).click();
  await expect(rows.first()).toContainText("Cleanup 11");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 23");
  await pagination.getByRole("button", { name: "Go to page 3", exact: true }).click();
  state.setHistory(jobs.slice(0, 5));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("Cleanup 1");
  await expect(pagination).toHaveCount(0);
});

test("paginated job history fits phone, tablet, and desktop widths", async ({ page }) => {
  await mockEmployer(page, "history", Array.from({ length: 47 }, (_, index) => ({ ...job, _id: `job-${index}` })));
  await page.goto("/employer/job-history");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const pagination = page.getByRole("navigation", { name: "Job history pages" });
    await expect(pagination).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await pagination.getByRole("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("job history shows money, scoped application details, and saves a worker rating", async ({ page }) => {
  const state = await mockEmployer(page);
  await page.goto("/employer/job-history");
  await expect(page.getByRole("heading", { name: "Job History", exact: true })).toBeVisible();
  const row = page.getByRole("row", { name: /Park cleanup/ });
  await expect(row).toContainText("Completed");
  await expect(row).toContainText("600.00");
  await row.getByRole("button", { name: "View details for Park cleanup" }).click();
  const details = page.getByRole("dialog", { name: "Park cleanup" });
  await expect(details).toContainText("Clean the park grounds");
  await expect(details).toContainText("Maria Santos");
  await expect(details).toContainText("I have cleanup experience.");
  const compactPayment = details.locator("p").filter({ hasText: /^Hired$/ }).locator("..");
  await expect(compactPayment).toHaveClass("rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2");
  await expect(compactPayment.getByRole("heading")).toHaveCount(0);
  expect(state.applicationQueries.at(-1)?.searchParams.get("jobId")).toBe(job._id);
  expect(state.applicationQueries.at(-1)?.searchParams.get("includeHidden")).toBe("true");
  await details.getByRole("button", { name: "Rate Worker", exact: false }).click();
  const rating = page.getByRole("dialog", { name: "Rate worker", exact: true });
  await rating.getByRole("button", { name: "5 stars", exact: true }).click();
  await rating.getByRole("button", { name: "Submit rating" }).click();
  await expect(rating).toBeHidden();
  await expect(details.getByText("Review submitted", { exact: true })).toBeVisible();
});

test("confirm hire highlights the deletion warning and waits for confirmation", async ({ page }) => {
  const state = await mockEmployer(page, "hire");
  await page.goto("/employer/applications");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("dialog", { name: "Applicant Actions" }).getByRole("button", { name: "Hire", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm Hire" });
  const warning = confirmation.getByRole("note");
  await expect(warning).toHaveText("Cannot delete the job after confirming the hire.");
  await expect(warning).toHaveCSS("font-weight", "700");
  expect(state.hireCalls()).toBe(0);
  await confirmation.getByRole("button", { name: "Confirm Hire", exact: true }).click();
  await expect.poll(state.hireCalls).toBe(1);
});

test("job management hides completed jobs, keeps active hire deletion locked, and retains completed history", async ({ page }) => {
  await mockEmployer(page);
  await page.goto("/employer/jobs");
  await expect(page.getByText("Ongoing cleanup", { exact: true })).toBeVisible();
  await expect(page.getByText("Park cleanup", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await page.goto("/employer/job-history");
  await expect(page.getByRole("row", { name: /Park cleanup/ })).toContainText("Completed");
});
