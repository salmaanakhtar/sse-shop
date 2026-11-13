import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /.*\.setup\.ts/,
    },
  ],
  webServer: {
    // Tests run against a production build, not the dev server, so what CI
    // verifies is what ships.
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        // Better Auth validates the request origin against its own base URL;
        // on the test port that is not the one in .env.local.
        BETTER_AUTH_URL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
        NEXT_PUBLIC_STORE_URL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
        // The suite intentionally signs in several customers; production keeps
        // the default rate limit on.
        BETTER_AUTH_RATE_LIMIT: "false",
      }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
  },
});
