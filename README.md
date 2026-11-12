<img src="assets/icon.svg" width="64" height="64" alt="">

# sse-shop

A custom storefront and no-code admin for physical goods, sold in the UAE in AED.

The store starts as a walking skeleton — browse, cart, checkout, order — and grows one feature at a
time. Every feature ships with a unit test and a Playwright journey.

## Status

Phase 1 in progress. The application scaffold is in place: Next.js 16 with Tailwind 4, a Postgres
schema with seventeen tables and a committed migration, Better Auth with TOTP, Docker Compose, and
green unit and Playwright suites. Catalog, cart, and checkout are next. See
[`docs/ROADMAP.md`](docs/ROADMAP.md).

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
cp .env.example .env.local        # then set BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm db:up                        # Postgres on 127.0.0.1:5432
pnpm db:migrate
pnpm db:seed                      # one demo product with two options and four variants
pnpm dev                          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit and component tests |
| `pnpm test:e2e` | Playwright, against a production build |
| `pnpm db:generate` | Generate a migration after a schema change |
| `pnpm db:studio` | Browse the database |
| `pnpm db:down` | Stop the development database |

The admin sits on a second hostname. Locally, `admin.localhost` resolves to your machine on most
systems; the rewrite lands with the admin screens.

---

Created in [T3 Code](https://t3.codes).
