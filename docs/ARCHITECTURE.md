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

Forty-two tables, deliberately narrow. Core tables carry `created_at`; most carry `updated_at`;
join tables stay minimal.
| Table | Holds | Notes |
| --- | --- | --- |
| `users` | Admin and customer identity | `role` is `admin` or `customer`; `phone`; `locale`; `numeral_style`; marketing consent; `theme_preference`; `deleted_at` tombstones a deleted customer |
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
| `product_reviews` | Verified-buyer ratings and reviews | one per customer/product; `pending`/`approved`/`rejected` |
| `categories` | Hierarchical navigation | self-referencing `parent_id`; `slug` unique; sibling `position` |
| `product_categories` | Product ↔ category | Many-to-many; composite primary key |
| `collections` | Curated product group | `slug` unique; home-page `position` |
| `collection_products` | Product ↔ collection | Many-to-many; per-collection `position` |
| `badges` | Reusable card label | `label` unique; tone and `position` |
| `product_badges` | Product ↔ badge | Many-to-many; composite primary key |
| `customer_addresses` | Saved delivery and billing addresses | one default of each per customer, partial unique indexes |
| `wishlists` | Named private lists | one default per customer; unique name per customer |
| `wishlist_items` | Saved variants | composite key; stores the effective price when saved |
| `wishlist_alerts` | One alert per customer and variant | prevents repeat mail across named lists |
| `stock_alerts` | Back-in-stock requests | unique on `(variant_id, email)`; one email then marked notified |
| `low_stock_alerts` | Open low-stock crossing per variant | row removed above threshold so the next crossing alerts again |
| `abandoned_cart_emails` | One recovery email per cart | unique cart id |
| `carts` | One basket per shopper token | Token hashed; `expires_at`; `user_id` links a signed-in cart |
| `cart_items` | Variants in a cart | Unique on `(cart_id, variant_id)` |
| `orders` | Placed order, totals, and fulfillment state | `number` unique and sequential; status/payment state; tracking; invoice number; refund total; cancellation/return timestamps |
| `order_items` | Snapshot of what was bought | Prices frozen at placement |
| `order_events` | Order timeline | type, message, optional actor; appended by every lifecycle change |
| `refunds` | Manual refund records | amount, reason, optional provider reference |
| `promotions` | Carousel slides and their pages | slug, image, headline, CTA, schedule, order |
| `promotion_rows` | Ordered rows on a promotion page | category, collection, or hand-picked products |
| `promotion_row_products` | Hand-picked products in a row | composite key; per-row position |
| `audit_log` | Admin and account changes | Actor, action, before/after JSON, IP |
| `settings` | Store configuration | Key → JSONB, changed in admin |
| `home_sections` | Admin-composed homepage | ordered kind/title/body/config/active |
| `pages` | Legal and trust pages | slug, trusted HTML, published, SEO fields |
| `shipping_zones` | One delivery zone per emirate | active flag, free-delivery threshold |
| `shipping_bands` | Weight ranges inside a zone | non-overlapping; open-ended top band allowed |
| `rate_limits` | Hashed fixed-window counters | protects public mutations |
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
- Every customer has at most one default wishlist, and it cannot be deleted. A variant may appear in
  several lists; the first saved price is kept per item.
- A price-drop alert is claimed by a unique `(user_id, variant_id)` row before mail is sent, so two
  concurrent reads cannot send twice. Removing the variant from every list releases the claim.
- The storefront theme is scoped to `.storefront-shell`; the admin inherits the light palette even
  when the shopper chose dark.
- A promotion slug is unique. A category or collection can appear at most once on a promotion page;
  a hand-picked row cannot contain the same product twice. Products may repeat across different
  rows. Category rows include descendants, and rows with no visible products are hidden.
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

Delivery is priced by emirate and cart weight:

- `shipping_zones` has one row per emirate with `active`, `free_threshold_minor`, and position.
- `shipping_bands` has non-overlapping weight ranges per zone. `max_weight_grams` is inclusive;
  null is the open-ended top band. Each band carries one charge.
- Every variant has an optional `weight_grams`, editable in the variant inspector. Null counts as
  zero, so a missing weight ships in the lightest band rather than making the cart unpriceable.
- An active zone with a band covering the weight wins. Otherwise the store `settings` flat rate and
  free-threshold fallback apply, so a half-configured zone never removes a charge silently.
- Free shipping compares the item subtotal before discounts, at the zone threshold, so a discount
  cannot push an order back into paying for delivery.

The rules are pure in `src/lib/shipping.ts` (`bandForWeight`, `zoneShippingFor`) and unit-tested
without a database. `resolveShippingRate` in `src/server/services/shipping.ts` joins the zone tables
and the fallback. Checkout quotes all seven emirates on the server and recomputes the chosen one at
placement; the posted expected total must match or the checkout stops. The cart page shows the flat
fallback because it has no emirate yet.

Admin editing lives at `/admin/shipping`: one card per emirate, free-delivery threshold, active
flag, and editable bands. Saving validates ranges and rejects overlaps; each change writes an audit
entry.

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

All three assignments are many-to-many (`product_categories`, `collection_products`,
`product_badges`), so a product can sit in several categories, several collections, and carry
several badges. Every create, update, delete, reorder, and assignment writes an `audit_log` entry.

## Promotion pages

`promotions` holds the carousel slides above the catalog and the page each slide opens:

- each promotion has a unique slug, image (same upload pipeline as products), headline,
  subheadline, call-to-action label, active flag, position, and an optional Asia/Dubai window. The
  slide links to `/promotions/[slug]`.
- the carousel renders live slides in position order. It auto-advances every six seconds when there
  is more than one slide, pauses on hover/focus, respects reduced motion, and exposes previous/next
  and dot controls. A single slide renders without controls.
- the promotion page uses the same image and copy as its hero, then renders its rows in order.
- a row is one of three kinds:
  - **category**: products in the category and its descendants, in catalog order;
  - **collection**: products in the collection's curated order;
  - **products**: a hand-picked, ordered product selection.
- each row has an editable heading. Collection and category rows default their heading to the
  source name; a hand-picked row requires one.
- the same category or collection can appear only once on a page, and a hand-picked row cannot
  contain the same product twice. Products may still appear in different rows. Empty rows are
  hidden on the storefront; the admin shows every row.
- the admin editor creates, renames, reorders, and deletes rows, plus adds and removes products in a
  hand-picked row. Every mutation writes an `audit_log` entry.
- scheduled, expired, and inactive promotions return 404. Because the page is an internal route with
  a slug rather than a user-supplied URL, a slide cannot become an open redirect or a `javascript:`
  link.

## Wishlists and price alerts

Wishlists are account-only and private:

- `wishlists` holds named lists. `ensureDefaultWishlist` lazily creates the one default list,
  “Saved”; the partial unique index makes that safe under concurrency. Extra lists are created,
  renamed, and deleted by the customer.
- `wishlist_items` stores variants, not products, plus `added_price_minor` — the effective price at
  the moment the variant was saved. Saving the same variant to another list keeps the first item's
  threshold; the product detail dialog can save to several lists at once.
- The save control is on the product detail page because the customer is choosing a variant. It
  opens a small selector with the customer's lists. Signed-out shoppers see a sign-in prompt.
- A wishlist page lets the customer select items, add them to the cart, and continue to checkout.
  Unavailable items stay visible and removable but cannot be selected.

Price alerts are evaluated lazily, because there is no scheduler yet:

- the wishlist index and detail pages check the current customer; a product page checks that
  customer's items for the product; an admin price or sale change checks the affected variants.
- `wishlist_alerts` is a `(user_id, variant_id)` claim row. The evaluator inserts it with
  `on_conflict_do_nothing` before calling the mailer, so concurrent reads cannot send duplicates.
  A failed send deletes the claim so a later read can retry.
- the effective price (including an active sale) must fall below the highest saved price across the
  customer's lists. One email covers all lists. Deleting the last wishlist item for that variant
  removes the claim, so removing and re-adding can alert again.
- mail uses the console driver until Phase 7.

## Storefront theme

The storefront supports Auto, Light, and Dark. Auto follows `prefers-color-scheme`; an explicit
choice is stored in an httpOnly cookie and, for a signed-in customer, on `users.theme_preference`.
The cookie wins on that browser; otherwise the account preference applies. The palette is applied
as CSS variables on `.storefront-shell`, so the admin stays light regardless of the shopper's
choice. The theme switcher sits in the storefront header.

## Storefront content controls

The admin can edit the storefront without a deploy:

- `/admin/settings` writes typed settings: identity, contact and legal details, TRN, tax, fallback
  shipping, return window, low-stock threshold, abandoned-cart delay, announcement bar, and theme
  tokens.
- `/admin/home` composes ordered homepage sections: hero, promotion carousel, collection row,
  category row, text block, hand-picked products, or all products. Inactive sections stay in admin
  and are hidden from shoppers.
- `/admin/pages` manages Privacy, Terms, Shipping, Returns, Contact, FAQ, Cookies, and any other
  content page. Bodies are trusted admin HTML and are publicly available at `/pages/[slug]`.
- The footer reads published pages, contact details, VAT copy, and the free-delivery threshold from
  settings instead of hardcoding them.
- Every settings, section, and page change writes an audit entry. The current implementation does
  not yet provide a side-by-side preview/draft workflow for homepage sections.

## Arabic and numerals

English is served at the normal paths. Arabic is served under `/ar`:

- `src/proxy.ts` rewrites `/ar/...` to the same pages and adds `x-store-locale: ar`; the browser URL
  stays Arabic. The storefront layout sets `lang` and `dir` on the shell, and the shared translation
  dictionary in `src/lib/i18n.ts` supplies MSA copy for the primary shopping flow.
- A language switch changes the URL prefix and stores the choice in a cookie and on
  `users.locale`. A signed-in customer's preference is copied into a new browser after sign-in when
  no locale cookie exists.
- Numerals are a separate preference (`latin` or `arabic`) stored in a cookie and
  `users.numeral_style`. `formatMoney` and `formatDateFor` accept the locale and numeral style.
- Product content, category names, admin, and emails remain English. Account, checkout, and
  secondary copy are progressively covered by the dictionary; untranslated strings fall back to
  English rather than disappearing.

## Search and SEO

- `/search` supports text search over title, description, and slug; category; min/max price;
  in-stock-only; sort by newest, price, or name; and 12-item pagination. Search results are
  `noindex`.
- Search currently loads matching active products and applies price/stock filtering and sorting in
  the service. The next scale step is a Postgres full-text/trigram index and SQL-level pagination.
- Product, category, collection, promotion, and content pages emit titles, descriptions, canonical
  URLs, Arabic alternates, and Open Graph metadata where available.
- `/sitemap.xml` includes home, products, categories, collections, active promotions, pages, and
  their Arabic paths. `/robots.txt` is generated from the store URL and disallows admin, account,
  cart, checkout, order, search, and API routes.
- Product pages include Product/AggregateOffer JSON-LD with price, currency, availability, and
  images.

## Reviews and recommendations

- A review requires a paid, non-cancelled order containing the product. One review per customer per
  product is enforced by a unique index.
- New and edited reviews are `pending`. Admins approve or reject them at `/admin/reviews`; only
  approved reviews contribute to the product rating and appear on the product page.
- Related products rank shared categories first, then shared collections, then the newest active
  fallback, excluding the current product.

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
from stored prices, either the zone-resolved charge or the flat rule, then the VAT component
extracted from the inclusive total. The cart page renders its result; the checkout action recomputes it and compares
the shopper's expected total with the fresh one. A mismatch fails the checkout with a "prices
changed, please review" message rather than charging a number the shopper did not see.

Stock is decremented at placement, before payment. That briefly holds inventory for abandoned
payments, which is acceptable at this size. A reservation table with an expiry is the later fix,
and the placement transaction is the seam for it.

UAE addresses collect: full name, phone (`+971`, validated), emirate (one of the seven), street,
building/villa, optional PO box, optional notes. Postal codes are not used.

## Order operations

```text
pending ──► confirmed ──► processing ──► shipped ──► delivered ──► return_requested ──► returned
   │            │             │              │
   └────────────┴─────────────┴──► cancelled (restock)
```

- The admin changes status at `/admin/orders/[id]`: start processing, ship with carrier and tracking
  (customer email), mark delivered, cancel and restock before fulfillment, approve a return and
  restock, and record refunds.
- A customer can request cancellation while the order is pending, confirmed, or processing. That
  request records a timestamp, reason, and event and emails the store; the admin still performs the
  cancellation so stock changes stay in one place.
- A customer can request a return after delivery, within `returns.window_days` from store settings
  (14 by default). The request stores its reason and emails the store; admin approval restocks and
  moves the order to `returned`.
- Payment state is provider-agnostic: `unpaid`, `paid`, `refunded`, `failed`, plus a free-text
  `payment_reference` written by the provider adapter. The mock provider writes a mock reference.
- Refunds are recorded manually until Stripe lands. `refunds` holds each amount and reason,
  `orders.refunded_minor` is the running total, and the order becomes `refunded` only when the total
  is fully refunded. A refund cannot exceed the order total.
- `order_events` is the customer-visible and admin-visible timeline. Every status transition,
  cancellation request, return, refund, and invoice writes one.
- Order confirmation mail is sent only for a paid order. Shipping mail is sent when tracking is
  recorded. Mail failures are logged and never roll back a committed order change.
- Tracking and the tax invoice are shown on the guest order page (with its lookup token) and the
  account order page. An issued invoice has both an HTML page and a generated PDF.
- `orders.invoice_number` is unique and drawn from a per-year counter: `INV-YYYY-######`. It is
  separate from the order number and is issued only on demand from the admin, so an unpaid order
  does not consume a tax-invoice sequence.
- Persian/Arabic customer names cannot be encoded by the built-in PDF fonts; the PDF route replaces
  unsupported glyphs rather than failing. Embedding a Unicode font is the later fix.

## Stock and cart notifications

- **Back-in-stock:** a sold-out variant shows a form on the product page. The request stores a
  lowercased email with its consent time and is unique per variant and email. A later restock sends
  one email per pending request and marks it notified. Signed-in requests use the account email.
- **Low stock:** `processStockChanges` runs after checkout, admin stock edits, cancellation, and
  return restock. For each affected variant it compares stock with the per-variant override or the
  store threshold, sends one admin email per crossing, and deletes the open row when stock rises
  above the threshold. A failed send deletes the row so the next run can retry.
- **Abandoned carts:** signed-in only, marketing consent required, at least one item, no activity
  for `cart.abandoned_hours` (4 by default), not expired, and not already emailed. Activity is the
  later of the cart and its newest item timestamp.
- With no scheduler yet, `/admin` exposes a manual "Send abandoned-cart emails" and "Check low stock
  now" action and shows pending back-in-stock and eligible-cart counts. The services are the seam a
  cron job will call later.
- Mail still goes through the console driver; every message is a plain-text body built in the
  service. Real delivery is deferred to the deploy-ready phase.

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

1. Network: Caddy basic auth, required in the production compose; Tailscale/IP allowlist is later.
2. Session: a valid session bound to a `role = admin` user. Admin sessions are capped at 8 hours
   by the guard even though customer sessions last 30 days.
3. Factor: TOTP verified for this session in production. `ADMIN_REQUIRE_TWO_FACTOR=false` is a
   local-development override only; it must never be false on the deployed store.
4. Action: the individual action re-checks the role, not just the page.

The panel lists customers, orders (read-only for now), reviews, products, taxonomy, promotions,
homepage sections, pages, and settings. Every admin mutation writes an `audit_log` entry, except
some older product/media/variant mutations that still need to be brought into coverage.

The panel also lists customers: name, email, phone, order count, spend, and last order, with a
detail page for saved addresses and order history. Customers never reach this host.

The product editor defines levels and values, then builds the variant tree. The tree is a compact
table: groups expand inline, the selected branch opens in a side inspector, and a single “Add
branches” form creates only the ticked values. Nothing is generated from a Cartesian product.

The admin also manages promotion pages: image, headline, CTA, slug, schedule, order, and active
state, plus ordered category, collection, and hand-picked product rows, with an audit entry for
every change.

A no-code boundary is intentional: admin edits `settings` and content rows, never code. Anything
that would require a deploy belongs in this repo, not in the admin UI.

## Media

Uploads are validated by decoding with `sharp` (not by filename or MIME header), capped at 10 MB,
rotated, resized to fit within 1600 px, stripped of metadata, and re-encoded as a single WebP at
quality 82. Output lands at `/data/uploads/<yyyy>/<mm>/<uuid>.webp`.

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
outside the repository with `600` permissions. The runtime entrypoint runs Drizzle migrations before
starting the standalone server, and the uploads directory is pinned to the shared `/data/uploads`
volume.

Operationally:

- `/api/health` checks a `select 1` against Postgres and returns 503 when the database is
  unreachable. Docker uses that endpoint.
- Security headers are set by Next (`nosniff`, frame denial, referrer policy, permissions policy);
  Caddy adds HSTS and removes the server header.
- Public mutations use hashed, database-backed fixed-window rate limits. Better Auth rate limiting
  remains enabled in production and is disabled only in the Playwright server.
- Admin access is protected by Caddy basic auth plus app session + TOTP. The admin session guard
  caps a session at 8 hours.
- Nightly backups, off-host copies, restore drills, structured logs, error tracking, and uptime/TLS
  monitoring are still Phase 8 work. They are not implemented yet.

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
