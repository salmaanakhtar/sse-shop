# sse-shop

A single storefront selling physical goods in the UAE. This file defines the words used across the
code, the docs, and conversations. When a term is missing or contested, settle it here first.

## Shopping

**Storefront**:
The public shopping site served on the root domain.
_Avoid_: Shop, website

**Admin**:
The private back office on its own subdomain, used to run the store without a deploy.
_Avoid_: Backend, dashboard, CMS

**Product**:
A merchandised thing for sale, with one or more variants.
_Avoid_: Item, article, listing

**Variant**:
The unit that is actually priced, stocked, and bought — a specific size, colour, or pack.
_Avoid_: Option, SKU, variation

**SKU**:
The merchant's own unique code for one variant.
_Avoid_: Product code, item number

**Stock**:
The number of units of a variant available to sell right now.

**Cart**:
A server-owned basket of variants belonging to one shopper, identified by a token rather than an
account.
_Avoid_: Basket, bag

**Customer**:
A person with an account in the store.
_Avoid_: User, buyer, client, member

**Guest**:
A shopper who checks out with an email address and no account.

## Orders

**Order**:
A confirmed commitment to buy, created once at checkout and immutable afterwards except for its
status.
_Avoid_: Purchase, transaction, sale

**Order Line**:
A record of what was bought, at the price paid, snapshotted when the order was placed.
_Avoid_: Item, line item, order product

**Fulfilment**:
The work of getting a placed order to the customer: pick, pack, dispatch.
_Avoid_: Shipping, delivery, logistics

**Shipment**:
One physical dispatch belonging to an order. An order may have more than one.
_Avoid_: Delivery, package

**Refund**:
Money returned against a paid order, in whole or in part.
_Avoid_: Return, credit

## Running the store

**Settings**:
Store-wide configuration the admin changes without a deploy — name, theme, contact details,
shipping rules.
_Avoid_: Config, options, preferences

**Audit Entry**:
A record of one admin change, with the actor, the before and after values, and the time.
_Avoid_: Log, history, event

## Money

**Fils**:
The smallest unit of AED. 100 fils make one dirham.
_Avoid_: Cent, penny, subunit

**Minor amount**:
A money value stored as an integer count of fils. Every monetary column is a minor amount.
_Avoid_: Price, amount, value

**List price**:
What a variant costs before discounts or shipping.
_Avoid_: Base price, MSRP
