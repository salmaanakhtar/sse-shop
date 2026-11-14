# Manual QA checklist

Use this after the automated suite is green. It is written for a **clean database** so counts,
defaults, and seeded products are predictable.

## 1. Start a clean environment

The repository has already been migrated and seeded into a separate manual QA database. Your normal
development database is untouched.

```powershell
$env:DATABASE_URL = "postgres://sse_shop:sse_shop@localhost:5433/sse_shop_manual"
pnpm dev
```

- Storefront: <http://localhost:3000>
- Admin: <http://localhost:3000/admin/sign-in>
- Admin account: `admin@admin.com` / `change-this-admin-password`
- Local 2FA is off (`ADMIN_REQUIRE_TWO_FACTOR=false`).
- Payments are the mock provider; an order is paid immediately.
- Email is the console driver. Every message appears in the terminal running `pnpm dev` between
  `──── mail ────` markers. Keep that terminal visible.
- Uploaded product images are written under `UPLOADS_DIR` from `.env.local`.

If you need to reset during the walkthrough:

```powershell
$env:DATABASE_URL = "postgres://sse_shop:sse_shop@localhost:5433/sse_shop_manual"
pnpm db:migrate
pnpm db:seed
```

The seed is safe to re-run, but it does not delete orders, customers, campaigns, or admin-created
content. For a truly fresh run, drop and recreate `sse_shop_manual`, then migrate and seed.

## 2. Automated result being signed off

| Check | Result |
| --- | --- |
| Migrations from an empty database | Pass |
| Seed | Pass |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| Vitest unit + integration | 26 files, 154 tests, pass |
| Playwright journeys | 27, pass on a pristine database and on repeat runs |
| Admin TOTP-required enrolment + admin suite | 8 targeted tests, pass with `ADMIN_REQUIRE_TWO_FACTOR=true` |
| Production `next build` with no database reachable | Pass |
| Docker image build | Pass |
| Container boot, startup migrations, health, home, admin sign-in, sitemap | Pass |
| `pnpm audit --audit-level=high` | Pass (no high/critical; two moderate dev-tool advisories) |

Known non-blocking advisory: `esbuild <= 0.24.2` inside `drizzle-kit` (dev/CLI only) and
`minimatch < 11` inside ESLint tooling. Neither is part of the production server runtime.

---

## 3. Customer features

### Discovery and navigation

- [ ] **C01 Home renders** — hero, Featured row, Daily Offers row, All products grid, footer.
- [ ] **C02 Home section types** — after admin creates each type: promotions carousel, collection
      row, category row, text block, hand-picked products, all-products.
- [ ] **C03 Announcement bar** — enable in Settings; appears above the header, link works; disable
      removes it.
- [ ] **C04 Header navigation** — logo returns home; category links work; parent with children shows
      a dropdown; account/sign-in and cart links work; cart badge shows item count.
- [ ] **C05 Search box** — header search submits to `/search?q=...`.
- [ ] **C06 Footer** — published legal pages, newsletter, contact email, address, TRN, VAT copy,
      free-delivery threshold.
- [ ] **C07 404** — an unknown path returns the 404 page, not a stack trace.

### Search, filters, SEO

- [ ] **C08 Text search** — search `tee`; Essential Tee appears. Search nonsense; empty state.
- [ ] **C09 Category filter** — filter to a category; only that category’s products appear.
- [ ] **C10 Price filter** — min/max narrows results; min above max shows a readable error.
- [ ] **C11 In-stock filter** — hides sold-out products.
- [ ] **C12 Sort** — newest, price low→high, price high→low, name; order changes accordingly.
- [ ] **C13 Pagination** — with enough products, next/previous preserves other filters.
- [ ] **C14 Product metadata** — title, description, canonical, Arabic alternate, Open Graph.
- [ ] **C15 JSON-LD** — product page has one `application/ld+json` Product script with AED price and
      availability.
- [ ] **C16 `/sitemap.xml`** — home, products, categories, collections, promotions, pages, Arabic
      URLs.
- [ ] **C17 `/robots.txt`** — disallows admin/account/cart/checkout/orders/search/api and names the
      sitemap.

### Category, collection, promotion, content pages

- [ ] **C18 Category page** — breadcrumb, description, product count, child-category chips, products.
- [ ] **C19 Collection page** — breadcrumb, description, count, products in curated order.
- [ ] **C20 Promotion carousel** — arrows and dots move between slides; a slide opens its promotion
      page. (The seed has no promotion; create one in admin first.)
- [ ] **C21 Promotion page** — hero image/headline/SO, category row, collection row, hand-picked row.
- [ ] **C22 Legal/content page** — `/pages/privacy` renders admin HTML and updated date.
- [ ] **C23 Draft content page** — unpublished page returns 404 and is absent from the footer.

### Product detail

- [ ] **C24 Variant tree** — selecting Colour updates available sizes; selecting Size updates price,
      stock, and selected label. A nonexistent path is not offered.
- [ ] **C25 Sale price** — discounted price, struck-through original, percentage, countdown; cart
      uses the sale price.
- [ ] **C26 Stock states** — in-stock shows count and enables Add to cart; zero stock shows Sold out
      and disables it.
- [ ] **C27 Add to cart** — success message, header badge increments, cart contents correct.
- [ ] **C28 Images** — product image and variant image render; no-image placeholder otherwise.
- [ ] **C29 Reviews** — approved reviews and average rating appear; sold-out/pending rules below.
- [ ] **C30 Related products** — row excludes the current product.
- [ ] **C31 Back-in-stock form** — only shown when the selected variant is sold out; consent is
      required; submit stores the request.
- [ ] **C32 VAT label** — “VAT included” copy is present.

### Cart

- [ ] **C33 Empty cart** — empty state with a browse link.
- [ ] **C34 Persistence** — add an item, reload, close/reopen the tab; cart survives.
- [ ] **C35 Quantity** — plus/minus works; quantity is capped by stock; above stock is refused with a
      readable message.
- [ ] **C36 Remove** — removes the line; totals and badge update.
- [ ] **C37 Totals** — subtotal, delivery, total, VAT component reconcile.
- [ ] **C38 Sale lines** — sale unit price and struck-through original line total.
- [ ] **C39 Checkout block** — unavailable lines stay visible but cannot proceed; removing the last
      blocked line unblocks checkout.
- [ ] **C40 Cart merge** — guest cart merges into the account on sign-in with quantities capped by
      stock.

### Checkout

- [ ] **C41 Guest checkout** — email, name, mobile (`+971` + 9 digits), emirate, building, street,
      optional area/PO box/notes.
- [ ] **C42 Validation** — missing required fields, bad email, bad mobile are rejected with readable
      messages.
- [ ] **C43 Shipping quote** — change emirate; delivery, total, and VAT update before submission.
- [ ] **C44 Free delivery** — below the zone threshold pays delivery; at/above it pays zero.
- [ ] **C45 Billing** — “same as delivery” checked by default; unchecking reveals billing fields and
      validates them.
- [ ] **C46 Saved addresses** — signed-in checkout pre-fills defaults and can save new delivery and
      billing addresses.
- [ ] **C47 Place order** — redirects to the guest order page with a token; cart is emptied and the
      badge clears.
- [ ] **C48 Stale total** — change cart/stock in another tab after opening checkout; placing the old
      total is refused with a prices-changed message.
- [ ] **C49 Mock payment** — order becomes confirmed/paid without card details.
- [ ] **C50 Order email** — terminal shows the confirmation email only for a paid order.
- [ ] **C51 Stock decrement** — product stock falls by the ordered quantity.

### Orders, cancellation, returns, invoices

- [ ] **C52 Order page** — number, status, date, items, totals, VAT, delivery and billing addresses.
- [ ] **C53 Invalid lookup** — wrong/missing token returns 404; a valid token opens the order.
- [ ] **C54 Tracking** — after admin ships, guest/account page shows carrier and tracking number.
- [ ] **C55 Invoice** — after admin issues it, the order shows the invoice number, View invoice, and
      Download PDF; PDF opens and contains the line items and totals.
- [ ] **C56 Cancellation request** — before dispatch, submit a reason; success message, duplicate
      request refused, admin sees the request.
- [ ] **C57 Return request** — after delivery and inside the return window, submit a reason; success
      message; duplicate/outside-window refused.
- [ ] **C58 Return state** — return requested and returned states show the right message.
- [ ] **C59 Refund display** — after admin records a refund, the order shows the refunded amount.
- [ ] **C60 Keep-link** — after claiming, the order appears in account history.

### Authentication and account

- [ ] **C61 Sign-up** — validation, password at least 12 characters, confirmation must match.
- [ ] **C62 Sign-in/out** — session persists across reload; sign-out clears it.
- [ ] **C63 Forgot password** — current copy says reset is not available yet (deferred to deploy).
- [ ] **C64 Account overview** — order count, total spent, saved-address count, recent orders.
- [ ] **C65 Profile** — update name/phone; email is disabled with an explanation.
- [ ] **C66 Marketing consent** — toggle on creates a confirmed subscriber; toggle off unsubscribes
      and suppresses; state and date display correctly.
- [ ] **C67 Account orders** — list, statuses, open detail; guest order claim with number + token.
- [ ] **C68 Addresses** — add, edit, delete; first becomes default; delivery/billing default badges;
      deleting never changes past order addresses.
- [ ] **C69 Account deletion** — password + `DELETE` confirmation; sign-in fails afterwards; orders
      remain as tombstones; wishlists, carts, addresses, sessions, subscriber, campaign history gone.

### Wishlists

- [ ] **C70 Default list** — signed-in save creates/uses the default list.
- [ ] **C71 Named lists** — create, rename, delete (default cannot be deleted); duplicate names
      refused.
- [ ] **C72 Multi-list save** — save one variant to two lists; product button count updates.
- [ ] **C73 List page** — items, saved price, current price, stock, sale strike-through.
- [ ] **C74 Price-drop email** — lower the price in admin; exactly one email per customer/variant,
      not repeated while any list still holds it.
- [ ] **C75 Cart from wishlist** — select available items, add to cart, land on checkout.
- [ ] **C76 Unavailable items** — sold-out/unpublished items cannot be selected.

### Reviews

- [ ] **C77 Eligibility** — a customer without a paid order for the product sees the verified-only
      explanation, not the form.
- [ ] **C78 Submit** — a paid customer writes rating/title/body; review becomes pending and is not
      public yet.
- [ ] **C79 Moderation** — after admin approves, it appears with stars and updates the average; after
      reject, it disappears.
- [ ] **C80 One review** — a second submission edits the same review and returns it to pending.

### Notifications and marketing

- [ ] **C81 Back-in-stock capture** — sold-out variant, consent, success; duplicate submit does not
      create duplicates.
- [ ] **C82 Back-in-stock send** — admin restocks the variant; one email appears; pending count falls.
- [ ] **C83 Newsletter** — submit without consent is rejected; with consent shows check-inbox.
- [ ] **C84 Double opt-in** — confirmation link from console confirms; link reuse shows invalid.
- [ ] **C85 Unsubscribe** — link from a campaign unsubscribes; the address is suppressed.
- [ ] **C86 Abandoned cart** — signed-in cart with marketing consent and old activity is eligible;
      admin run sends one email; a second run sends none. To avoid waiting four hours, set
      `cart.abandoned_hours` to 1 in Settings, or update the cart and item `updated_at` values in
      the database to an older time.

### Arabic, theme, numerals, responsive

- [ ] **C87 Arabic routing** — `/ar`, `/ar/products/...`, `/ar/cart`, `/ar/account/sign-in`,
      `/ar/newsletter`; RTL layout and translated copy.
- [ ] **C88 Language switch** — Arabic → English removes `/ar`; choice persists after reload/sign-in.
- [ ] **C89 Numerals** — Arabic page toggles Latin/Arabic-Indic digits for prices and dates; choice
      persists.
- [ ] **C90 Theme** — Auto/Light/Dark; persists per browser and follows a signed-in account.
- [ ] **C91 RTL layout** — tables, badges, buttons, and form labels remain readable and aligned.
- [ ] **C92 Mobile** — 375 px wide: nav, product cards, cart, checkout, and account are usable;
      wide admin tables may scroll horizontally but must remain readable.

### Analytics

- [ ] **C93 Event tracking** — browse home and a product; no third-party network calls; a
      `/api/analytics/view` request returns 204.
- [ ] **C94 Order event** — place an order; it appears in the admin analytics count for today.

---

## 4. Admin features

### Authentication and access

- [ ] **A01 Admin sign-in** — valid credentials reach Overview; bad password is rejected.
- [ ] **A02 Customer denied** — a customer session cannot open `/admin` (404/redirect, not data).
- [ ] **A03 Two-factor** — set `ADMIN_REQUIRE_TWO_FACTOR=true`, restart, sign in, enrol an
      authenticator, confirm the code; then verify a fresh sign-in requires the code. Reset by
      setting the flag back to `false` and clearing `two_factors` / `users.two_factor_enabled` in the
      manual database.
- [ ] **A04 Session cap** — an admin session older than 8 hours is rejected with the expired message.
      To test without waiting, update `sessions.created_at` for the admin session to more than eight
      hours ago, then reload `/admin`.
- [ ] **A05 Sign-out** — clears the admin session.

### Overview and analytics

- [ ] **A06 Stats** — products, published, low stock, orders, stock alerts, abandoned carts.
- [ ] **A07 Recent orders** — latest five, links open the order detail.
- [ ] **A08 Low-stock run** — “Check low stock now” reports new alerts; repeat reports zero until a
      crossing resets.
- [ ] **A09 Abandoned-cart run** — “Send abandoned-cart emails” reports the number sent.
- [ ] **A10 Analytics ranges** — 7/30/90 days; revenue, orders, AOV, page/product views, orders/page
      views, low stock, campaign emails.
- [ ] **A11 Analytics chart** — daily revenue bars, hover titles, top products, top pages.
- [ ] **A12 Analytics correctness** — place a known order and compare revenue/order count.

### Products

- [ ] **A13 List** — title/slug, status, sale badge, variant count, stock, “from” price; link opens
      the editor.
- [ ] **A14 Create** — name, slug, description; new product is Draft with a generated slug.
- [ ] **A15 Duplicate slug** — second product with the same slug gets a unique suffix.
- [ ] **A16 Edit details** — title, slug, description, status (draft/active/archived), publish date;
      storefront URL updates.
- [ ] **A17 Images** — upload JPEG/PNG/WebP; output is WebP; >10 MB/non-image rejected; delete
      removes it; first image is the card image.
- [ ] **A18 Options** — add option, add values, reorder options, delete option/value only when safe.
- [ ] **A19 Variant branches** — add branches only from the next option level; copy children between
      parents; delete a branch and its descendants.
- [ ] **A20 Leaf variant** — create with price, stock, SKU, weight; edit all fields; SKU uniqueness
      enforced.
- [ ] **A21 Weight and threshold** — set weight grams and low-stock override; shipping quote and
      low-stock behavior follow.
- [ ] **A22 Bulk update** — select leaves, set price and/or stock; storefront and audit update.
- [ ] **A23 Sale** — set sale price/start/end, verify badge, countdown, cart price; clear the sale.
- [ ] **A24 Sale guard** — regular price cannot drop to/below an active sale price.
- [ ] **A25 Stock alerts hook** — lowering stock to the threshold sends one admin email; raising
      above resets; next crossing emails again.
- [ ] **A26 Audit** — product create/update, variant update, bulk update, and sale write entries in
      `audit_log` with before/after.

### Taxonomy and merchandising

- [ ] **A27 Categories list/create** — name, slug, parent, description, active; reorder arrows.
- [ ] **A28 Category edit/delete** — cannot parent to itself/descendant; cannot delete with children
      or assigned products.
- [ ] **A29 Category storefront** — navbar parent/child, category page, product assignment.
- [ ] **A30 Collections** — create/edit/delete, active, reorder, add/remove products, per-product
      order.
- [ ] **A31 Collection storefront** — home row (if configured) and collection page.
- [ ] **A32 Badges** — create/edit/delete, tone, position, active; assign/unassign to products; card
      and detail display.
- [ ] **A33 Promotions list** — create, edit, delete, move order, active/schedule.
- [ ] **A34 Promotion content** — image upload/replace, headline, subheadline, CTA, slug.
- [ ] **A35 Promotion rows** — add category, collection, and hand-picked product rows; rename, move,
      delete; duplicate source guard; remove hand-picked product.
- [ ] **A36 Promotion storefront** — carousel, slide page, all rows, links.
- [ ] **A37 Homepage sections** — add each kind; edit, move up/down, deactivate, delete.
- [ ] **A38 Homepage preview** — `/admin/home/preview` shows active and inactive sections with
      badges and resolved products.
- [ ] **A39 Homepage storefront** — active sections render in order; inactive do not.

### Content, reviews, orders

- [ ] **A40 Pages** — create/edit/delete, slug, body HTML, SEO title/description, published/draft.
- [ ] **A41 Page storefront** — published page renders and appears in the footer; draft 404s.
- [ ] **A42 Reviews** — All/Pending/Approved/Rejected views; approve, reject, delete; product rating
      and page update.
- [ ] **A43 Orders list** — recent orders, status/payment/email/total, link to detail.
- [ ] **A44 Order detail** — items, totals, addresses, customer link, timeline, tracking.
- [ ] **A45 Fulfilment** — Start processing → Mark shipped (carrier + tracking, customer email) →
      Mark delivered.
- [ ] **A46 Cancellation** — Cancel & restock only before dispatch; stock returns; event recorded;
      cancellation request banner shown when the customer asked.
- [ ] **A47 Returns** — approve a requested return; stock returns; status and event update.
- [ ] **A48 Refunds** — partial refund updates the running total; full refund marks payment refunded;
      over-refund refused; timeline records both.
- [ ] **A49 Invoice** — issue once; number matches `INV-YYYY-######`; View/PDF work; re-issuing keeps
      the same number.
- [ ] **A50 Customers** — search name/email/phone; detail shows stats, addresses, orders; deleted
      accounts marked.

### Shipping

- [ ] **A51 Zones** — seven emirate cards; create zone, set free threshold, activate/deactivate.
- [ ] **A52 Bands** — add band (from/to/charge), open-ended top band, edit, delete.
- [ ] **A53 Overlap guard** — overlapping range refused; adjacent ranges accepted.
- [ ] **A54 Pictures match checkout** — change a band; checkout quote for that emirate changes and
      the placed order keeps it.
- [ ] **A55 Fallback** — inactive zone or uncovered weight uses the settings flat rate/threshold.

### Campaigns and settings

- [ ] **A56 Campaign list** — subject, status, date, recipient count, subscriber total.
- [ ] **A57 Campaign create** — subject/body/schedule; body minimum and limits.
- [ ] **A58 Campaign edit** — only drafts editable.
- [ ] **A59 Send now** — confirmation dialog; one email per confirmed, non-suppressed subscriber;
      sent/failed stats; sent status.
- [ ] **A60 Schedule** — save a future time; “Process scheduled” sends only due campaigns; cancel
      schedule.
- [ ] **A61 Delete draft** — only drafts; sent campaigns cannot be deleted.
- [ ] **A62 Placeholders** — `{name}`, `{email}`, `{unsubscribe_url}` render per recipient; footer
      unsubscribe works.
- [ ] **A63 Settings identity** — store name/contact/legal name/TRN/address; footer and invoices
      update.
- [ ] **A64 Settings tax/shipping** — VAT rate/inclusive, flat fallback, free threshold; totals
      change.
- [ ] **A65 Settings operations** — return window, low-stock threshold, abandoned-cart hours; order
      and notification behavior follows.
- [ ] **A66 Settings announcement/theme** — text/link/active, brand colors, radius; storefront
      updates.
- [ ] **A67 Settings validation** — bad email, non-hex color, negative money, out-of-range numbers
      show errors and save nothing.
- [ ] **A68 Audit trail** — settings changes appear in `audit_log`; there is no audit-log admin
      screen yet.

---

## 5. End-to-end round trips

Run these in order; each one proves the features cooperate.

- [ ] **R1 Guest buy → ship → cancel request → admin cancel/restock → refund → invoice**
- [ ] **R2 Account buy → deliver → return request → admin approve/restock → refund**
- [ ] **R3 Admin product + sale + badge + collection → storefront card/detail/cart**
- [ ] **R4 Sold-out product → back-in-stock request → admin restock → console email → count clears**
- [ ] **R5 Newsletter pending → confirm from console → admin campaign → unsubscribe from console**
- [ ] **R6 Admin shipping band change → checkout quote for that emirate → placed order retains it**
- [ ] **R7 Account review after paid order → admin approve → product rating updates**
- [ ] **R8 Arabic product → cart → checkout → order page; switch numerals and language**
- [ ] **R9 Cart merge across sign-in; wishlist → cart → checkout**
- [ ] **R10 Analytics: browse → order → dashboard revenue/orders/views reflect it**

## 6. Deployment-only checks (not available in local QA)

These are intentionally deferred and should be tested on the deploy-ready environment:

- [ ] Stripe test-mode payment, declined card, replayed webhook, provider refund.
- [ ] Real SMTP/ESP delivery, verification email, password reset.
- [ ] Cron/scheduler for scheduled campaigns, abandoned carts, and time-based notifications.
- [ ] Caddy basic auth in front of the admin host.
- [ ] Tailscale/IP allowlist, admin public DNS removal.
- [ ] Nightly encrypted backups, off-host copy, restore drill.
- [ ] Error tracking, uptime/TLS monitoring, structured logs.
- [ ] Production secrets, HAProxy/Caddy TLS, uploads volume permissions.
- [ ] Load check and connection-pool sizing.

## 7. Sign-off

| Area | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Customer storefront | | | | |
| Customer account/orders | | | | |
| Admin catalog/content | | | | |
| Admin orders/shipping | | | | |
| Marketing/notifications | | | | |
| Arabic/RTL/theme | | | | |
| Mobile/accessibility | | | | |
