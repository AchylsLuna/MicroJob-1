import { expect, test, type Page } from "@playwright/test";

const employer = { id: "507f1f77bcf86cd799439011", email: "history@example.com", firstName: "Test", lastName: "Employer", role: "hire", systemRole: "hire", accountType: "employer", accountOptions: ["employer"], isVerified: true };
const job = { _id: "history-job", title: "Park cleanup", description: "Clean the park grounds", location: "Pasig", salary: 500, status: "Completed", positionsNeeded: 1, hiredCount: 1, amountHeld: 0, amountPaid: 600, canDelete: false };
const application = { _id: "history-app", status: "Hired", job, applicant: { _id: "worker-one", firstName: "Maria", lastName: "Santos", email: "maria@example.com" }, coverLetter: "I have cleanup experience.", agreedAmount: 600, workStatus: "Completed", paymentStatus: "Paid", employerHidden: true };

async function mockEmployer(page: Page, mode: "history" | "hire" = "history") {
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
    if (url.pathname.endsWith("/jobs/history")) body = [job];
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
  return { applicationQueries, hireCalls: () => hireCalls };
}

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
