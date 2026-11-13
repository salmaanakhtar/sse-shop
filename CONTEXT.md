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
A merchandised thing for sale, with zero or more variant branches.
_Avoid_: Item, article, listing

**Variant**:
The sellable leaf at the end of a branch. It is the unit that is actually priced, stocked, and
bought.
_Avoid_: Option, SKU, variation

**SKU**:
The merchant's own unique code for one variant.
_Avoid_: Product code, item number

**Level**:
A named choice dimension, such as Colour or Size. Levels are ordered; the order is the order
shoppers pick in. Stored as `product_options`.
_Avoid_: Attribute, property, dimension

**Level value**:
One choice within a level, such as Black or Large. Values are shared names; each parent branch
chooses which of them exist under it. Stored as `product_option_values`.
_Avoid_: Variant, attribute value

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

**Customer account**:
The shopper-controlled record behind a sign-in: name, email, phone, saved addresses, and
order history. Credentials live in Better Auth's account rows; the domain account is the person.
_Avoid_: Profile, user profile

**Saved address**:
A reusable delivery or billing address in a customer's address book. It is not the address on an
order: an order stores its own snapshot.
_Avoid_: Address book entry, contact

**Default delivery address**:
The saved address a signed-in checkout pre-fills for delivery. One per customer.

**Default billing address**:
The saved address a signed-in checkout pre-fills for billing. One per customer, and it may be the
same row as the default delivery address.

**Order claim**:
Attaching a guest order to a customer account with the order number and the lookup token. The
token is the proof of ownership; an email match alone is never enough.
_Avoid_: Link order, merge order

**Order history**:
The orders linked to a customer account, newest first.

## Variations

**Variation**:
The shopper-facing idea of choosing a path through the variant tree, such as Colour → Size. The
data model uses levels, branches, and leaves; "variation" is not a database term.
_Avoid_: Sub-variation as a database term

**Variant tree**:
The explicit hierarchy of branches for a product. A path exists only because the merchant created
it; there is no Cartesian product creating phantom combinations.
_Avoid_: Variant matrix, option grid

**Branch**:
One node in the variant tree: a level value under a parent, or a root. A branch with children is a
group; a branch without children is a leaf.
_Avoid_: Sub-variant as a node type

**Group**:
A branch with children. It can carry images and default price/stock, but it is not sold directly.
_Avoid_: Parent variant, bundle

**Leaf**:
A branch with no children. It owns one variant, SKU, price, and stock, and is the only sellable
node in the tree.
_Avoid_: End variant, final option

**Parent defaults**:
Default price and stock on a group, used to pre-fill and create its children. Changing them does
not rewrite leaves that already exist.
_Avoid_: Base price, inherited price

**Branch image**:
An image attached to any branch. A leaf without its own image uses the nearest ancestor branch
image, then the product gallery.
_Avoid_: Variant image only

## Merchandising

**Category**:
A hierarchical navigation grouping, such as Computer Components. A category has a parent or is a
top-level item, a slug, an active flag, and a position among its siblings. Its page includes the
products in its child categories.
_Avoid_: Tag, collection

**Subcategory**:
A child category, such as Graphics Card under Computer Components. It can be browsed on its own
and still belongs to its parent. A category cannot move under itself or one of its descendants.

**Collection**:
A group of products shown as a row or page, such as Best Selling, Featured, or Daily Offers. It
is curated by the merchant, ordered on the home page, and ordered internally per product. It does
not imply a category or a badge, and may later gain automatic rules.
_Avoid_: Tag, tab, category

**Badge**:
A small reusable label on a product card, such as Best Seller or Powered by AMD. It is not a
category or a collection. A badge has one of four tones — brand, neutral, success, warning — and
can be assigned to many products.
_Avoid_: Tag

**Sale**:
A time-boxed price for a variant. The sale price is the price charged while the window is active;
the list price remains visible as the original.
_Avoid_: Discount code, promotion

**Sale price**:
The lower price a variant is sold at while its sale window is active. It must be below the list
price and is stored on the variant, not by overwriting the list price.
_Avoid_: Discounted price, current price

**Sale window**:
The optional start and end of a sale, edited in Asia/Dubai. An empty bound means open-ended; an
expired sale automatically falls back to the list price.
_Avoid_: Campaign dates

**Promotion**:
A merchandising message at the top of the home page: an image, optional headline and subheadline,
a call to action, and an internal link. A group of promotions becomes a carousel.
_Avoid_: Banner, ad

**Promotion window**:
The optional start and end of a promotion, edited in Asia/Dubai. Empty bounds mean open-ended; an
inactive or expired promotion is not shown.
_Avoid_: Campaign dates

**Call to action**:
The button label on a promotion, such as “Shop the sale”. It links to the promotion's internal path.
_Avoid_: CTA as a database term, button text everywhere

**Carousel slide**:
One promotion in the rotating top-of-home carousel, with an image, optional headline and
subheadline, a call to action, an internal link, and a schedule.

## Wishlist

**Wishlist**:
A named, private list of variants owned by one customer.
_Avoid_: Favourites, saved items

**Wishlist alert**:
The one price-drop email sent for a wishlisted variant after its price first falls below the price
at the time it was added. Sale prices count; the alert does not repeat until the variant is
removed and added again.
_Avoid_: Price watch, notification

## Experience

**Dark mode**:
A customer-selected storefront theme that follows the operating system by default. The admin
stays light for now.
_Avoid_: Night theme

**Locale**:
The customer's chosen storefront language. The first Arabic release translates the interface
only; product content stays English initially.

**Numeral style**:
The customer's choice between Arabic-Indic digits (٠١٢٣) and Latin digits (0123) for prices.
_Avoid_: Number format

**Design language**:
The shared rules for typography, spacing, colour, radius, elevation, motion, iconography, and
component states across storefront and admin. The final roadmap phase applies it everywhere.
_Avoid_: Theme, skin, style guide as a loose collection

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

**Shipping rate**:
The flat amount charged for delivery, waived once an order reaches the free-shipping threshold.
_Avoid_: Delivery fee, postage, P&P

**Free-shipping threshold**:
The item subtotal at which shipping becomes free.
_Avoid_: Minimum order, free delivery limit

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

**VAT component**:
The part of a VAT-inclusive total that is tax. Stored for display and invoicing, never added to the
total.
_Avoid_: Tax amount, tax line
