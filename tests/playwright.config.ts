import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// Playwright resolves paths from this file's folder; the app and its build live one level up.
const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  outputDir: `${root}/test-results`,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `rm -rf .pglite-e2e && PGLITE_DIR=.pglite-e2e APP_SECRET=e2e-secret-e2e-secret-e2e-secret-e2e npm run start -- -p ${port}`,
        cwd: root,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
