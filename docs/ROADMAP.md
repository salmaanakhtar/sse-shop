# Roadmap

Sequenced so every phase leaves a working store. A phase is done when its completion criteria
hold, not when the code is written.

## Phase 0 — Foundation

Docs, conventions, and an empty but green pipeline.

**Done when**
- `AGENTS.md`, `CONTEXT.md`, and the three docs exist and agree with each other.
- The app scaffolds, builds, and serves a placeholder page.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` all pass on an empty test suite.
- The security workflow runs and is green.

## Phase 1 — Walking skeleton

The smallest version that can honestly take an order.

**In scope**
- Schema for products, variants, media, carts, orders, order items, settings, audit log.
- Storefront: product list, product detail with variant selection, add to cart.
- Server-owned cart with a cookie token, quantity edits, correct totals.
- Guest checkout: email + UAE address, server-side revalidation, order creation with stock
  decrement inside one transaction.
- Payment provider interface with a mock provider that marks the order paid.
- Confirmation page and guest order lookup by signed link.
- Admin sign-in with TOTP, product CRUD, variant CRUD, publish/unpublish, single image upload.

**Out of scope on purpose**: discounts, search, accounts, shipping carriers, invoices, emails
beyond a console driver, themes.

**Done when**
- The six end-to-end journeys in `docs/TESTING.md` pass.
- An order placed in the UI exists in the database with frozen line prices.
- Prices and stock are never read from the request body.
- Two concurrent checkouts for the last unit produce one order and one honest failure.

## Phase 2 — Real money and real mail

- Stripe Checkout behind the existing `PaymentProvider` interface, webhook-verified and idempotent.
- Order confirmation and shipping notification emails through a real provider.
- Failed and abandoned payments leave no held stock.
- Refunds recorded against the order, with an audit entry.

**Done when** a test-mode card produces a paid order, a declined card produces a retryable order,
and a replayed webhook changes nothing.

## Phase 3 — No-code control

The layer that makes the admin worth having.

- `settings` with typed, Zod-validated keys: store name, contact details, currency label, shipping
  rules, announcement bar.
- Theme tokens: palette, radius, typography — edited in admin, stored as settings, applied as CSS
  variables. No deploy.
- Homepage composed from ordered sections (hero, featured products, category row, text block).
- Draft/publish for content, with a preview link.

**Done when** a colour change, a shipping rule change, and a new homepage section all reach the
live storefront without a deploy, and each writes an audit entry.

## Phase 4 — Depth

- Product options as reusable attributes (size, colour) with variant images.
- Discount codes and automatic promotions, with a documented precedence order.
- Search and category navigation.
- Customer accounts with order history, plus claiming a guest order.
- Fulfilment: shipment records, tracking numbers, partial dispatch.
- Invoices with TRN, in Arabic and English if required.

## Phase 5 — Hardening

- Admin reachable only over Tailscale; public DNS record removed.
- Automated encrypted backups with a rehearsed restore.
- Error tracking and structured request logs.
- Uptime and certificate-expiry monitoring.
- Load check at 10× expected traffic.

## Open questions

These block or shape upcoming work. Answers land in `CONTEXT.md`, an ADR, or this file.

1. **VAT.** Are displayed prices VAT-inclusive? The store is presumably charging 5% VAT — is it
   registered, and do invoices need a TRN?
2. **Shipping pricing.** Flat rate, per-emirate table, free over a threshold, or weight-based?
3. **Product options.** Free-form option names per product, or a fixed attribute set with variant
   combinations?
4. **Variant images.** Is one image set per product enough, or does each colour need its own
   gallery?
5. **Language.** English only for launch, or Arabic and RTL in the first release?
6. **Domain and DNS.** What is the production domain, and who controls the DNS record for the admin
   subdomain?
7. **Email.** Which provider and sending domain, and is there a warm-up period before launch?
8. **Stock policy.** When the last unit is sold, does the product hide, show "sold out", or accept
   backorders?
