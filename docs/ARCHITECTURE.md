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
| Account page + action | Profile, saved addresses, order history, claim, deletion | Session-guarded; every row filtered by the session user id |
| Route handler | Stripe webhooks, image uploads, `/api/health` | Signature-verified or session-verified; no business rules |
| Caddy | Static media, caching | Serves `/media/*` from the uploads volume |

The service layer is plain TypeScript that takes a database handle. That is the split point: if a
separate API or mobile client is ever needed, services are lifted behind HTTP without rewriting the
rules.

## Data model

Twenty-six tables, deliberately narrow. Core tables carry `created_at`; most carry `updated_at`; join
tables stay minimal.
| Table | Holds | Notes |
| --- | --- | --- |
| `users` | Admin and customer identity | `role` is `admin` or `customer`; `phone`; `deleted_at` tombstones a deleted customer |
| `sessions` | Session records | Token stored hashed, never raw |
| `accounts` | Password credentials | Better Auth |
| `verifications` | Short-lived tokens | Email verification, password reset |
| `two_factors` | TOTP secret, backup codes | Required for admin |
| `products` | Merchandised product | `slug` unique, `status` is `draft`/`active`/`archived` |
| `variants` | Sellable leaf | `sku` globally unique, `price_minor`, `stock_qty` |
| `product_options` | A named level | e.g. `Colour`, `Size`; ordered by `position` |
| `product_option_values` | The values within a level | e.g. `Black`, `S`, `M` |
| `variant_nodes` | Explicit variant tree | group or leaf; parent defaults and images; leaf links one `variants` row |
| `product_media` | Ordered images per product | `storage_key`, `alt`, `position` |
| `categories` | Hierarchical navigation | self-referencing `parent_id`; `slug` unique; sibling `position` |
| `product_categories` | Product ↔ category | Many-to-many; composite primary key |
| `collections` | Curated product group | `slug` unique; home-page `position` |
| `collection_products` | Product ↔ collection | Many-to-many; per-collection `position` |
| `badges` | Reusable card label | `label` unique; tone and `position` |
| `product_badges` | Product ↔ badge | Many-to-many; composite primary key |
| `customer_addresses` | Saved delivery and billing addresses | one default of each per customer, partial unique indexes |
| `carts` | One basket per shopper token | Token hashed; `expires_at`; `user_id` links a signed-in cart |
| `cart_items` | Variants in a cart | Unique on `(cart_id, variant_id)` |
| `orders` | Placed order and its totals | `number` unique and sequential; `user_id` links the owner; `billing_address` snapshot |
| `order_items` | Snapshot of what was bought | Prices frozen at placement |
| `promotions` | Home-page carousel slides | image, headline, CTA, internal link, schedule, order |
| `audit_log` | Admin and account changes | Actor, action, before/after JSON, IP |
| `settings` | Store configuration | Key → JSONB, changed in admin |
| `counters` | Monotonic sequences | Order numbers come from here, inside the placement transaction |

### Invariants

- `order_items` never join to live prices for display. A price change tomorrow must not alter an
  order from yesterday.
- `orders.number` is drawn once, inside the placement transaction, and never reused.
- `variants.stock_qty` never goes negative; decrements take a row lock.
- The variant tree is explicit. A path exists only because the merchant created it; the admin never
  generates the full Cartesian product.
- A branch with children is a group and is not sellable. A branch without children is a leaf and
  owns exactly one `variants` row; one variant belongs to at most one leaf.
- A group's default price/stock is a creation-time convenience. Changing it never rewrites leaves
  that already exist.
- Every variant SKU is globally unique. Auto-generated SKUs come from the product slug and branch
  path, and remain editable.
- Deleting a branch deletes its descendants and their variants. Orders keep their line and address
  snapshots.
- Existing Cartesian variants were migrated into leaves; the old join table is gone.
- A category slug is unique. A category cannot move under itself or a descendant, and cannot be
  deleted while it has children or assigned products.
- A collection is curated: `collection_products.position` is the row order, separate from catalog
  order. An inactive or empty collection is omitted from the home page.
- A badge label is unique and only active badges render. A product can carry several badges, shown
  top-left on its card; the sale flag stays top-right.
- Stored order totals must be reproducible from their lines. If they disagree, the bug is in
  placement, not in the display.
- A cart is consumed when its order is placed; it never becomes the same cart again.
- `settings` is a typed key/value store with a Zod schema per key. Unknown keys are rejected.
- A saved address is mutable; an order's shipping and billing addresses are snapshots. Editing or
  deleting an address book row never changes an existing order.
- A customer has at most one default delivery address and one default billing address, enforced by
  partial unique indexes.
- An order has at most one owning customer. Claiming a guest order requires its lookup token and
  writes an audit entry; an email match alone is not proof.
- A deleted customer is a tombstone row: credentials, sessions, carts, and saved addresses are
  gone, while orders stay linked for accounting.

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

### Sale pricing

A sale is a `sale_price_minor` on the variant plus an optional `sale_starts_at` / `sale_ends_at`
window. The list price is never overwritten. The effective unit price is the sale price when the
window is active and the sale is below the list price; otherwise it is the list price. The same
pure helper (`src/lib/sale.ts`) is used by the catalog, product picker, cart, and checkout, so the
displayed price and the charged price cannot drift.

Admin times are entered in Asia/Dubai (UTC+4) and stored as instants. An expired sale falls back to
the list price automatically. `order_items.unit_price_minor` snapshots the effective price paid, so
a later sale or price change cannot rewrite an order. Sale edits write an `audit_log` entry.

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

## Variants and the tree

A product's variant structure is an explicit tree, not a Cartesian product.

- A **level** (`product_options`) is a named choice dimension, ordered by `position`: Colour, then
  Size, then Fit.
- A **level value** (`product_option_values`) is one choice in that level. Values are shared names;
  each parent branch decides which of them exist underneath it.
- A **branch** (`variant_nodes`) is one value under a parent, or a root. A branch with children is a
  group; a branch without children is a leaf.
- A **leaf** points at one `variants` row. The variant owns the real SKU, price, stock, and active
  flag. A group can carry an image and default price/stock, but it is never sold.
- A group's defaults pre-fill the add-child form. They are not live inheritance: an existing leaf
  keeps the price/stock it was created with until edited.
- The admin tree builder adds roots and children, copies a sibling's subtree, edits leaf details,
  and deletes a branch with its descendants. It never fills in combinations the merchant did not
  choose.
- Levels are locked while the tree has branches. Removing a level or value removes the branches
  built from it. Past orders keep their snapshots.
- Auto-generated SKUs come from the product slug and the branch labels, then a numeric suffix if
  the SKU is already taken. The admin can edit every SKU.
- The storefront shows the tree parent first: choose Colour, then only that colour's existing sizes.
  Sold-out branches stay visible but disabled; the picker initially selects the first available
  leaf. A leaf image falls back to the nearest ancestor branch image, then the product gallery.
- Cart and order labels come from the leaf's path, so a cart line reads “Black / M” without joining
  through a separate option-value table.

The pre-launch migration created a tree from every existing variant, then dropped
`variant_option_values`. New products start with a default single variant when they have no levels,
and with whichever branches the merchant adds when they do.

## Categories, collections, and badges

Three separate systems share the product catalog but mean different things:

- **Categories** are navigation. `categories.parent_id` makes the tree; siblings are ordered by
  `position`. The admin creates, edits, reorders, and deletes categories; a category with children
  or assigned products cannot be deleted, and a move under itself or a descendant is rejected. The
  storefront navbar shows active roots, with active children in a hover/focus dropdown. A category
  page includes the products assigned to it and to every descendant.
- **Collections** are curated merchandising. The admin creates a collection, then adds products and
  orders them with `collection_products.position`. Active, non-empty collections render as rows on
  the home page, four products each, with a “View all” link to `/collections/[slug]`. Automatic
  best-seller rules can be layered on later without changing the manual model.
- **Badges** are labels. A badge has a unique label, a tone (`brand`, `neutral`, `success`,
  `warning`), an active flag, and an order. The admin assigns any number of badges on the product
  edit page. Active badges render top-left on cards and under the product title; the sale flag moved
  top-right so the two never collide.

Both assignments are many-to-many (`product_categories`, `product_badges`), so a product can sit in
several categories and carry several badges. Every create, update, delete, reorder, and assignment
writes an `audit_log` entry.

## Home page promotions

`promotions` holds the slides above the catalog on the home page:

- image (same upload pipeline as products), headline, subheadline, call-to-action label, and an
  internal path such as `/products/essential-tee` or `/collections/weekend`.
- active flag, position, and an optional Asia/Dubai start/end window. Only active slides inside
  their window are selected; expired and scheduled slides stay in the admin list with a status.
- the admin list supports create, edit, reorder, image replacement, and delete. Every mutation
  writes an `audit_log` entry.
- the storefront carousel renders the live slides in position order. It auto-advances every six
  seconds when there is more than one slide, pauses on hover/focus, respects reduced motion, and
  exposes previous/next and dot controls. A single slide renders without controls.
- links are internal paths only. This prevents a slide from becoming an open redirect or a
  `javascript:` link.

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

All totals come from one function, `priceCart()` in `src/lib/pricing.ts`: line totals
from stored prices, shipping from the pure rule, then the VAT component extracted from the
inclusive total. The cart page renders its result; the checkout action recomputes it and compares
the shopper's expected total with the fresh one. A mismatch fails the checkout with a "prices
changed, please review" message rather than charging a number the shopper did not see.

Stock is decremented at placement, before payment. That briefly holds inventory for abandoned
payments, which is acceptable at this size. A reservation table with an expiry is the later fix,
and the placement transaction is the seam for it.

UAE addresses collect: full name, phone (`+971`, validated), emirate (one of the seven), street,
building/villa, optional PO box, optional notes. Postal codes are not used.

## Customer accounts and addresses

A customer account is optional. Guest checkout stays available, and an account adds saved
addresses, order history, and faster checkout.

- `users` holds name, email, phone, role, `email_verified`, and `deleted_at`. Better Auth owns the
  credential rows in `accounts`.
- `customer_addresses` holds reusable delivery and billing addresses. Both default to the first
  saved row; later rows become a default only when the customer marks them. The flags are protected
  by partial unique indexes, so two defaults cannot be written even by a race.
- Checkout pre-fills the account email, name, phone, default delivery address, and default billing
  address. A signed-in shopper can save a new delivery or billing address without leaving checkout.
  “Same as delivery” is the default for billing.
- Orders link to the customer through `orders.user_id`; the account never stores its own copy of an
  order. Order history is a query, and order lines and addresses remain the immutable snapshots
  taken at placement.
- Billing is stored as `orders.billing_address` alongside the existing shipping snapshot. Old
  orders may have no billing address; the column is nullable.
- A guest order is claimed only with its order number and lookup token. The order page offers a
  claim button, and the account has a manual order-number + token form. An order already owned by
  another customer cannot be claimed; a successful claim writes an `order.claim` audit entry.
- On sign-in, the browser's anonymous cart is attached to the customer. If the account already has
  a cart, lines are merged by variant, capped at current stock, and the browser receives the token
  for the surviving cart. A cart owned by a different account is expired rather than merged.
- Account deletion is self-service with a password check. It removes credentials, sessions, carts,
  and saved addresses, anonymises name/email/phone, and keeps the tombstone `users` row so orders
  remain linked for accounting.
- Admin sees a customer list and detail: profile, spend, orders, and saved addresses. Every query
  is scoped by the customer id from the URL and the admin guard.
- Address entry is manual for now. The map picker is deferred until a provider and key are chosen;
  the stored address shape already tolerates an added pin later.

## Authentication and authorization

- Passwords are hashed by Better Auth (scrypt) and never logged.
- Sessions are database rows; the cookie carries an opaque token, `httpOnly`, `Secure`,
  `SameSite=Lax`. Admin sessions expire in 8 hours, customer sessions in 30 days.
- Better Auth trusts an explicit list of origins: the storefront URL, the admin host derived from
  `ADMIN_HOST`, and anything in `BETTER_AUTH_TRUSTED_ORIGINS`. An origin that is not listed is
  rejected with `INVALID_ORIGIN`. Session cookies are host-scoped, so an admin signs in on the host
  they will use — `admin.<domain>` in production.
- CSRF defence in depth: `SameSite=Lax` plus an Origin/Host check helper called by every mutating
  action.
- Admin requires TOTP. A control is checked once per session to avoid prompting on every action.
  Production keeps `ADMIN_REQUIRE_TWO_FACTOR=true`; local development may set it to `false` for a
  password-only admin, and the docs treat that as a dev-only override.
- Customer accounts use email + password. Email verification and self-service password reset are
  deliberately deferred to Phase 7; until then, an unverified email never grants ownership of an
  order or account data.
- Rate limits, enforced in the database so they survive a restart: login 5 per 15 minutes per
  IP+email, checkout 10 per hour per IP, order lookup 5 per hour per IP.
- Every admin mutation writes an audit entry with before and after state. Order claims and account
  deletions write audit entries too.
- Guests retrieve their order through a link containing a 24-byte random token, stored only as a
  SHA-256 hash and valid for 90 days. The order number alone is not enough to read an order. The
  same token is the only way to claim a guest order into an account.
- Account deletion requires the current password, removes the credential rows, and anonymises the
  profile; it cannot be undone.

## Admin surface

`admin.<domain>` serves the same app. Access is layered:

1. Network: Caddy basic auth now; Tailscale or an IP allowlist later.
2. Session: a valid session bound to a `role = admin` user.
3. Factor: TOTP verified for this session in production. `ADMIN_REQUIRE_TWO_FACTOR=false` is a
   local-development override only; it must never be false on the deployed store.
4. Action: the individual action re-checks the role, not just the page.

The panel also lists customers: name, email, phone, order count, spend, and last order, with a
detail page for saved addresses and order history. Customers never reach this host.

The product editor defines levels and values, then builds the variant tree. The tree is a compact
table: groups expand inline, the selected branch opens in a side inspector, and a single “Add
branches” form creates only the ticked values. Nothing is generated from a Cartesian product.

The admin also manages the home-page promotion carousel: image, headline, CTA, internal link,
schedule, order, and active state, with an audit entry for every change.

A no-code boundary is intentional: admin edits `settings` and content rows, never code. Anything
that would require a deploy belongs in this repo, not in the admin UI.

## Media

Uploads are streamed to a temporary file, validated by magic bytes (not by filename or MIME
header), capped at 10 MB, and re-encoded with `sharp` into AVIF and WebP at 480/960/1600 px wide.
EXIF is stripped. Output lands at `/data/uploads/<yyyy>/<mm>/<uuid>-<width>.<ext>`.

The same pipeline serves product gallery images and branch images. A leaf with no image uses the
nearest ancestor branch image, then the product gallery.

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
| Order history takeover | Token-only claim; no email-based linking; ownership checks on every order read |
| Address IDOR | Every address query filters by the session user id |
| Account takeover by email | No verification shortcut; password check plus token proof for orders |
| Deleted-account data | Profile anonymised, credentials removed, orders retained for accounting |
| Overselling | `SELECT … FOR UPDATE` on variant rows inside the placement transaction |
| Admin takeover | Proxy-level gate, 2FA, 8-hour sessions, audit log |
| Credential stuffing | Rate limit + lockout, breached-password check on signup |
| Proxy bypass CVE | Authorization repeated in every handler |
| Vulnerable dependency | CVE gates in CI, weekly scan, Dependabot |
| Secret in git | Trivy secret scan on every push, `.env*` ignored except `.env.example` |
| Scraping | Rate limits per IP on catalog listing and search |
