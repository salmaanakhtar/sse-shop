# sse-shop

A custom storefront and no-code admin for physical goods, sold in the UAE in AED. One Next.js app,
one Postgres database, one Docker host. The store grows one small feature at a time, and each
feature ships with tests.

## Ground rules

**The server is the source of truth.** The browser sends intent — a variant id and a quantity — and
the server decides price, stock, shipping, tax, and totals from database state. Every mutation
re-reads what it needs instead of trusting the request body.

**Authorization lives in the handler.** `src/proxy.ts` routes by host and rewrites; each page,
server action, and route handler checks the session and role itself. Proxy is a convenience, never a
security boundary — that is how middleware-bypass CVEs turn into breaches.

**Money is an integer count of fils.** 1 AED = 100 fils, so AED 240.00 is stored as `24000`. No
floats, no arithmetic on decimal strings, no parsing formatted currency back into a number. Format
only at the edge with `Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`.

**Prices are VAT-inclusive.** `total = subtotal + shipping - discount`, and `tax_minor` is the 5%
component already inside that total — an addend would double-charge the shopper. See
`docs/adr/0006-vat-inclusive-pricing.md`.

**A feature ships with its tests.** A unit test for each rule, a Playwright journey for each user
path. Red CI blocks the merge, and a feature without them is unfinished.

**Ask, then record.** Ambiguity gets a question, not a guess. Once answered, the answer lands where
it belongs: `CONTEXT.md` for vocabulary, `docs/adr/` for a decision that is expensive to reverse,
`docs/ROADMAP.md` for sequencing and open questions.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS 4, shadcn/ui components vendored into `src/components/ui` |
| Data | Postgres 17, Drizzle ORM, drizzle-kit migrations (SQL committed) |
| Auth | Better Auth — email + password, DB sessions, TOTP 2FA for admin |
| Validation | Zod schemas at every boundary: forms, actions, env, webhooks |
| Unit + integration | Vitest (+ React Testing Library where a component is worth it) |
| End-to-end | Playwright |
| Deploy | Docker Compose on a VPS: `web`, `db`, `caddy`, volumes for `pgdata` and `uploads` |

Vitest runs on Vite; Next.js remains the application bundler. That combination is intentional —
see `docs/TESTING.md`.

## Repo map

```
src/
  app/                routes: (storefront), account, admin, api
  components/ui/      shadcn primitives, edited in place
  components/storefront/  storefront sections and account forms
  components/admin/       admin screens, including the variant tree builder
  server/
    db/               schema.ts, client.ts, migrations/
    services/         catalog, search, cart, orders, shipping, settings, variant-tree, categories, collections, badges, wishlists, preferences, home-sections, pages, reviews, related, addresses, customers, promotions, payments/, mail/
    auth/             better-auth config, session helpers, guards
  lib/                money, sale, slugs, result, dates — pure, importable anywhere
tests/
  unit/               fast, no I/O
  integration/        services against a real Postgres
  e2e/                Playwright journeys
```

## Commands

```bash
pnpm dev              # local dev server
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run (unit + component + integration)
pnpm test:watch       # vitest watch
pnpm test:e2e         # playwright against a production build
pnpm db:up            # local Postgres container
pnpm db:down          # stop it
pnpm db:generate      # generate a migration from schema changes
pnpm db:migrate       # apply migrations
pnpm db:seed          # deterministic demo data
```

## Conventions

- Server Components read. Server actions mutate. Route handlers exist only for webhooks, uploads,
  and transports a form cannot carry.
- Name an action after the user's intent: `addToCart`, `placeOrder`, `publishProduct`.
- Every action validates input with Zod on its first line, then returns a discriminated result
  (`{ ok: true, data }` / `{ ok: false, error }`). Log unexpected errors; return a generic message.
- Import `@/server/**` from server code only. `@/lib/**` stays pure so client bundles can use it.
- A customer-owned row is read or mutated only through a query that includes the session user id.
  An id from a form proves nothing; an order is claimed only with its lookup token.
- Derive types from the schema (`typeof products.$inferSelect`) rather than restating shapes.
- Entity ids are UUID v7. Only `orders.number` is sequential and human-readable.
- Migrations are generated, reviewed as SQL, and committed together with the schema change.
- UI copy is English. Arabic and RTL are a later feature, not an assumption.

## Working agreement

- **Every push is a handoff.** Assume the next session starts on another device with no chat
  history and no local files. The repository alone must be enough to continue: setup works from
  `README.md` and `.env.example`, migrations and the seed cover the database, `docs/ROADMAP.md`
  names the current phase and open questions, and any in-flight work is written down with its
  branch, next step, and blockers. Machine-local state that cannot be committed (secrets, database
  contents, uploads) is documented with where to get it or how to regenerate it. A push that needs
  a file or a memory left on this machine is not finished.
- **Commit and push when the slice is done.** Do not stop to ask whether to commit. A feature,
  fix, docs change, or test change is finished only when it is committed with a conventional
  message and pushed to the remote, with a clean working tree.
- One feature per pull request, small enough to review in one sitting.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Update the docs a change invalidates in the same pull request.
- Replace or materially rewrite a feature → move its card in `docs/kanban.html`. Bug fixes and
  small edits leave the board alone.
- Secrets live in `.env.local` locally and in the host environment in production. `.env.example`
  documents every key with a fake value.
- A CVE gate is never silenced. Add an entry to the allowlist with a justification, an owner, and
  an expiry date, and let the gate keep running.

## Where to look

| When you are… | Read |
| --- | --- |
| Adding, renaming, or questioning a domain term | `CONTEXT.md` |
| Touching schema, auth, checkout, media, or deployment | `docs/ARCHITECTURE.md` |
| Writing tests, debugging a flake, or changing CI | `docs/TESTING.md` |
| Choosing what to build next | `docs/ROADMAP.md` |
| Wondering why something is shaped the way it is | `docs/adr/` |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
