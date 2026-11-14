import { getTableColumns, relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "../../lib/id";

/* ─────────────────────────── helpers ─────────────────────────── */

const id = () => text("id").primaryKey().$defaultFn(uuidv7);
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

/* ─────────────────────────── enums ─────────────────────────── */

export const userRole = pgEnum("user_role", ["admin", "customer"]);
export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "fulfilled",
  "return_requested",
  "returned",
]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "paid", "refunded", "failed"]);
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const subscriberStatus = pgEnum("subscriber_status", [
  "pending",
  "subscribed",
  "unsubscribed",
]);
export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
]);
export const campaignSendStatus = pgEnum("campaign_send_status", ["queued", "sent", "failed"]);

/* ─────────────────────── auth (Better Auth) ───────────────────────
 * Key names are camelCase because the adapter resolves models by these keys;
 * column names stay snake_case.
 */

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("customer"),
  /** E.164, e.g. +971501234567. Optional; delivery addresses carry their own. */
  phone: text("phone"),
  /** en | ar; the /ar route prefix is the storefront source of truth. */
  locale: text("locale").notNull().default("en"),
  /** latin | arabic; applies to prices and dates in Arabic. */
  numeralStyle: text("numeral_style").notNull().default("latin"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true, mode: "date" }),
  /** system | light | dark; the storefront cookie overrides it per browser. */
  themePreference: text("theme_preference").notNull().default("system"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  /** Set when a customer deletes their account; the row is a tombstone for orders. */
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: id(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Required by the two-factor plugin: it tracks confirmation state and
    // backs off after repeated bad codes.
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("two_factors_user_id_idx").on(table.userId),
    index("two_factors_secret_idx").on(table.secret),
  ],
);

/* ─────────────────────────── catalog ─────────────────────────── */

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: productStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("products_status_idx").on(table.status)],
);

export const variants = pgTable(
  "variants",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    title: text("title").notNull().default("Default"),
    priceMinor: integer("price_minor").notNull(),
    compareAtMinor: integer("compare_at_minor"),
    costMinor: integer("cost_minor"),
    /** Sale price for the active window; the list price stays untouched. */
    salePriceMinor: integer("sale_price_minor"),
    saleStartsAt: timestamp("sale_starts_at", { withTimezone: true, mode: "date" }),
    saleEndsAt: timestamp("sale_ends_at", { withTimezone: true, mode: "date" }),
    stockQty: integer("stock_qty").notNull().default(0),
    weightGrams: integer("weight_grams"),
    /** Null uses the store-wide low-stock threshold from settings. */
    lowStockThreshold: integer("low_stock_threshold"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("variants_product_id_idx").on(table.productId)],
);

export const productOptions = pgTable(
  "product_options",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("product_options_product_name_uq").on(table.productId, table.name)],
);

export const productOptionValues = pgTable(
  "product_option_values",
  {
    id: id(),
    optionId: text("option_id")
      .notNull()
      .references(() => productOptions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("product_option_values_option_value_uq").on(table.optionId, table.value)],
);

/**
 * One node in a product's variant tree. A root node is a value of the first
 * level (for example Colour: Blue). Its children are values of the next level
 * (for example Size: S, M). A node with children is a group; a node without
 * children is a sellable leaf and points at a `variants` row.
 *
 * Parent nodes can carry images and default price/stock, which pre-fill the
 * child-creation form. The leaf's `variants` row owns the real SKU, price, and
 * stock. Only the branches the admin creates exist, so there is no phantom
 * "Red / L" row to deactivate.
 */
export const variantNodes = pgTable(
  "variant_nodes",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    /** Null only for a product's single default leaf. */
    optionId: text("option_id").references(() => productOptions.id, { onDelete: "cascade" }),
    optionValueId: text("option_value_id").references(() => productOptionValues.id, {
      onDelete: "cascade",
    }),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    imageKey: text("image_key"),
    imageAlt: text("image_alt").notNull().default(""),
    defaultPriceMinor: integer("default_price_minor"),
    defaultStockQty: integer("default_stock_qty"),
    variantId: text("variant_id").references(() => variants.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("variant_nodes_product_id_idx").on(table.productId),
    index("variant_nodes_parent_id_idx").on(table.parentId),
    uniqueIndex("variant_nodes_variant_id_uq").on(table.variantId),
    uniqueIndex("variant_nodes_root_uq")
      .on(table.productId, table.optionId, table.optionValueId)
      .where(sql`${table.parentId} is null`),
    uniqueIndex("variant_nodes_default_uq")
      .on(table.productId)
      .where(sql`${table.parentId} is null and ${table.optionId} is null`),
    uniqueIndex("variant_nodes_child_uq")
      .on(table.parentId, table.optionValueId)
      .where(sql`${table.parentId} is not null`),
    foreignKey({
      name: "variant_nodes_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
  ],
);

export const productMedia = pgTable(
  "product_media",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("product_media_product_id_idx").on(table.productId)],
);

/** One review per customer per product, linked to a paid order item. */
export const productReviews = pgTable(
  "product_reviews",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("product_reviews_product_user_uq").on(table.productId, table.userId),
    index("product_reviews_product_status_idx").on(table.productId, table.status),
    index("product_reviews_status_created_idx").on(table.status, table.createdAt),
  ],
);

/* ─────────────────────────── customer addresses ─────────────────────────── */

/**
 * A customer's reusable address book. Delivery and billing can share a row;
 * one default of each kind is enforced by partial unique indexes. Orders still
 * snapshot the chosen address, so editing or deleting a saved row never changes
 * an order's delivery record.
 */
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    emirate: text("emirate").notNull(),
    street: text("street").notNull(),
    building: text("building").notNull(),
    area: text("area").notNull().default(""),
    poBox: text("po_box").notNull().default(""),
    notes: text("notes").notNull().default(""),
    isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
    isDefaultBilling: boolean("is_default_billing").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("customer_addresses_user_id_idx").on(table.userId),
    uniqueIndex("customer_addresses_default_shipping_uq")
      .on(table.userId)
      .where(sql`${table.isDefaultShipping}`),
    uniqueIndex("customer_addresses_default_billing_uq")
      .on(table.userId)
      .where(sql`${table.isDefaultBilling}`),
  ],
);

/* ─────────────────────────── wishlists ─────────────────────────── */

/**
 * Every customer owns one default list named "Saved"; extra lists are optional.
 * The partial unique index keeps exactly one default per customer.
 */
export const wishlists = pgTable(
  "wishlists",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("wishlists_user_id_idx").on(table.userId),
    uniqueIndex("wishlists_default_uq").on(table.userId).where(sql`${table.isDefault}`),
    uniqueIndex("wishlists_user_name_uq").on(table.userId, table.name),
  ],
);

/**
 * `added_price_minor` is the effective price at the moment the variant was
 * saved. It is the threshold for the one price-drop alert.
 */
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    addedPriceMinor: integer("added_price_minor").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.wishlistId, table.variantId] }),
    index("wishlist_items_variant_id_idx").on(table.variantId),
  ],
);

/**
 * One alert per customer and variant, across all named lists. The row is
 * removed only when the customer no longer has the variant in any list, so a
 * removal and re-add can alert again.
 */
export const wishlistAlerts = pgTable(
  "wishlist_alerts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.variantId] }),
    index("wishlist_alerts_variant_id_idx").on(table.variantId),
  ],
);

/* ─────────────────────── notifications ─────────────────────── */

/** A guest or customer waiting for one variant to return to stock. */
export const stockAlerts = pgTable(
  "stock_alerts",
  {
    id: id(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** Set when the alert came from a signed-in customer. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("stock_alerts_variant_email_uq").on(table.variantId, table.email),
    index("stock_alerts_pending_idx").on(table.variantId, table.notifiedAt),
  ],
);

/**
 * One open low-stock alert per variant. The row is removed when stock rises
 * above the threshold, so the next crossing sends exactly one more email.
 */
export const lowStockAlerts = pgTable(
  "low_stock_alerts",
  {
    id: id(),
    variantId: text("variant_id")
      .notNull()
      .unique()
      .references(() => variants.id, { onDelete: "cascade" }),
    stockQty: integer("stock_qty").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("low_stock_alerts_created_at_idx").on(table.createdAt)],
);

/* ─────────────────────── marketing ─────────────────────── */

/**
 * Newsletter subscribers, including guests. `pending` means double opt-in has
 * not been confirmed yet; only `subscribed` rows receive campaigns.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: id(),
    email: text("email").notNull().unique(),
    name: text("name").notNull().default(""),
    status: subscriberStatus("status").notNull().default("pending"),
    source: text("source").notNull().default("newsletter"),
    confirmTokenHash: text("confirm_token_hash"),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "date" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("subscribers_status_idx").on(table.status)],
);

/** Hard block for unsubscribed, bounced, or manually suppressed addresses. */
export const emailSuppressions = pgTable("email_suppressions", {
  email: text("email").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    subject: text("subject").notNull(),
    body: text("body").notNull().default(""),
    status: campaignStatus("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    recipientCount: integer("recipient_count").notNull().default(0),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("campaigns_status_scheduled_idx").on(table.status, table.scheduledAt)],
);

/** The campaign outbox: one row per recipient, unique per campaign. */
export const campaignSends = pgTable(
  "campaign_sends",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id").references(() => subscribers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: campaignSendStatus("status").notNull().default("queued"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("campaign_sends_campaign_email_uq").on(table.campaignId, table.email),
    index("campaign_sends_campaign_idx").on(table.campaignId, table.status),
  ],
);

/* ─────────────────────────── carts ─────────────────────────── */

export const carts = pgTable(
  "carts",
  {
    id: id(),
    /** SHA-256 of the cookie token. The raw token never touches the database. */
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    currency: text("currency").notNull().default("AED"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("carts_user_id_idx").on(table.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("cart_items_cart_variant_uq").on(table.cartId, table.variantId)],
);

/** One recovery email per signed-in cart; the unique cart id enforces it. */
export const abandonedCartEmails = pgTable("abandoned_cart_emails", {
  id: id(),
  cartId: text("cart_id")
    .notNull()
    .unique()
    .references(() => carts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  createdAt: createdAt(),
});

/* ─────────────────────────── orders ─────────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull().unique(),
    /** SHA-256 of the signed lookup token; the raw token only ever lives in the link. */
    lookupTokenHash: text("lookup_token_hash").notNull(),
    /** Guests lose access after this moment; accounts make the link redundant. */
    lookupExpiresAt: timestamp("lookup_expires_at", { withTimezone: true, mode: "date" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    paymentReference: text("payment_reference"),
    currency: text("currency").notNull().default("AED"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    shippingMinor: integer("shipping_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    taxRateBp: integer("tax_rate_bp").notNull().default(500),
    totalMinor: integer("total_minor").notNull(),
    refundedMinor: integer("refunded_minor").notNull().default(0),
    trackingCarrier: text("tracking_carrier"),
    trackingNumber: text("tracking_number"),
    adminNotes: text("admin_notes"),
    invoiceNumber: text("invoice_number").unique(),
    invoiceIssuedAt: timestamp("invoice_issued_at", { withTimezone: true, mode: "date" }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true, mode: "date" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    cancellationRequestedAt: timestamp("cancellation_requested_at", {
      withTimezone: true,
      mode: "date",
    }),
    cancellationReason: text("cancellation_reason"),
    returnRequestedAt: timestamp("return_requested_at", { withTimezone: true, mode: "date" }),
    returnReceivedAt: timestamp("return_received_at", { withTimezone: true, mode: "date" }),
    returnReason: text("return_reason"),
    shippingAddress: jsonb("shipping_address").notNull(),
    /** Nullable: guest checkout collects a billing address too, but older orders have none. */
    billingAddress: jsonb("billing_address"),
    notes: text("notes"),
    placedAt: timestamp("placed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_email_idx").on(table.email),
    index("orders_placed_at_idx").on(table.placedAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Nullable: a variant may be deleted later, the order must survive. */
    variantId: text("variant_id").references(() => variants.id, { onDelete: "set null" }),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull().default(""),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("order_events_order_id_idx").on(table.orderId, table.createdAt)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    reason: text("reason").notNull().default(""),
    providerReference: text("provider_reference"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("refunds_order_id_idx").on(table.orderId)],
);

/* ─────────────────────── operations ─────────────────────── */

export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    headline: text("headline").notNull().default(""),
    subheadline: text("subheadline").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default("Shop now"),
    imageKey: text("image_key").notNull(),
    imageAlt: text("image_alt").notNull().default(""),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("promotions_active_position_idx").on(table.active, table.position)],
);

/* ─────────────────────── taxonomy and merchandising ─────────────────────── */

export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("categories_parent_id_idx").on(table.parentId),
    foreignKey({
      name: "categories_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("product_categories_category_id_idx").on(table.categoryId),
  ],
);

export const collections = pgTable("collections", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("collection_products_product_id_idx").on(table.productId),
  ],
);

export const badges = pgTable("badges", {
  id: id(),
  label: text("label").notNull().unique(),
  /** brand | neutral | success | warning; validated by the admin action. */
  tone: text("tone").notNull().default("brand"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productBadges = pgTable(
  "product_badges",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.badgeId] }),
    index("product_badges_badge_id_idx").on(table.badgeId),
  ],
);

/* ─────────────────────── promotion pages ─────────────────────── */

/**
 * A promotion page is the carousel slide itself. Rows are ordered sections:
 * a collection, a category (including descendants), or hand-picked products.
 * The partial unique indexes reject adding the same category or collection
 * twice to one page; products may repeat across different rows.
 */
export const promotionRows = pgTable(
  "promotion_rows",
  {
    id: id(),
    promotionId: text("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    /** category | collection | products; validated by the admin action. */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("promotion_rows_promotion_id_idx").on(table.promotionId),
    index("promotion_rows_category_id_idx").on(table.categoryId),
    index("promotion_rows_collection_id_idx").on(table.collectionId),
    uniqueIndex("promotion_rows_category_uq")
      .on(table.promotionId, table.categoryId)
      .where(sql`${table.kind} = 'category' and ${table.categoryId} is not null`),
    uniqueIndex("promotion_rows_collection_uq")
      .on(table.promotionId, table.collectionId)
      .where(sql`${table.kind} = 'collection' and ${table.collectionId} is not null`),
  ],
);

export const promotionRowProducts = pgTable(
  "promotion_row_products",
  {
    rowId: text("row_id")
      .notNull()
      .references(() => promotionRows.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.rowId, table.productId] }),
    index("promotion_row_products_product_id_idx").on(table.productId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entity, table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/* ─────────────────────── storefront content ─────────────────────── */

/**
 * Ordered homepage sections. The config is validated per kind by the service;
 * collection/category ids live in JSON so the composer can be extended without
 * a migration for every new section type.
 */
export const homeSections = pgTable(
  "home_sections",
  {
    id: id(),
    kind: text("kind").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    config: jsonb("config").notNull().default({}),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("home_sections_active_position_idx").on(table.active, table.position)],
);

/**
 * Admin-editable content pages such as Privacy, Terms, Shipping, Returns, and
 * Contact. Body is trusted admin HTML; it is never rendered from customer input.
 */
export const pages = pgTable(
  "pages",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    published: boolean("published").notNull().default(false),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("pages_published_idx").on(table.published)],
);

/**
 * Monotonic counters. Order numbers come from here rather than a sequence so
 * the value is transactional and the schema stays declarative.
 */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  updatedAt: updatedAt(),
});

/* ─────────────────────────── shipping ─────────────────────────── */

/** One zone per emirate. The zone owns the free-delivery threshold. */
export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: id(),
    emirate: text("emirate").notNull().unique(),
    name: text("name").notNull().default(""),
    freeThresholdMinor: integer("free_threshold_minor").notNull().default(20_000),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("shipping_zones_active_idx").on(table.active, table.position)],
);

/**
 * Weight bands inside a zone. `maxWeightGrams` is inclusive; null means the
 * band is open-ended. The admin keeps bands non-overlapping and contiguous.
 */
export const shippingBands = pgTable(
  "shipping_bands",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),
    minWeightGrams: integer("min_weight_grams").notNull(),
    maxWeightGrams: integer("max_weight_grams"),
    rateMinor: integer("rate_minor").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("shipping_bands_zone_idx").on(table.zoneId, table.minWeightGrams)],
);

/**
 * Fixed-window counters for public mutations. A database-backed limiter keeps
 * a single VPS restart from resetting abuse protection.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("rate_limits_expires_at_idx").on(table.expiresAt)],
);

/* ─────────────────────────── relations ─────────────────────────── */

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
  options: many(productOptions),
  media: many(productMedia),
  variantNodes: many(variantNodes),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  node: one(variantNodes, {
    fields: [variants.id],
    references: [variantNodes.variantId],
  }),
}));

export const productOptionsRelations = relations(productOptions, ({ one, many }) => ({
  product: one(products, { fields: [productOptions.productId], references: [products.id] }),
  values: many(productOptionValues),
}));

export const productOptionValuesRelations = relations(productOptionValues, ({ one }) => ({
  option: one(productOptions, {
    fields: [productOptionValues.optionId],
    references: [productOptions.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(variants, { fields: [cartItems.variantId], references: [variants.id] }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  user: one(users, { fields: [customerAddresses.userId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

/** Column sets, useful for snapshots written to the audit log. */
export const auditColumns = {
  products: getTableColumns(products),
  variants: getTableColumns(variants),
};

export const nowSql = sql`now()`;
