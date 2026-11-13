# Customer accounts, saved addresses, and token-only order claiming

Customer accounts are optional. A shopper can still check out as a guest, while an account adds
saved addresses, order history, and faster checkout.

## Context

Phase 1 gave guests a signed 90-day lookup link and gave the admin a product surface, but no
shopper identity. The roadmap's next phase is customer accounts. The store already has nullable
`orders.user_id` and `carts.user_id`, so the link points exist; what is missing is a safe rule for
who may see an order and how much account state we duplicate.

Two constraints shape the decision:

- There is no transactional email provider yet. Email verification and self-service password reset
  are therefore deferred to the phase that adds real mail.
- A guest order contains personal data. Auto-linking it to any account that signs up with the same
  email would let an attacker read someone else's orders.

## Decision

### Identity and profile

Keep Better Auth's `users` table as the person row and add `phone` and `deleted_at`. Do not create a
separate customer profile table for a store this size. Name, email, phone, role, and timestamps
live in `users`; credentials stay in `accounts`; sessions stay in `sessions`.

### Address book

Add `customer_addresses`, one row per saved delivery or billing address, with `is_default_shipping`
and `is_default_billing`. Partial unique indexes enforce at most one default of each kind per
customer. The first saved address becomes both defaults; later rows become a default only when the
customer marks them.

Orders do not reference saved addresses. They keep `shipping_address` and the new
`billing_address` JSONB snapshots. Editing or deleting a saved address therefore cannot rewrite an
order's delivery record.

Checkout pre-fills the account email, name, phone, and default addresses, offers to save a new
address, and collects a billing address with “same as delivery” as the default. Address entry is
manual for now; a map picker is a later layer over the same shape.

### Order history and claiming

Order history is a query on `orders.user_id`; the account never stores a copy of an order. A guest
order is claimed only with its order number and the lookup token already in the confirmation link.
The order page offers a claim button, and the account has a manual number + token form. A claim
writes an `order.claim` audit entry. An order already owned by another customer cannot be claimed.
Email matching alone is never sufficient.

### Cart merge

On sign-in, the browser's anonymous cart is attached to the customer. If the account already has a
cart, lines are merged by variant, capped at current stock, and the browser receives the token for
the surviving cart. A cart owned by a different account is expired rather than merged, so one
shopper's basket cannot leak into another's.

### Deletion

Account deletion is self-service with a password check. It removes credentials, sessions, carts,
and saved addresses, anonymises name/email/phone, and keeps the `users` row as a tombstone so
orders stay linked for accounting. Orders are not deleted.

## Consequences

- A customer can use the storefront on another device and see the same order history and saved
  addresses.
- Guest lookup links remain the only recovery path until email verification and password reset
  arrive. A lost password needs an admin or a future reset flow.
- Order contact and delivery snapshots are retained after account deletion; the retention period
  is an open question for accounting/VAT.
- The address book is per customer and user-scoped; an address id from a form is never trusted
  without the session user id.
- Marketing consent is not part of this phase. Wishlist alerts and campaigns must add an explicit
  consent rule before they send.
- The admin gains a customer list and detail view, but customers have no admin-host access.

## Considered options

- **Auto-claim guest orders by email:** rejected for now. Without verified email it is an account
  takeover vector. Revisit once verification exists, and even then make the token fallback the
  recovery path.
- **Store orders on the customer document:** rejected. It duplicates immutable records, drifts,
  and breaks the rule that an order is reproducible from its lines.
- **A separate `customer_profiles` table:** rejected as unnecessary for one small store. If the
  auth identity later needs to be shared with another product, the profile can be split out
  additively.
- **Reference saved addresses from orders:** rejected. An address edit would rewrite history.
- **Email verification now with the console mailer only:** rejected. It would pretend to verify an
  address it cannot deliver to. Verification waits for a real provider.
