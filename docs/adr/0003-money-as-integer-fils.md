# Money is an integer count of fils

Every monetary value is stored and computed as an integer number of fils, the smallest unit of AED
(1 AED = 100 fils).

Floating point cannot represent 0.1 exactly, and currency bugs from accumulated rounding are both
silent and expensive. Integers make every sum exact and every stored total reproducible. Formatting
happens once, at the edge, with `Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`.

## Consequences

- Column names carry the unit: `price_minor`, `total_minor`, `shipping_minor`.
- Division exists only when splitting a discount across lines, and it distributes remainders
  deterministically rather than rounding each line independently.
- A percentage is stored in basis points (`tax_rate_bp = 500` for 5%) so tax math stays integer.
- Admin input is parsed from a string like `"240.00"` into `24000` by one function in `src/lib/money.ts`,
  which is the only place that conversion is allowed to happen.
