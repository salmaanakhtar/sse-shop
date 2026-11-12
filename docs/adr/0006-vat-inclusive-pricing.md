# VAT-inclusive prices, with tax stored as a component

Displayed prices and shipping already include the UAE's 5% VAT, so the tax is stored as a
*component* of the total rather than an amount added at checkout.

Retail pricing in the UAE is quoted inclusive of VAT: a product marked AED 240.00 costs the shopper
AED 240.00, of which AED 11.43 is tax. Adding tax on top at checkout would show one number and
charge another. Storing the component means the cart, the confirmation, and an invoice can all print
the same breakdown, and a future price list stays readable.

## Consequences

- `total_minor = subtotal_minor + shipping_minor - discount_minor`. Tax is never added.
- `tax_minor = round(total_minor × rate_bp / (10000 + rate_bp))`, with `rate_bp = 500`.
- The rate lives in `settings` (`tax.rate_bp`, `tax.inclusive`) so a rate change is a setting, not a
  migration. Orders snapshot the rate they were placed under.
- Discounts apply before tax extraction, so a discount reduces the VAT component along with the
  total.
- The most likely future bug is someone treating `tax_minor` as an addend. The equation is written
  in `docs/ARCHITECTURE.md` and asserted in a unit test precisely to catch that.
