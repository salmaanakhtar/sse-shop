<img src="assets/icon.svg" width="64" height="64" alt="">

# sse-shop

A custom storefront and no-code admin for physical goods, sold in the UAE in AED.

The store starts as a walking skeleton — browse, cart, checkout, order — and grows one feature at a
time. Every feature ships with a unit test and a Playwright journey.

## Status

Phase 2 complete. A shopper can browse, add to cart, check out with a UAE address, and receive an
order with a lookup link. They can also create an account with saved delivery and billing
addresses, see their order history, and claim a guest order with its lookup token. An admin can
sign in with TOTP, manage products, options, variants, and images, and review customers and their
orders. Payments are simulated behind a provider interface. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Postgres 17 ·
Drizzle ORM · Better Auth · Vitest · Playwright · Docker Compose + Caddy on a VPS.

Why these choices: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/adr/`](docs/adr/).

## Docs

| File | What it answers |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Ground rules, commands, and conventions for anyone (human or agent) working here |
| [`CONTEXT.md`](CONTEXT.md) | The vocabulary: product, variant, order, cart, money |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime shape, data model, auth, checkout, deployment, threat model |
| [`docs/TESTING.md`](docs/TESTING.md) | Test layers, configs, CI gates, the CVE gate, flake policy |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases, completion criteria, open questions |
| [`docs/kanban.html`](docs/kanban.html) | Read-only board of what is complete, in flight, and next — open the file directly |
| [`docs/adr/`](docs/adr/) | Decisions that are expensive to reverse |

## Local development

Requires Node 24 (`nvm use`), pnpm, and Docker.

```bash
pnpm install
cp .env.example .env.local        # then set BETTER_AUTH_SECRET and ADMIN_PASSWORD
pnpm db:up                        # Postgres on 127.0.0.1:5433
pnpm db:migrate
pnpm db:seed                      # one demo product with two options and four variants
pnpm dev                          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit, component, and integration tests |
| `pnpm test:e2e` | Playwright, against a production build |
| `pnpm db:generate` | Generate a migration after a schema change |
| `pnpm db:studio` | Browse the database |
| `pnpm db:down` | Stop the development database |

Integration tests use `DATABASE_URL_TEST`. Create that disposable database once:

```bash
docker compose -f docker-compose.dev.yml exec db createdb -U sse_shop sse_shop_test
```

The admin sits on a second hostname. Locally, `admin.localhost` resolves to your machine on most
systems, and `src/proxy.ts` rewrites that host to the `/admin` route tree.

Local development may set `ADMIN_REQUIRE_TWO_FACTOR=false` for a password-only admin. Production
must keep it `true`; the guard still checks the role on every page and action either way.

---

Created in [T3 Code](https://t3.codes).
