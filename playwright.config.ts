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
      command: `env MONGO_URI='' MONGODB_URI='' ENABLE_IN_MEMORY_MONGO=true AUTO_SEED_DEMO_USER=true DEMO_USER_EMAIL=e2e-user@microjobs.local DEMO_USER_PASSWORD='ReviewPass123!' DEMO_USER_ROLE=both AUTO_SEED_SUPERADMIN=true SUPERADMIN_EMAIL=e2e-admin@microjobs.local SUPERADMIN_PASSWORD='AdminPass123!' PORT=${e2eApiPort} node server/index.js`,
      port: e2eApiPort,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `env VITE_API_PROXY_TARGET=http://127.0.0.1:${e2eApiPort} npm run dev:client -- --host 127.0.0.1 --port ${e2eClientPort}`,
      port: e2eClientPort,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
