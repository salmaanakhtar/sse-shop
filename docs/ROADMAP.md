# Roadmap

Sequenced so every phase leaves a working store. A phase is done when its completion criteria
hold, not when the code is written.

**Current:** Phase 4 and Phase 5 are complete. Phase 6 is in progress — dark mode and the Arabic
route/RTL/numeral foundation are shipped; translation QA and secondary account copy remain.
Phase 7 (money and mail), Phase 8 (hardening), and Phase 9 (full UI redesign) are still open. The
final phase is a full UI redesign of layout, theme, and design language. No-code control is a
continuous background stream, not a numbered phase.

**Completion program:** security/foundation fixes, admin settings, homepage sections, legal pages,
Arabic routing/RTL/numerals, search/filter/sort/pagination, SEO metadata/sitemap/JSON-LD, verified
reviews, related products, order operations, the payment lifecycle, manual refunds, VAT invoices,
and emirate shipping zones are in place. Back-in-stock/low-stock/abandoned-cart notifications,
marketing email, and the analytics dashboard remain.

## Phase 0 — Foundation

Docs, conventions, and an empty but green pipeline.

**Status: complete.**

- `AGENTS.md`, `CONTEXT.md`, and the docs agree with each other.
- The app scaffolds, builds, and serves a page.
- Lint, types, unit tests, end-to-end tests, and the security workflow are green.
- Six decisions are recorded in `docs/adr/`.

## Phase 1 — Walking skeleton

The smallest version that can honestly take an order.

**Status: complete.**

- Catalog, product options and variants, and a server-owned cart.
- VAT-inclusive pricing in integer fils, flat shipping with a free threshold.
- Guest checkout with a UAE address, stock decrement under a row lock, and frozen order lines.
- Mock payment, confirmation page, and a 90-day guest lookup link.
- Admin sign-in with TOTP and product management, including image upload.
- Playwright journeys cover the shopper and admin paths.

## Phase 2 — Customer accounts

**Status: complete.**

- Customer sign-up and sign-in with email and password; profile name, email, and phone.
- Saved delivery and billing addresses with one default of each; checkout pre-fills them and
  offers to save new ones.
- Billing address collected at checkout, defaulting to “same as delivery”.
- Order history for signed-in customers, plus token-only claiming for guest orders from the order
  page or a manual form.
- Anonymous cart merged into the account cart at sign-in, capped at current stock.
- Admin customer list and detail: profile, saved addresses, orders, spend.
- Self-service account deletion: credentials, sessions, carts, and addresses are removed; the
  profile is anonymised and orders remain as tombstone records.

**Deliberately deferred:** email verification, password reset, social sign-in, saved payment
methods, marketing consent, and the map address picker. Address entry is manual for now.

## Phase 3 — Catalog depth

**Status: complete.**

- Replace the Cartesian product with an explicit tree of levels, branches, groups, and leaves.
  Depth is whatever the admin configures: Colour → Size → Fit, and deeper.
- Each parent defines its own child values. Blue can have S/M/L while Red has S/M only; there is no
  phantom Red/L row.
- Tree builder: a compact expandable table, a single add-branches form, and a side inspector for
  parent defaults, images, copy, leaf SKU/price/stock, and branch deletion.
- Leaves own the real SKU, price, and stock. Parent defaults pre-fill child creation but do not
  rewrite existing leaves. SKUs are generated from the path and remain editable.
- Bulk price/stock edits across selected leaves.
- A missing-image filter over the branch table.
- Storefront selects parent first, filters to existing children, disables sold-out branches, and
  swaps the main gallery to the selected leaf or nearest-ancestor image.
- Migration backfills every existing variant into a leaf and drops the old join table.

**Done when** an asymmetric catalog (for example Blue S/M/L, Red S/M) can be built and published
without creating impossible rows, the storefront never offers a combination the admin did not
create, and the tree survives the migration.

## Phase 4 — Merchandising

**Status: complete.**

- **Sales (done):** per-variant sale price with an optional start/end in Asia/Dubai; the sale must
  be below the regular price; cart, checkout, and order snapshots use the effective price. The
  storefront shows the percentage off, original price, sale price, and a countdown. The admin sale
  change writes an audit entry.
- **Promotions (done):** manually managed top-of-home carousel slides with image, headline, CTA,
  optional schedule, active flag, ordering, and audit entries. Each slide has its own page at
  `/promotions/[slug]` with unlimited ordered rows: a category (including descendants), a
  collection in curated order, or hand-picked products. Rows have editable headings; the same
  category or collection cannot be added twice, and a hand-picked row cannot repeat a product.
  Products may appear in different rows. Rows with no visible products are hidden. The carousel
  auto-advances, pauses on hover/focus, respects reduced motion, and has arrows and dots.
- **Categories (done):** a hierarchical tree with subcategories, sibling ordering, active flags, and
  a navbar with child dropdowns. Category pages include descendant products; deletion is blocked
  while children or products remain. Every change writes an audit entry.
- **Collections (done):** manually curated rows such as Best Selling, Featured, and Daily Offers,
  with home-page order and per-product order. Inactive or empty collections are hidden. Automatic
  best-seller rules can follow.
- **Badges (done):** reusable labels such as Best Seller and Powered by AMD, with four tones,
  ordering, and per-product assignment. Active badges appear top-left on cards and on the detail
  page; the sale flag is top-right.

**Done when** a sale, a carousel slide, a category, a collection, and a badge can each be changed
in admin and appear on the storefront without a deploy, with an audit entry. All five are live.

**Out of scope:** discount codes, automatic best sellers, category-level sale campaigns, and
shareable collections.

## Phase 5 — Wishlist

**Status: complete.**

- **Lists (done):** private named wishlists per customer, account-only. Every customer has one
  default “Saved” list plus optional named lists. The product detail page saves the selected
  variant to one or more lists through a small selector; signed-out shoppers are prompted to sign
  in. Lists can be created, renamed, and deleted, except the default.
- **Price alerts (done):** one email per customer and variant when the effective price first falls
  below the highest price at which it was saved. Sale prices count. Alerts are claimed atomically,
  deduplicated across all of a customer's lists, and reset only after the variant is removed from
  every list. Checks run lazily on wishlist/product reads and after an admin price or sale change.
  Real email delivery still waits for Phase 7; the console mailer is used now.
- **Checkout (done):** the customer selects items in a list, adds them to the cart, and continues to
  checkout. Unavailable items stay visible and removable but cannot be selected.

**Done when** a price change produces exactly one email for the first qualifying drop, and the
wishlist survives sign-in on another device. Both are covered by integration and Playwright tests.

**Note:** real email delivery lands in Phase 7. Until then, alerts use the console mailer in
development.

## Phase 6 — Experience

**Status: in progress — dark mode and the Arabic route/RTL/numeral foundation are shipped;
translation QA and secondary copy remain.**

- **Dark mode (done):** the storefront follows the operating system by default. The customer can
  choose Auto, Light, or Dark; the cookie persists per browser and a signed-in preference follows
  them to another device. The palette is scoped to the storefront, so admin stays light.
- **Arabic (in progress):** `/ar` URLs with hreflang, Modern Standard Arabic for the shell, home,
  product, cart, checkout, wishlist, and auth surfaces, RTL layout, and a Latin/Arabic-Indic numeral
  toggle. Product content, category names, admin, and emails remain English. Account/order detail
  and some secondary strings still fall back to English.

**Done when** both themes and both languages render correctly, prices keep the same integer value,
and a customer's choices survive a return visit. Dark mode is complete; Arabic is not.

## Commerce completion — Order operations

**Status: complete.**

- **Lifecycle:** pending → confirmed → processing → shipped → delivered, with cancellation and the
  return states. Admin controls live at `/admin/orders/[id]`; every transition writes an order event
  and an audit entry.
- **Tracking:** carrier and tracking number, customer email on dispatch, tracking shown on both the
  guest and account order pages.
- **Cancellation:** a customer can request cancellation before dispatch; the admin cancels and
  restocks. Cancelling is refused after shipping, and the return flow takes over.
- **Returns:** a customer can request a return after delivery inside the configurable return window
  (14 days by default). Admin approval records receipt and restocks.
- **Refunds:** recorded manually against the order with a reason, capped at the order total. Full
  refund moves the payment state to `refunded`. Provider-backed refunds arrive with Stripe.
- **Invoices:** HTML and PDF tax invoices with `INV-YYYY-######` numbering from a per-year counter,
  business legal name/TRN/address settings, and invoice access by admin session or order token.
- **Payments:** the provider-agnostic state machine stores `payment_reference`; the mock provider is
  the only implementation until Phase 7.
- **Coverage:** integration tests for each transition, restock, refund cap, and invoice numbering,
  plus an admin Playwright journey through fulfillment, return approval, refund, and PDF download.

## Commerce completion — Shipping zones

**Status: complete.**

- One zone per emirate with an active flag, a per-zone free-delivery threshold, and non-overlapping
  weight bands.
- Variants carry an optional weight in grams, editable in the variant inspector and seeded for the
  demo products. A missing weight counts as zero and uses the lightest band.
- Checkout quotes all seven emirates on the server; changing the emirate updates delivery, total,
  and VAT before submission. Placement re-resolves the charge and rejects a stale expected total.
- An unconfigured, inactive, or uncovered weight falls back to the store flat rate and threshold.
- `/admin/shipping` edits thresholds, active state, and bands with overlap validation and audit
  entries.
- Unit tests cover band boundaries, open-ended bands, gaps, thresholds, and weight validation.
  Integration tests cover zone resolution, fallback, overlap rejection, and quoting all emirates.
  A Playwright journey changes a Fujairah band and checks the checkout total and placed order.

## Phase 7 — Real money and mail

Previously Phase 2; moved behind the storefront work.

- Stripe Checkout behind the existing `PaymentProvider` interface, webhook-verified and idempotent.
- Real transactional email: order confirmation, shipping notice, verification, password reset.
- Close the account gaps deliberately deferred in Phase 2: email verification and self-service
  password reset.
- Failed and abandoned payments leave no held stock.
- Provider-backed refunds; manual refund recording already exists.

**Done when** a test-mode card produces a paid order, a declined card produces a retryable order,
a replayed webhook changes nothing, and a customer can verify their email and reset a password.

## Phase 8 — Hardening

- Admin reachable only over Tailscale; public DNS record removed.
- Automated encrypted backups with a rehearsed restore.
- Error tracking and structured request logs.
- Uptime and certificate-expiry monitoring.
- Load check at 10× expected traffic.

**Done when** a restore is rehearsed, the admin is off the public internet, and the store survives
the load check.

## Continuous — No-code control

This is a background stream expanded as each feature lands, not a phase with a finish line.

- **Settings (done):** typed, Zod-validated keys for store identity, contact, legal name/TRN/address,
  tax, fallback shipping, return window, inventory threshold, abandoned-cart delay, announcement
  bar, and theme tokens. `/admin/settings` edits them with an audit entry.
- **Theme tokens (done):** brand colour, soft brand colour, and corner radius are stored as settings
  and applied to the storefront shell.
- **Homepage sections (done):** ordered hero, promotion carousel, collection, category, text,
  hand-picked products, and all-products sections, with active state and admin ordering. A preview
  workflow is still pending.
- **Content pages (done):** admin-editable Privacy, Terms, Shipping, Returns, Contact, FAQ, Cookies,
  and other pages, with published state and SEO fields.
- **Preview/draft (partial):** products, promotions, categories, collections, and pages have draft
  or active states, but there is no side-by-side preview link for homepage drafts yet.
- Each new configurable feature adds its admin screen and its audit entry here.

## Phase 9 — Full UI redesign

**Status: last.** Deliberately after every feature exists.

- A single design language for storefront and admin: typography, spacing, colour, radius, elevation,
  motion, iconography, and component states.
- Layout and information architecture review: navigation, page composition, tables, forms, filters,
  empty/loading/error states, and mobile behaviour.
- Apply the theme tokens from the continuous no-code stream and the dark-mode/RTL work from Phase 6
  consistently across every screen.
- Replace one-off styling and inconsistent primitives; no screen keeps a legacy layout.
- Accessibility pass: focus order, contrast, keyboard use, labels, and reduced motion.

**Done when** every storefront and admin screen shares one documented design language, the same
primitives, and an accessibility pass, with no legacy screen left behind.

Until this phase, new features use the existing `src/components/ui` primitives and Tailwind tokens;
they do not pre-build a parallel design system.

## Open questions

These shape upcoming work. Answers land in `CONTEXT.md`, an ADR, or this file.

1. **Email provider.** Which provider and sending domain, and is there a warm-up period? This now
   blocks verification, password reset, and wishlist alerts.
2. **Map provider.** The address book is manual for now. Google Places, Mapbox, or
   Leaflet/OpenStreetMap, and do we have an API key?
3. **Account deletion retention.** How long are order contact and delivery snapshots kept for VAT
   and accounting after a profile is anonymised?
4. **Marketing consent.** Accounts shipped without an opt-in. Wishlist alerts and campaigns need a
   consent rule before they send.
5. **Category structure.** One parent per category, and can a product belong to more than one
   category? Navbar ordering and SEO URLs need an answer.
6. **Collection automation.** Best Selling stays manual until the order volume justifies a rule.
   Which other collections should become automatic?
7. **Arabic content.** When do product titles, descriptions, categories, and emails become
   bilingual?
8. **Payment provider.** Stripe is the working assumption; confirm before Phase 7.
9. **Returns.** Is there a returns window that must be stated on the storefront, and are refunds
   handled here or outside?

## Answered

- **Guest order claiming:** token-only, with both a claim button on the order page and a manual
  order-number + token form in the account. Email matching alone is never enough.
- **Addresses:** delivery and billing, one default of each, manual entry now; a map picker comes
  later.
- **Account scope:** saved addresses, order history, admin customer list, cart merge on sign-in,
  and self-service deletion. No marketing opt-in in this phase.
- **Variations:** an explicit variant tree with configurable depth, per-parent child sets, copy,
  parent defaults and images, and one sellable leaf variant per created path. No Cartesian product
  and no per-option price modifiers.
- **Variant images:** branch images with nearest-ancestor fallback, then the product gallery. The
  picker shows the selected image; swapping the large gallery is the remaining polish.
- **Categories, collections, badges:** three separate systems. Categories are a tree; collections
  are curated rows; badges are card labels. Manual first.
- **Sales:** per-variant sale price with an Asia/Dubai schedule; the effective price is the lower
  active price, used by the storefront, cart, checkout, and order snapshot, with a countdown and an
  audit entry.
- **Wishlist:** private named lists with one default “Saved” list; the product detail page saves the
  selected variant to one or more lists. One alert per customer and variant, using the highest saved
  price across lists, with an atomic claim row and lazy checks. Selected items add to the cart, then
  checkout.
- **Carousel:** manually managed slides with image, headline, CTA, schedule, active flag, and
  ordering. Each slide is also a promotion page with ordered category, collection, and hand-picked
  product rows. Duplicate category/collection rows are blocked; products may repeat across rows. It
  auto-advances, pauses on hover/focus, and has arrows and dots.
- **Arabic:** interface-only first, per-customer numerals, storefront only.
- **Dark mode:** Auto, Light, or Dark with system default; cookie for guests and account persistence
  for signed-in customers; storefront only.
- **Roadmap order:** accounts → variations/images → sales/promotions → categories/collections →
  wishlist → dark mode → Arabic → real payments/email → hardening → full UI redesign. No-code control
  is continuous.
