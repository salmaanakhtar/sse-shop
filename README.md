<img src="assets/icon.svg" width="64" height="64" alt="">

# sse-shop

A custom storefront and no-code admin for physical goods, sold in the UAE in AED.

The store starts as a walking skeleton — browse, cart, checkout, order — and grows one feature at a
time. Every feature ships with a unit test and a Playwright journey.

## Status

Foundation. Docs and conventions are in place; the application scaffold is next. See
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

Requires Node 24 (`nvm use`) and pnpm. Setup instructions land with the scaffold.

---

Created in [T3 Code](https://t3.codes).
