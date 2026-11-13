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

1. **Browse and buy** — home → product → choose a parent branch and its child → add to cart → cart
   shows correct total → checkout with a UAE address → mock payment → confirmation page with an
   order number.
2. **Cart survives a reload** — add, reload, cart still there.
3. **Stock limit** — adding more than stock is refused with a readable message.
4. **Admin creates and publishes a product** — sign in, create product, add levels, add a root and
   its children, edit the leaf, upload an image, publish, product appears on the storefront.
5. **Admin edits a product** — price change appears on the storefront without a deploy.
6. **Guest order lookup** — the confirmation link works, an expired link does not.
7. **Customer account** — sign up, save a delivery address, check out with pre-filled details and a
   billing address, then see the order in history.
8. **Cart merge** — an anonymous cart survives sign-in and appears in the account's cart.
9. **Guest order claim** — a guest order, a sign-in from its lookup link, and a claim that moves it
   into order history.
10. **Account deletion** — delete with a password confirmation, then a sign-in attempt fails.
11. **Admin customer list** — the panel lists customers and opens their detail.
12. **Variant tree selection** — selecting a parent updates the children and price; the cart label
    is the chosen path, not a phantom combination.
13. **Sale price** — admin sets a sale with an end time; the storefront shows the discount, original
    price, and timer; the cart total uses the sale price.

## Vitest setup

Two projects in one config so `pnpm test` runs both and CI can filter them.

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Integration tests read DATABASE_URL_TEST from the same file the app uses.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": src } },
  test: {
    projects: [
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@": src } },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.tsx"],
          setupFiles: ["tests/setup/dom.ts"],
        },
      },
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/db.ts"],
          pool: "forks",
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
```

The integration project runs against a real Postgres, not a mock. A mocked database proves the mock
works. The CI verify job provides a disposable Postgres service; locally, `DATABASE_URL_TEST`
points at the same container as the dev database but a separate database, and `vitest.config.mts`
loads `.env.local` before the run.

The setup file switches `DATABASE_URL` to the test database at module load, before test files
import the database client. It then migrates and truncates every table, so tests never touch dev
data or each other's rows.

```ts
// tests/setup/db.ts
import { sql } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST must point at a disposable database");
process.env.DATABASE_URL = testUrl;

beforeAll(async () => {
  const client = await import("@/server/db/client");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  await migrate(client.db, { migrationsFolder: "./drizzle" });
  await client.db.execute(sql.raw("truncate ... restart identity cascade"));
});
```

Account tests own the important rules: a saved address is user-scoped, the first address is both
defaults, deleting a default promotes another, a guest order is claimable only with its token, an
order already claimed cannot move, and deletion anonymises the profile while keeping the order.

Variant-tree tests own the catalog rules: per-parent children never create a phantom combination,
children inherit parent defaults, copying a sibling creates new SKUs on the target path, deleting a
branch removes its variants, bulk updates apply only to the selected leaves, and the migration
backfills existing variants into leaves. The gallery fallback is a unit-tested pure helper.

Sale tests cover the active window, an expired window, a sale that is not below the list price, a
free sale, the discount percentage, and the Asia/Dubai input round trip. The catalog integration
test asserts the effective from-price and the sale fields on the product detail.

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

Admin authentication is captured once into `tests/e2e/.auth/admin.json` via `storageState`, using a
setup project that runs first. The setup signs in through the real form, enrols TOTP when the
admin config requires it, and generates codes with `otplib`; the file is gitignored. Do not sign in
through the UI in every spec; that tests the form six times and makes flakes stack up.

The account specs create customers with a unique `customer-…@example.com` address. Global setup
deletes those customers, their carts, sessions, and addresses between runs, so a rerun starts clean
without touching the seeded admin.

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
| End-to-end (Postgres service) | `pnpm test:e2e` | 10 min |
| Dependency review | GitHub action, fails on high or critical | 1 min |
| Dependency audit | `pnpm audit --audit-level=high` | 1 min |
| Repo scan | Trivy: vulnerabilities, secrets, misconfiguration | 2 min |

The verify job runs a Postgres 17 service container and sets `DATABASE_URL_TEST`; integration tests
migrate and truncate that database. The end-to-end job runs its own Postgres service container and
uploads the Playwright HTML report and traces on failure. A trace is the fastest way to explain a
red build, so it is uploaded before any cleanup step runs.

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
