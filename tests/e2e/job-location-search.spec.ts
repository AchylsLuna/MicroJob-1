import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const jobs = [
  { _id: "dagupan-job", title: "Dagupan delivery", location: "Pantal, City of Dagupan, Pangasinan" },
  { _id: "cebu-job", title: "Cebu delivery", location: "Lahug, Cebu City, Cebu" },
].map((job) => ({ ...job, salary: 500, applicantCount: 2, category: { _id: "delivery-category", name: "Delivery services" }, jobType: "Short-term", createdAt: new Date().toISOString() }));

async function mockSearch(page: Page, signedIn: boolean, city = "City of Dagupan", matchPercentage?: number) {
  const jobRequests: URL[] = [];
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
    if (url.pathname === "/api/categories") body = [{ _id: "delivery-category", name: "Delivery services" }];
    if (url.pathname === "/api/jobs/recommended" && matchPercentage !== undefined) {
      body = [{ ...jobs[0], match: { percentage: matchPercentage, level: matchPercentage ? "Strong match" : "Potential match" } }];
    }
    if (url.pathname === "/api/jobs") {
      jobRequests.push(url);
      const search = url.searchParams.get("search") || "";
      const location = url.searchParams.get("location");
      body = jobs.filter((job) => (!location || location === "nationwide"
        || job.location.toLowerCase().includes(location.toLowerCase()))
        && job.title.toLowerCase().includes(search.toLowerCase()));
    }
    if (url.pathname.startsWith("/api/jobs/") && !url.pathname.endsWith("recommended")) {
      body = jobs.find((job) => url.pathname.endsWith(job._id)) ?? {};
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  return jobRequests;
}

for (const width of [280, 375, 768, 1440]) {
  test(`workers can change their search city and browse nationwide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSearch(page, true);
    await page.goto("/worker/find-jobs");
    const location = page.getByRole("combobox", { name: "Job search location" });
    await expect(location).toHaveValue("");
    await expect(location).toHaveAttribute("placeholder", "Location");
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();

    await location.fill("Cebu City");
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/location=Cebu\+City/);
    await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
    await page.reload();
    await expect(location).toHaveValue("Cebu City");

    await page.getByRole("button", { name: "Clear location for nationwide search", exact: true }).click();
    await expect(location).toHaveValue("");
    await expect(location).toHaveAttribute("placeholder", "Location");
    await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
    await page.getByRole("button", { name: "Search", exact: true }).click();
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
  await location.press("Enter");
  await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
  await location.fill("");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
  await location.press("Enter");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
});

test("workers without a profile city can immediately browse nationwide", async ({ page }) => {
  await mockSearch(page, true, "");
  await page.goto("/worker/find-jobs");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
});

test("Search applies keyword and location together while preserving filters", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const requests = await mockSearch(page, true);
  await page.goto("/worker/find-jobs?minPay=200&category=delivery-category&jobId=dagupan-job");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
  const initialRequests = requests.length;
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("  Cebu  ");
  await page.getByRole("combobox", { name: "Job search location" }).fill("  Cebu City  ");
  expect(requests.length).toBe(initialRequests);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("button", { name: /^View Cebu delivery/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeHidden();
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toEqual({ minPay: "200", category: "delivery-category", q: "Cebu", location: "Cebu City" });
  expect(requests.at(-1)?.searchParams.get("search")).toBe("cebu");
  expect(requests.at(-1)?.searchParams.get("location")).toBe("Cebu City");
});

test("filter changes preserve search drafts and Back/Forward restore applied searches", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mockSearch(page, false);
  await page.goto("/jobs");
  const keyword = page.getByRole("searchbox", { name: "Search jobs" });
  const location = page.getByRole("combobox", { name: "Job search location" });
  await keyword.fill("Cebu");
  await location.fill("Cebu City");
  await page.getByRole("button", { name: "Few applicants (<10)", exact: true }).click();
  await expect(keyword).toHaveValue("Cebu");
  await expect(location).toHaveValue("Cebu City");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await keyword.fill("Dagupan");
  await location.fill("City of Dagupan");
  await keyword.press("Enter");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
  await page.goBack();
  await expect(keyword).toHaveValue("Cebu");
  await expect(location).toHaveValue("Cebu City");
  await page.goForward();
  await expect(keyword).toHaveValue("Dagupan");
  await expect(location).toHaveValue("City of Dagupan");
  await page.reload();
  await expect(keyword).toHaveValue("Dagupan");
  await expect(location).toHaveValue("City of Dagupan");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("fewApplicants")).toBe(false);
  await expect(keyword).toHaveValue("Dagupan");
  await expect(location).toHaveValue("City of Dagupan");
});

for (const width of [280, 768, 1440]) {
  test(`search controls and filter menus fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockSearch(page, true);
    await page.goto("/worker/find-jobs");
    const band = page.locator('section[aria-labelledby="job-search-heading"]');
    const keyword = page.getByRole("searchbox", { name: "Search jobs" });
    const location = page.getByRole("combobox", { name: "Job search location" });
    const submit = band.getByRole("button", { name: "Search", exact: true });
    const saved = band.getByRole("button", { name: "Saved jobs", exact: true });
    const boxes = await Promise.all([keyword, location, submit, saved].map((control) => control.boundingBox()));
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    if (width >= 1280) expect(new Set(boxes.map((box) => box!.y)).size).toBe(1);
    else if (width >= 768) expect(boxes[0]!.y).toBe(boxes[1]!.y);
    else expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);

    await band.getByRole("button", { name: "Category", exact: true }).click();
    const menu = page.getByRole("menu", { name: "Category", exact: true });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    const bandBox = await band.boundingBox();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
    expect(menuBox!.y + menuBox!.height).toBeGreaterThan(bandBox!.y + bandBox!.height);
    await menu.getByRole("menuitemradio", { name: "Delivery services" }).click();
    await menu.getByRole("button", { name: "Show results" }).click();
    await expect(band.getByText("1 filter", { exact: true })).toBeVisible();
    await band.getByRole("button", { name: "Category", exact: true }).click();
    await menu.getByRole("button", { name: "Reset", exact: true }).click();
    await menu.getByRole("button", { name: "Show results" }).click();
    expect(new URL(page.url()).searchParams.has("category")).toBe(false);
    await band.getByRole("button", { name: "Listing time", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(band.getByRole("button", { name: "Listing time", exact: true })).toBeFocused();
    await band.getByRole("button", { name: "Matching preferences", exact: true }).click();
    await expect(page.getByRole("menu", { name: "Matching preferences" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("region", { name: "Make the most of MicroJobs" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include('section[aria-labelledby="job-search-heading"]').analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

test("Saved jobs opens the worker page and sends visitors through sign-in with a return route", async ({ page, browser, baseURL }) => {
  await mockSearch(page, true);
  await page.goto("/worker/find-jobs");
  await page.getByRole("search").getByRole("button", { name: "Saved jobs", exact: true }).click();
  await expect(page).toHaveURL(/\/worker\/saved-jobs$/);
  const visitor = await browser.newPage({ baseURL });
  try {
    await mockSearch(visitor, false);
    await visitor.goto("/jobs");
    await visitor.getByRole("search").getByRole("button", { name: "Saved jobs", exact: true }).click();
    await expect(visitor).toHaveURL(/\/sign-in$/);
    expect(await visitor.evaluate(() => history.state.usr.from)).toBe("/worker/saved-jobs");
  } finally {
    await visitor.close();
  }
});

for (const percentage of [0, 65]) {
  test(`recommendations preserve the ${percentage === 0 ? "empty-profile prompt" : "match cards"}`, async ({ page }) => {
    await mockSearch(page, true, "City of Dagupan", percentage);
    await page.goto("/worker/find-jobs");
    const recommendations = page.locator('section[aria-labelledby="recommended-heading"]');
    await expect(recommendations).toBeVisible();
    if (percentage === 0) await expect(recommendations.getByRole("button", { name: "Complete your profile" })).toBeVisible();
    else await expect(recommendations.getByText("65% match")).toBeVisible();
    await expect(page.getByRole("region", { name: "Make the most of MicroJobs" })).toHaveCount(0);
  });
}

test("Filipino search labels fit on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 1000 });
  await mockSearch(page, false);
  await page.goto("/jobs");
  await expect(page.getByRole("button", { name: /^View Dagupan delivery/ })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = "/src/i18n/index.ts";
    const { default: i18n } = await import(modulePath);
    await i18n.changeLanguage("tl");
  });
  const band = page.locator('section[aria-labelledby="job-search-heading"]');
  await expect(band.getByRole("button", { name: "Hanapin", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Lokasyon para sa paghahanap ng trabaho" })).toHaveAttribute("placeholder", "Lokasyon");
  const sortBox = await page.getByRole("combobox", { name: "Ayusin ang mga trabaho" }).boundingBox();
  expect(sortBox!.x + sortBox!.width).toBeLessThanOrEqual(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('section[aria-labelledby="job-search-heading"]').analyze();
  expect(accessibility.violations).toEqual([]);
});

for (const width of [1024, 1440]) {
  test(`Find Jobs hides the navbar and the sidebar slides fully out and back at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSearch(page, true);
    await page.goto("/worker/find-jobs");
    await expect(page.locator("header")).toHaveCount(0);
    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await expect(sidebar).toBeVisible();
    const panel = page.locator("#desktop-dashboard-navigation");
    expect((await panel.boundingBox())!.width).toBe(304);
    const band = page.locator('section[aria-labelledby="job-search-heading"]');
    expect((await band.boundingBox())!.y).toBeLessThan(40);

    await sidebar.getByRole("button", { name: "Hide sidebar", exact: true }).click();
    await expect(sidebar).toBeHidden();
    await expect.poll(async () => panel.evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
    await expect(panel).toHaveAttribute("inert", "");
    const reopen = page.getByRole("button", { name: "Open navigation menu", exact: true });
    await expect(reopen).toBeFocused();
    expect((await page.locator("main").boundingBox())!.x).toBe(0);
    await page.reload();
    await expect(reopen).toBeVisible();
    await expect(sidebar).toBeHidden();
    await reopen.focus();
    await page.keyboard.press("Enter");
    await expect(sidebar).toBeVisible();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBe(304);
    await expect(sidebar.getByRole("button", { name: "Hide sidebar", exact: true })).toBeFocused();
    expect(new URL(page.url()).pathname).toBe("/worker/find-jobs");

    await sidebar.getByRole("button", { name: "Saved Jobs", exact: true }).click();
    await expect(page.locator("header")).toBeVisible();
    await sidebar.getByRole("button", { name: "Hide sidebar", exact: true }).click();
    const headerMenu = page.locator("header").getByRole("button", { name: "Open navigation menu", exact: true });
    await expect(headerMenu).toBeFocused();
    await headerMenu.click();
    await expect(sidebar).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Find Jobs keeps the mobile drawer accessible without the top navbar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mockSearch(page, true);
  await page.goto("/worker/find-jobs");
  await expect(page.locator("header")).toHaveCount(0);
  const opener = page.getByRole("button", { name: "Open navigation menu", exact: true });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Navigation menu", exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Close navigation menu", exact: true }).last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await drawer.getByRole("button", { name: "Saved Jobs", exact: true }).click();
  await expect(page).toHaveURL(/\/worker\/saved-jobs$/);
  await expect(drawer).toBeHidden();
  await expect(page.locator("header")).toBeVisible();
});

for (const width of [280, 768, 1440]) {
  test(`landing page benefits fit at ${width}px and support Filipino labels`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockSearch(page, false);
    await page.goto("/");
    const benefits = page.getByRole("region", { name: "Make the most of MicroJobs" });
    await benefits.scrollIntoViewIfNeeded();
    await expect(benefits.getByRole("heading")).toHaveText([
      "Build your profile", "Get personal job matches", "Build trust with verification",
    ]);
    const cards = benefits.getByRole("article");
    const boxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()));
    for (const box of boxes) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    if (width >= 768) expect(new Set(boxes.map((box) => box!.y)).size).toBe(1);
    else expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
    const jobsBox = await page.locator("#jobs").boundingBox();
    expect((await benefits.boundingBox())!.y).toBeGreaterThanOrEqual(jobsBox!.y + jobsBox!.height);
    const accessibility = await new AxeBuilder({ page }).include('section[aria-label="Make the most of MicroJobs"]').analyze();
    expect(accessibility.violations).toEqual([]);
    await page.evaluate(async () => {
      const modulePath = "/src/i18n/index.ts";
      const { default: i18n } = await import(modulePath);
      await i18n.changeLanguage("tl");
    });
    const translated = page.getByRole("region", { name: "Sulitin ang MicroJobs" });
    await expect(translated.getByRole("heading")).toHaveText([
      "Buuin ang iyong profile", "Makakuha ng mga trabahong tugma sa iyo", "Bumuo ng tiwala sa pamamagitan ng beripikasyon",
    ]);
    expect(await translated.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
