import { defineConfig } from "@playwright/test";

const e2eClientPort = Number(process.env.E2E_CLIENT_PORT || 5173);
const e2eApiPort = Number(process.env.E2E_API_PORT || 5055);

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
