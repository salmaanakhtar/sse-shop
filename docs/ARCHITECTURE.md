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
Middleware rewrites by host so `/admin` lives at the root of the admin subdomain. Both are the same
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

Thirteen tables, deliberately narrow. Every table carries `created_at`; most carry `updated_at`.

| Table | Holds | Notes |
| --- | --- | --- |
| `users` | Admin and customer identity | `role` is `admin` or `customer`; single admin in v1 |
| `sessions` | Session records | Token stored hashed, never raw |
| `accounts` | Password credentials | Better Auth |
| `two_factor` | TOTP secret, backup codes | Required for admin |
| `products` | Merchandised product | `slug` unique, `status` is `draft`/`active`/`archived` |
| `variants` | Priced, stocked unit | `sku` unique, `price_minor`, `stock_qty` |
| `product_media` | Ordered images per product | `storage_key`, `alt`, `position` |
| `carts` | One basket per shopper token | Token hashed; `expires_at` |
| `cart_items` | Variants in a cart | Unique on `(cart_id, variant_id)` |
| `orders` | Placed order and its totals | `number` unique and sequential |
| `order_items` | Snapshot of what was bought | Prices frozen at placement |
| `audit_log` | Admin changes | Actor, action, before/after JSON, IP |
| `settings` | Store configuration | Key → JSONB, changed in admin |

### Invariants

- `order_items` never join to live prices for display. A price change tomorrow must not alter an
  order from yesterday.
- `orders.number` is drawn once, inside the placement transaction, and never reused.
- `variants.stock_qty` never goes negative; decrements take a row lock.
- Stored order totals must be reproducible from their lines. If they disagree, the bug is in
  placement, not in the display.
- A cart is consumed when its order is placed; it never becomes the same cart again.
- `settings` is a typed key/value store with a Zod schema per key. Unknown keys are rejected.

## Money, tax, currency

All amounts are integers in fils. `price_minor` is the list price. Order totals are
`subtotal_minor + shipping_minor + tax_minor - discount_minor = total_minor`, each an integer.

Only the storefront formats currency. No formatting, parsing, or rounding happens anywhere near
persistence, because round-trip formatting is where cent-level bugs live.

The single currency is AED. Multi-currency is out of scope until there is a reason for it; the
`currency` column exists so a future migration is additive rather than a rewrite.

UAE VAT is 5%. Whether display prices include VAT is an open question in `docs/ROADMAP.md`. Until
answered, `tax_minor` is stored and set to `0`, and the checkout summary shows no tax line.

## Cart and checkout

```text
anonymous visit ──► cart token (httpOnly cookie) ──► cart row
      │
      ▼
add / update / remove ──► server recomputes every total on read
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
- Guests retrieve their order through a signed, expiring link sent by email, not through a
  guessable order number alone.

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

- `/api/health` checks the database and returns liveness for uptime monitoring.
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
| Middleware bypass CVE | Authorization repeated in every handler |
| Vulnerable dependency | CVE gates in CI, weekly scan, Dependabot |
| Secret in git | Trivy secret scan on every push, `.env*` ignored except `.env.example` |
| Scraping | Rate limits per IP on catalog listing and search |
