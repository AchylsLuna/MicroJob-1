import { expect, test, type Page } from "@playwright/test";

const jobs = [
  { _id: "dagupan-job", title: "Dagupan delivery", location: "Pantal, City of Dagupan, Pangasinan" },
  { _id: "cebu-job", title: "Cebu delivery", location: "Lahug, Cebu City, Cebu" },
].map((job) => ({ ...job, salary: 500, jobType: "Short-term", createdAt: new Date().toISOString() }));

async function mockSearch(page: Page, signedIn: boolean, city = "City of Dagupan") {
  const user = {
    id: "507f1f77bcf86cd799439012", email: "location-worker@example.ph",
    firstName: "Search", lastName: "Worker", role: "work", systemRole: "work",
    accountType: "worker", accountOptions: ["worker"], isVerified: true, city,
  };
  if (signedIn) {
    await page.addInitScript((value) => {
      localStorage.setItem("auth_user", JSON.stringify(value));
      localStorage.setItem("current_user", JSON.stringify(value));
    }, user);
  }
  await page.route("https://psgc.gitlab.io/api/**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(route.request().url().includes("provinces")
      ? [{ code: "cebu", name: "Cebu" }]
      : [{ code: "cebu-city", name: "Cebu City" }, { code: "dagupan", name: "City of Dagupan" }]),
  }));
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "psgc.gitlab.io") return route.fallback();
    let body: unknown = [];
    if (url.pathname.endsWith("/auth/me")) body = { data: user };
    if (url.pathname === "/api/jobs") {
      const location = url.searchParams.get("location");
      body = jobs.filter((job) => !location || location === "nationwide"
        || job.location.toLowerCase().includes(location.toLowerCase()));
    }
    if (url.pathname.startsWith("/api/jobs/") && !url.pathname.endsWith("recommended")) {
      body = jobs.find((job) => url.pathname.endsWith(job._id)) ?? {};
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
}

for (const width of [375, 1440]) {
  test(`workers can change their search city and browse nationwide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSearch(page, true);
    await page.goto("/worker/find-jobs");
    const location = page.getByRole("combobox", { name: "Job search location" });
    await expect(location).toHaveValue("City of Dagupan");
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();

    await location.fill("Cebu City");
    await expect(page).toHaveURL(/location=Cebu\+City/);
    await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
    await page.reload();
    await expect(location).toHaveValue("Cebu City");

    await page.getByRole("button", { name: "Search nationwide", exact: true }).click();
    await expect(location).toHaveValue("");
    await expect(location).toHaveAttribute("placeholder", "Nationwide");
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("visitors can search a province and clear it without a profile", async ({ page }) => {
  await mockSearch(page, false);
  await page.goto("/jobs");
  const location = page.getByRole("combobox", { name: "Job search location" });
  await location.fill("Cebu");
  await expect(page.locator("#job-search-locations option[value='Cebu City']")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
  await location.fill("");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
});

test("workers without a profile city can immediately browse nationwide", async ({ page }) => {
  await mockSearch(page, true, "");
  await page.goto("/worker/find-jobs");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
});
