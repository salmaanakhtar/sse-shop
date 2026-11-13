import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  accounts,
  auditLog,
  carts,
  customerAddresses,
  orders,
  sessions,
  twoFactors,
  users,
  verifications,
} from "../db/schema";
import { listAddresses } from "./addresses";
import { getCustomerOrderStats, listOrdersForCustomer } from "./orders";

export type AdminCustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: Date | string | null;
};

export async function listCustomers(search = ""): Promise<AdminCustomerRow[]> {
  const stats = db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*)::int`.as("order_count"),
      totalSpentMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`.as(
        "total_spent_minor",
      ),
      lastOrderAt: sql<Date | string | null>`max(${orders.placedAt})`.as("last_order_at"),
    })
    .from(orders)
    .where(ne(orders.status, "cancelled"))
    .groupBy(orders.userId)
    .as("customer_order_stats");

  const filters = [eq(users.role, "customer")];
  const query = search.trim();
  if (query) {
    const pattern = `%${query}%`;
    const match = or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(users.phone, pattern),
    );
    if (match) filters.push(match);
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
      orderCount: sql<number>`coalesce(${stats.orderCount}, 0)::int`,
      totalSpentMinor: sql<number>`coalesce(${stats.totalSpentMinor}, 0)::int`,
      lastOrderAt: stats.lastOrderAt,
    })
    .from(users)
    .leftJoin(stats, eq(stats.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(users.createdAt))
    .limit(100);
}

export async function getCustomerForAdmin(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "customer")))
    .limit(1);

  if (!user) return null;

  const [addresses, customerOrders, stats] = await Promise.all([
    listAddresses(id),
    listOrdersForCustomer(id),
    getCustomerOrderStats(id),
  ]);

  return { user, addresses, orders: customerOrders, stats };
}

/**
 * Anonymises the account and drops credentials, sessions, carts, and saved
 * addresses. Orders stay linked to the tombstone row so financial records and
 * order history remain intact for the store.
 */
export async function anonymizeCustomer(
  userId: string,
  actorUserId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.deletedAt) return false;

    const before = { name: user.name, email: user.email, phone: user.phone };

    await tx.delete(customerAddresses).where(eq(customerAddresses.userId, userId));
    await tx.delete(carts).where(eq(carts.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(twoFactors).where(eq(twoFactors.userId, userId));
    await tx.delete(verifications).where(eq(verifications.identifier, user.email));

    await tx
      .update(users)
      .set({
        name: "Deleted customer",
        email: `deleted+${userId}@deleted.invalid`,
        emailVerified: false,
        image: null,
        phone: null,
        twoFactorEnabled: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "customer.delete",
      entity: "users",
      entityId: userId,
      before,
      after: { deleted: true },
    });

    return true;
  });
}
