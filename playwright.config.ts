import { defineConfig, devices } from "@playwright/test";

const e2eClientPort = Number(process.env.E2E_CLIENT_PORT || 8082);
const e2eApiPort = Number(process.env.E2E_API_PORT || 5055);

const RESPONSIVE_SPEC = /responsive-audit\.spec\.ts/;
const AUTH_SETUP = /auth\.setup\.ts/;
const WORKER_STATE = "tests/e2e/.auth/worker.json";

/**
 * The device matrix the responsive audit runs against. Each entry exists to
 * exercise something specific rather than to pad the list:
 *
 *  - fold      280px, narrower than Tailwind's `sm`, so base styles only
 *  - phone-se  375px, the most common small phone
 *  - phone-lg  430px, the large-phone end
 *  - phone-landscape  a 375px-tall viewport, which is what pushed the date
 *              picker's close button off the top of the screen
 *  - tablet    768px, the `md` boundary
 *  - tablet-lg 1024px, the `lg` boundary where the sidebar appears
 *  - desktop   regression guard
 *
 * All of them run on Chromium with device emulation rather than on each
 * engine's own browser: CI installs Chromium only (`.github/workflows/ci.yml`
 * runs `playwright install --with-deps chromium`), and emulation still gives
 * the viewport, device pixel ratio and touch behaviour these geometric
 * assertions depend on. The gap this leaves is engine-specific rendering --
 * notably Safari's dynamic toolbar, which is what `dvh` exists for -- so the
 * `dvh` fixes are verified by code review rather than by this matrix.
 */
const mobile = (width: number, height: number) => ({
  browserName: "chromium" as const,
  viewport: { width, height },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

const RESPONSIVE_PROFILES = [
  { name: "fold", use: mobile(280, 653) },
  { name: "phone-se", use: mobile(375, 667) },
  { name: "phone-lg", use: mobile(430, 932) },
  { name: "phone-landscape", use: mobile(667, 375) },
  { name: "tablet", use: mobile(768, 1024) },
  { name: "tablet-lg", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 1366 } } },
  { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${e2eClientPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    // The pre-existing suite keeps its single desktop-ish run -- those specs
    // drive their own viewports where they care about width, so fanning them
    // across the matrix would multiply runtime without adding coverage.
    {
      name: "app",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [RESPONSIVE_SPEC, AUTH_SETUP],
    },
    // Signs the seeded worker in once; every responsive project reuses that
    // session instead of signing in again. Seven more logins on top of what the
    // rest of the suite already does was enough for the shared account to start
    // refusing them mid-run.
    {
      name: "setup",
      use: { ...devices["Desktop Chrome"] },
      testMatch: AUTH_SETUP,
    },
    ...RESPONSIVE_PROFILES.map((profile) => ({
      name: `responsive:${profile.name}`,
      use: { ...profile.use, storageState: WORKER_STATE },
      testMatch: RESPONSIVE_SPEC,
      dependencies: ["setup"],
    })),
  ],
  webServer: [
    {
      command: `node scripts/start-e2e-server.cjs ${e2eApiPort} ${e2eClientPort}`,
      port: e2eApiPort,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node scripts/start-e2e-client.cjs ${e2eClientPort} ${e2eApiPort}`,
      port: e2eClientPort,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
