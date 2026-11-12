# Architecture

How the store is put together, and why. Vocabulary comes from `CONTEXT.md`; decisions that were
expensive to reverse are recorded in `docs/adr/`.

## Shape

One deployable. A Caddy reverse proxy terminates TLS and routes by host to the same Next.js
process.

```
            Internet
               │
           ┌───▼────┐
           │ Caddy  │  TLS, gzip, cache headers, /media from disk
           └───┬────┘
     storefront│ admin.<domain>
           ┌───▼──────────────────┐
           │ Next.js (standalone) │  RSC pages, server actions, route handlers
           └───┬──────────────┬───┘
       ┌───────▼───┐   ┌──────▼──────┐
       │ Postgres  │   │ /data/uploads│
       └───────────┘   └─────────────┘
```

Two hostnames, one app: `example.com` serves the storefront, `admin.example.com` serves the admin.
`src/proxy.ts` (Next 16's rename of middleware) rewrites by host so `/admin` lives at the root of
the admin subdomain. Both are the same
process, which keeps deployment and authorization logic in one place.

Admin is additionally gated outside the app (Caddy basic auth, mTLS, or Tailscale later). The app
never treats the network as its only defence.

## Request paths

| Kind | Used for | Rules |
| --- | --- | --- |
| Server Component | Every read: catalog, cart, order, admin tables | Query through `src/server/services`, never the DB directly from a page |
| Server action | Every user-initiated mutation | Zod-validate, authorize, call a service, revalidate |
| Route handler | Stripe webhooks, image uploads, `/api/health` | Signature-verified or session-verified; no business rules |
| Caddy | Static media, caching | Serves `/media/*` from the uploads volume |

The service layer is plain TypeScript that takes a database handle. That is the split point: if a
separate API or mobile client is ever needed, services are lifted behind HTTP without rewriting the
rules.

## Data model

Eighteen tables, deliberately narrow. Every table carries `created_at`; most carry `updated_at`.
| Table | Holds | Notes |
| --- | --- | --- |
| `users` | Admin and customer identity | `role` is `admin` or `customer`; single admin in v1 |
| `sessions` | Session records | Token stored hashed, never raw |
| `accounts` | Password credentials | Better Auth |
| `verifications` | Short-lived tokens | Email verification, password reset |
| `two_factors` | TOTP secret, backup codes | Required for admin |
| `products` | Merchandised product | `slug` unique, `status` is `draft`/`active`/`archived` |
| `variants` | Priced, stocked unit | `sku` unique, `price_minor`, `stock_qty` |
| `product_options` | A named choice a product offers | e.g. `Size`, `Colour`; ordered by `position` |
| `product_option_values` | The choices within an option | e.g. `S`, `M`, `L` |
| `variant_option_values` | Which values a variant represents | join row; unique on `(variant_id, option_id)` |
| `product_media` | Ordered images per product | `storage_key`, `alt`, `position` |
| `carts` | One basket per shopper token | Token hashed; `expires_at` |
| `cart_items` | Variants in a cart | Unique on `(cart_id, variant_id)` |
| `orders` | Placed order and its totals | `number` unique and sequential |
| `order_items` | Snapshot of what was bought | Prices frozen at placement |
| `audit_log` | Admin changes | Actor, action, before/after JSON, IP |
| `settings` | Store configuration | Key → JSONB, changed in admin |
| `counters` | Monotonic sequences | Order numbers come from here, inside the placement transaction |

### Invariants

- `order_items` never join to live prices for display. A price change tomorrow must not alter an
  order from yesterday.
- `orders.number` is drawn once, inside the placement transaction, and never reused.
- `variants.stock_qty` never goes negative; decrements take a row lock.
- A product with options has exactly one option value per option on every variant. A variant missing
  a value is not sellable, and the admin refuses to publish it.
- Stored order totals must be reproducible from their lines. If they disagree, the bug is in
  placement, not in the display.
- A cart is consumed when its order is placed; it never becomes the same cart again.
- `settings` is a typed key/value store with a Zod schema per key. Unknown keys are rejected.

## Money, tax, currency

All amounts are integers in fils. `price_minor` is the list price. Prices and shipping are
**VAT-inclusive**, which is the norm for UAE retail: the number a shopper sees is the number they
pay.

Each order stores four numbers, and the relationship between them is an invariant:

```text
total_minor = subtotal_minor + shipping_minor - discount_minor
tax_minor   = round(total_minor × rate_bp / (10000 + rate_bp))
```

`tax_minor` is **not an addend**. It is the 5% VAT already contained in the total, stored so the
cart, confirmation, and invoice can print "including AED 11.43 VAT" without recomputing at display
time. With `rate_bp = 500` the component is `total × 500 / 10500`, rounded half-up. A future
developer who adds `tax_minor` to the total will double-charge the customer, which is why the
equation is written down here and in `docs/adr/0006-vat-inclusive-pricing.md`.

Discounts apply before VAT extraction. Shipping is VAT-inclusive at the same rate. The breakdown
therefore always reconciles to the total.

Only the storefront formats currency. No formatting, parsing, or rounding happens anywhere near
persistence, because round-trip formatting is where fils-level bugs live.

The single currency is AED. Multi-currency is out of scope until there is a reason for it; the
`currency` column exists so a future migration is additive rather than a rewrite.

## Shipping

One flat rate and one free-shipping threshold, both in `settings` (`shipping.flat_rate_minor`,
`shipping.free_threshold_minor`). Shipping is free when the item subtotal reaches the threshold,
computed on subtotal before discounts so a discount code cannot silently push an order back into
paying for shipping.

The rule lives in `src/lib/shipping.ts` as a pure function taking `(subtotalMinor, settings)` and
returning a minor amount, which makes it unit-testable without a database. Per-emirate tables and
carrier rates replace it behind the same function signature.

## Cart and checkout

```text
anonymous visit ──► cart token (httpOnly cookie) ──► cart row
      │
      ▼
add / update / remove ──► server recomputes lines, shipping, and VAT on read
      │
      ▼
checkout: email + address ──► server re-validates stock and prices
      │
      ▼
      ┌──────────────── transaction ────────────────┐
      │ lock variant rows                            │
      │ decrement stock                              │
      │ insert order + order_items (price snapshot)  │
      │ delete cart items, expire cart               │
      └──────────────────────────────────────────────┘
      │
      ▼
payment provider ──► paid / failed ──► confirmation + email
```

The cart is server-owned because a browser-owned cart means trusting a client with prices. It lives
in Postgres behind an httpOnly cookie so a mid-session restart does not lose it, and so stock can be
checked against the same row the order will lock.

All totals come from one function, `priceCart()` in `src/server/services/pricing.ts`: line totals
from stored prices, shipping from the pure rule, then the VAT component extracted from the
inclusive total. The cart page renders its result; the checkout action recomputes it and compares
the shopper's expected total with the fresh one. A mismatch fails the checkout with a "prices
changed, please review" message rather than charging a number the shopper did not see.

Stock is decremented at placement, before payment. That briefly holds inventory for abandoned
payments, which is acceptable at this size. A reservation table with an expiry is the later fix,
and the placement transaction is the seam for it.

UAE addresses collect: full name, phone (`+971`, validated), emirate (one of the seven), street,
building/villa, optional PO box, optional notes. Postal codes are not used.

## Authentication and authorization

- Passwords are hashed by Better Auth (scrypt) and never logged.
- Sessions are database rows; the cookie carries an opaque token, `httpOnly`, `Secure`,
  `SameSite=Lax`. Admin sessions expire in 8 hours, customer sessions in 30 days.
- CSRF defence in depth: `SameSite=Lax` plus an Origin/Host check helper called by every mutating
  action.
- Admin requires TOTP. A control is checked once per session to avoid prompting on every action.
- Rate limits, enforced in the database so they survive a restart: login 5 per 15 minutes per
  IP+email, checkout 10 per hour per IP, order lookup 5 per hour per IP.
- Every admin mutation writes an audit entry with before and after state.
- Guests retrieve their order through a link containing a 24-byte random token, stored only as a
  SHA-256 hash and valid for 90 days. The order number alone is not enough to read an order.

## Admin surface

`admin.<domain>` serves the same app. Access is layered:

1. Network: Caddy basic auth now; Tailscale or an IP allowlist later.
2. Session: a valid session bound to a `role = admin` user.
3. Factor: TOTP verified for this session.
4. Action: the individual action re-checks the role, not just the page.

A no-code boundary is intentional: admin edits `settings` and content rows, never code. Anything
that would require a deploy belongs in this repo, not in the admin UI.

## Media

Uploads are streamed to a temporary file, validated by magic bytes (not by filename or MIME
header), capped at 10 MB, and re-encoded with `sharp` into AVIF and WebP at 480/960/1600 px wide.
EXIF is stripped. Output lands at `/data/uploads/<yyyy>/<mm>/<uuid>-<width>.<ext>`.

Caddy serves `/media/*` from that volume with long cache lifetimes and immutable filenames. Product
images are public by design; there is nothing to authorize.

## Deployment

`docker-compose.yml` runs three services:

| Service | Notes |
| --- | --- |
| `web` | Multi-stage build, Next.js standalone output, non-root user |
| `db` | Postgres 17, named volume, listens only on the compose network |
| `caddy` | 80/443, ACME TLS, serves the uploads volume read-only |

Images are built from the repo. The VPS pulls and restarts on deploy. Secrets come from an env file
outside the repository with `600` permissions.

Operationally:

- `/api/health` reports liveness. Database readiness joins it when the data layer serves traffic, so the endpoint never claims a healthy database it cannot reach.
- Nightly `pg_dump`, compressed, kept 7 daily and 4 weekly, copied off-host.
- Weekly `rsync` of the uploads volume.
- A restore is rehearsed quarterly; an untested backup is a hope, not a backup.
- Logs are structured JSON on stdout, rotated by Docker. The app never logs tokens, emails in full,
  or request bodies.

## Threat model

| Risk | Control |
| --- | --- |
| Card data theft | Stripe hosted checkout; card data never reaches this server (SAQ A) |
| Price tampering | Totals recomputed server-side from database prices |
| Overselling | `SELECT … FOR UPDATE` on variant rows inside the placement transaction |
| Admin takeover | Proxy-level gate, 2FA, 8-hour sessions, audit log |
| Credential stuffing | Rate limit + lockout, breached-password check on signup |
| Proxy bypass CVE | Authorization repeated in every handler |
| Vulnerable dependency | CVE gates in CI, weekly scan, Dependabot |
| Secret in git | Trivy secret scan on every push, `.env*` ignored except `.env.example` |
| Scraping | Rate limits per IP on catalog listing and search |
