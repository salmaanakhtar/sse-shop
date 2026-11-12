# The cart lives on the server

A cart is a database row addressed by an httpOnly cookie token. The browser never holds prices,
totals, or the list of what is in the basket.

The conventional approach keeps the cart in `localStorage` and posts it at checkout. That makes the
client the authority on what the basket contains and what it costs, so every checkout then needs
defensive revalidation anyway — at which point the client-side cart has bought nothing but a second
code path and a set of price-tampering bugs. A server cart means one source of truth from "add to
cart" through "place order", and stock can be checked against the same row the order will lock.

The cost is a database read per cart interaction and a cookie for anonymous visitors. Both are
cheap, and the cookie is `httpOnly`, `SameSite=Lax`, and expires after 30 days.

## Consequences

- Carts outlive a cleared browser only if the shopper has an account; anonymous carts are tied to
  the cookie and expire.
- A missing or tampered cart token produces a new empty cart, never an error page.
- Cart contents are revalidated on every read, so a variant that was archived or sold out cannot be
  checked out from a stale page.
