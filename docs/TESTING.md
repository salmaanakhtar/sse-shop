# Testing

The rule from `AGENTS.md`: a feature ships with a unit test for each rule and a Playwright journey
for each user path. This file says where a test belongs, how to write one that does not flake, and
what blocks a merge.

## Layers

| Layer | Tool | Location | Speed | What belongs here |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `tests/unit` | ms | Money math, VAT extraction, shipping rule, cart totals, stock rules, slugs, Zod schemas, formatting |
| Integration | Vitest | `tests/integration` | ~10s | Services against a real Postgres: cart persistence, checkout transaction, inventory locking, audit writes |
| Component | Vitest + Testing Library | `tests/unit` | ms | One interaction that is hard to reach in a browser: a quantity stepper, an address form |
| End-to-end | Playwright | `tests/e2e` | ~1min | A shopper path and an admin path, driven through the UI against a real build |

Prefer the lowest layer that can fail for the reason you care about. A validation branch is a unit
test; "can a customer buy something" is an end-to-end test. Do not e2e every error message.

Vitest runs on Vite. Next.js stays the bundler for the app itself — Test and Playwright never
replace `next build`. This is a deliberate split: Vite gives fast test feedback, Next gives the
runtime we actually ship.

## End-to-end journeys

These are the paths that must exist and stay green. Add a spec per feature; never delete one
without replacing it.

1. **Browse and buy** — home → product → variant selected → add to cart → cart shows correct total
   → checkout with a UAE address → mock payment → confirmation page with an order number.
2. **Cart survives a reload** — add, reload, cart still there.
3. **Stock limit** — adding more than stock is refused with a readable message.
4. **Admin creates and publishes a product** — sign in with 2FA, create product and variant, upload
   an image, publish, product appears on the storefront.
5. **Admin edits a product** — price change appears on the storefront without a deploy.
6. **Guest order lookup** — the confirmation link works, an expired link does not.

## Vitest setup

Two projects in one config so `pnpm test` runs both and CI can filter them.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.tsx"],
          setupFiles: ["tests/setup/dom.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/db.ts"],
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
```

Integration tests use a real Postgres, not a mock. A mocked database proves the mock works. The
`schema` module enforces serial execution because every test truncates and reseeds.

```ts
// tests/setup/db.ts
import { beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { migrate } from "drizzle-orm/postgres-js/migrator";

beforeAll(async () => {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error("DATABASE_URL_TEST must point at a disposable database");
  }
  await migrate(db, { migrationsFolder: "./drizzle" });
  for (const table of ["order_items", "orders", "cart_items", "carts", "variants", "products"]) {
    await db.execute(sql.raw(`truncate ${table} restart identity cascade`));
  }
});
```

Rules that keep unit tests honest:

- Time comes from an injected clock or `vi.setSystemTime`. No `new Date()` in tested code.
- Randomness is seeded. A test that fails one run in fifty is a bug in the test.
- No network. The mailer and payment provider are interfaces with in-memory test doubles.
- Assert on money as integers: `expect(total).toBe(24000)`, not on a formatted string.

## Playwright setup

One disposable database per run, seeded deterministically. Specs own every row they mutate; seeded
catalog data is read-only.

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "pnpm build && pnpm exec next start -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

`globalSetup` resets the database, applies migrations, and loads `pnpm db:seed`. The seed creates a
known catalog with predictable prices, one admin user whose password and TOTP secret come from
env vars, and a low-stock variant used by the stock-limit spec.

Admin authentication is captured once into `tests/e2e/.auth/admin.json` via `storageState`, with a
setup project that runs first. Do not sign in through the UI in every spec; that tests the form six
times and makes flakes stack up.

Locator rules:

- `getByRole`, `getByLabel`, `getByText` first. `data-testid` only where no accessible name exists.
- Assert on user-visible outcomes, not on CSS classes or internal state.
- Wait for the app, not the clock: `expect(locator).toBeVisible()`, never `waitForTimeout`.
- A test may not depend on another test. Each spec sets up its own preconditions.

## CI gates

Every pull request runs, in this order, and all must pass:

| Gate | Command | Budget |
| --- | --- | --- |
| Lint | `pnpm lint` | 1 min |
| Types | `pnpm typecheck` | 2 min |
| Unit + components + integration | `pnpm test` | 5 min |
| Build | `pnpm build` | 4 min |
| End-to-end | `pnpm test:e2e` | 10 min |
| Dependency review | GitHub action, fails on high or critical | 1 min |
| Dependency audit | `pnpm audit --audit-level=high` | 1 min |
| Repo scan | Trivy: vulnerabilities, secrets, misconfiguration | 2 min |

The end-to-end job runs against a Postgres service container and uploads the Playwright HTML report
and traces on failure. A trace is the fastest way to explain a red build, so it is uploaded before
any cleanup step runs.

## The CVE gate

Three independent mechanisms, because each catches a different failure:

1. **Dependency review** on pull requests blocks a change that *introduces* a vulnerable package.
2. **`pnpm audit`** on every push catches advisories published against packages already installed.
   New CVEs appear without any code change, which is why the workflow is also scheduled weekly.
3. **Trivy** scans the repository and the built image for vulnerable OS packages, leaked secrets,
   and Dockerfile misconfiguration. The image is scanned because the base OS is part of the
   deployed attack surface, not just npm.

Policy:

- High and critical fail the build. Moderate is reported and triaged, not ignored.
- `ignore-unfixed: true` for OS packages, since a known-unfixable CVE should not block every
  deploy. It is still visible in the report.
- An exception goes in `.trivyignore` or `docs/security-exceptions.md` with a CVE id, a reason, an
  owner, and an expiry date. The gate keeps running; the exception expires.
- Dependabot opens grouped weekly PRs for npm, GitHub Actions, and the Docker base image. Security
  advisories open immediately.
- GitHub Actions are pinned to a major version now and to a commit SHA once the workflows settle.
  A moving tag on an action is supply-chain risk in the same way a dependency is.

## Flake policy

A flaky test is a defect in the test suite, and it erodes trust in every other signal.

- Quarantine with `test.fixme(true, "<issue link>")` — never a silent `test.skip`.
- Fix or delete within a week. A quarantined test with no owner is a deleted test, just slower.
- Retries exist to absorb infrastructure noise in CI, not to hide a race. If a spec needs its
  retries to pass, it is red.
