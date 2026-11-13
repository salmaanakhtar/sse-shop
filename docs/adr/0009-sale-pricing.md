# Sale prices are a variant field, not a rewritten list price

A sale stores a lower `sale_price_minor` and an optional window on the variant. The list price stays
untouched, and every read computes the effective price from both.

## Context

A store needs temporary discounts without destroying the regular price. Overwriting `price_minor`
would lose the original the shopper is meant to compare against, and reverting an expired sale
would require a second write or a job. The cart and checkout must charge exactly what the product
page shows, including VAT-inclusive totals.

## Decision

- `variants.sale_price_minor`, `variants.sale_starts_at`, and `variants.sale_ends_at` hold the sale.
  The list price remains `price_minor`.
- The sale is active when the price is below the list price and `now` is inside the window. Missing
  bounds are open-ended. An expired sale falls back to the list price with no job.
- A pure helper in `src/lib/sale.ts` returns the active price; catalog, product picker, cart, and
  checkout all use it. This is the single pricing seam.
- Admin times are authored in Asia/Dubai (UTC+4) and stored as instants. `datetime-local` is parsed
  with a fixed +04:00 offset.
- Sale edits validate that the sale price is below the current list price and write an `audit_log`
  entry. A regular-price edit that would drop to or below the existing sale price is refused with a
  readable message.
- `order_items.unit_price_minor` snapshots the effective price paid, so later price or sale changes
  never rewrite an order.
- The storefront shows the sale price, struck-through list price, whole-percent discount, and a
  countdown when an end exists. The countdown refreshes the server view when it reaches zero.
- Cards show a Sale badge and the effective from-price with the original crossed out when the
  cheapest variant is discounted.

## Consequences

- No price is destroyed and no scheduled job is needed to end a sale.
- The cart and checkout cannot drift from the product page because they share the helper.
- Only one sale applies per variant. Stacked product/category campaigns need a precedence rule
  before they can be added.
- A sale price equal to or above the list price is ignored, and the admin form rejects it.
- The timer is client-side; the server remains the authority on whether the sale is active.
- Future discount codes and automatic promotions will need to compose with this effective price.

## Considered options

- **Overwrite `price_minor`:** rejected. The original price is part of the shopper's comparison and
  reverting it needs another write.
- **A separate `sales` table:** deferred. One sale per variant is enough for Phase 4; category or
  campaign sales can become rows that point at variants later.
- **Store a percentage instead of a price:** rejected. The charged amount must be exact fils, and a
  percentage would add rounding and precedence questions.
- **A cron job to end sales:** rejected. The window is a read-time predicate, so expiry is exact
  without a job.
