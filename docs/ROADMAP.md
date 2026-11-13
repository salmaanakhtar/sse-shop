# Roadmap

Sequenced so every phase leaves a working store. A phase is done when its completion criteria
hold, not when the code is written.

**Current:** Phase 2 complete. Phase 3 next. No-code control is a continuous background stream,
not a numbered phase.

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

- Keep the current model: one variant per final combination (for example 3 specs × 3 colours = 9
  variants), each with its own SKU, price, and stock.
- Admin selector improvements: ordered options, clear combination labels, and deactivating
  combinations that are not sold.
- Per-variant images, falling back to the nearest parent value and then the product gallery.
- Better variant editing at scale: bulk price/stock edits and a filter for missing images.

**Done when** a product with multiple specs and colours can be published with per-variant images,
prices, and stock, and an invalid combination cannot be bought.

## Phase 4 — Merchandising

- **Sales:** per-variant sale price with optional start/end; the lowest active price wins; show
  percentage off, original price, sale price, and a timer. Cart and checkout use the same
  server-side price.
- **Promotions:** manually managed top-of-home carousel slides with image, headline/CTA, link,
  schedule, and optional sale link; timer and arrows.
- **Categories:** a hierarchical category tree with subcategories, ordered in the navbar.
- **Collections:** manually curated rows such as Best Selling, Featured, and Daily Offers; automatic
  best-seller rules can follow.
- **Badges:** reusable card labels such as Best Seller and Powered by AMD.

**Done when** a sale, a carousel slide, a category, a collection, and a badge can each be changed
in admin and appear on the storefront without a deploy, with an audit entry.

**Out of scope:** discount codes, automatic best sellers, category-level sale campaigns, and
shareable collections.

## Phase 5 — Wishlist

- Private named wishlists per customer; account-only.
- One price-drop email per wishlisted variant after the price first falls below the price at the
  time it was added. Sale prices count. No repeat until the variant is removed and added again.
- Deduplicate the same variant across a customer's lists so one drop sends one email.
- Checkout from a wishlist and move an item into the cart.

**Done when** a price change produces exactly one email for the first qualifying drop, and the
wishlist survives sign-in on another device.

**Note:** real email delivery lands in Phase 7. Until then, alerts use the console mailer in
development.

## Phase 6 — Experience

- **Dark mode:** storefront follows the operating system by default; the customer can override and
  the choice persists. Admin stays light for now.
- **Arabic:** interface-only translation with a language toggle, RTL layout, and per-customer
  choice of Arabic-Indic or Latin numerals for prices. Product and category content stays English
  initially; admin stays English.

**Done when** both themes and both languages render correctly, prices keep the same integer value,
and a customer's choices survive a return visit.

## Phase 7 — Real money and mail

Previously Phase 2; moved behind the storefront work.

- Stripe Checkout behind the existing `PaymentProvider` interface, webhook-verified and idempotent.
- Real transactional email: order confirmation, shipping notice, verification, password reset.
- Close the account gaps deliberately deferred in Phase 2: email verification and self-service
  password reset.
- Failed and abandoned payments leave no held stock.
- Refunds recorded against the order, with an audit entry.

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

- `settings` with typed, Zod-validated keys: store name, contact details, currency label, shipping
  rules, announcement bar.
- Theme tokens: palette, radius, typography — edited in admin, stored as settings, applied as CSS
  variables. No deploy.
- Homepage composed from ordered sections (hero, featured products, category row, text block).
- Draft/publish for content, with a preview link.
- Each new configurable feature adds its admin screen and its audit entry here.

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
7. **Variant image fallback.** Confirm “nearest parent” means option value, then product, and
   whether a variant can have its own gallery.
8. **Arabic content.** When do product titles, descriptions, categories, and emails become
   bilingual?
9. **Payment provider.** Stripe is the working assumption; confirm before Phase 7.
10. **Returns.** Is there a returns window that must be stated on the storefront, and are refunds
    handled here or outside?

## Answered

- **Guest order claiming:** token-only, with both a claim button on the order page and a manual
  order-number + token form in the account. Email matching alone is never enough.
- **Addresses:** delivery and billing, one default of each, manual entry now; a map picker comes
  later.
- **Account scope:** saved addresses, order history, admin customer list, cart merge on sign-in,
  and self-service deletion. No marketing opt-in in this phase.
- **Variations:** one variant per final option combination; no per-option price modifiers and no
  nested option sets yet.
- **Variant images:** per variant, with fallback to the nearest parent value.
- **Categories, collections, badges:** three separate systems. Categories are a tree; collections
  are curated rows; badges are card labels. Manual first.
- **Sales:** per-variant sale price with a schedule; the lowest active price wins.
- **Wishlist:** private named lists; first qualifying drop sends one email, including sale prices.
- **Carousel:** manually managed slides that can link to a sale.
- **Arabic:** interface-only first, per-customer numerals, storefront only.
- **Dark mode:** customer toggle with system default; admin stays light.
- **Roadmap order:** accounts → variations/images → sales/promotions → categories/collections →
  wishlist → dark mode → Arabic → real payments/email → hardening. No-code control is continuous.
