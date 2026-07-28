import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: "env MONGO_URI='' MONGODB_URI='' ENABLE_IN_MEMORY_MONGO=true AUTO_SEED_DEMO_USER=true DEMO_USER_EMAIL=e2e-user@microjobs.local DEMO_USER_PASSWORD='ReviewPass123!' DEMO_USER_ROLE=both AUTO_SEED_SUPERADMIN=true SUPERADMIN_EMAIL=e2e-admin@microjobs.local SUPERADMIN_PASSWORD='AdminPass123!' PORT=5055 node server/index.js",
      port: 5055,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "env VITE_API_PROXY_TARGET=http://127.0.0.1:5055 npm run dev:client -- --host 127.0.0.1",
      port: 5173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
