"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { variants } from "../db/schema";
import {
  processStockChanges,
  sendAbandonedCartEmails,
} from "../services/notifications";

export async function runAbandonedCartEmailsAction(): Promise<void> {
  await requireAdminAction();
  const result = await sendAbandonedCartEmails().catch((error) => {
    console.error("abandoned-cart run failed", error);
    return { sent: 0, eligible: 0 };
  });

  redirect(`/admin?task=abandoned&sent=${result.sent}`);
}

export async function checkLowStockAction(): Promise<void> {
  await requireAdminAction();
  const rows = await db
    .select({ id: variants.id })
    .from(variants)
    .where(eq(variants.active, true));

  const result = await processStockChanges(rows.map((row) => row.id)).catch((error) => {
    console.error("low-stock check failed", error);
    return { lowStock: 0, backInStock: 0 };
  });

  redirect(`/admin?task=low-stock&count=${result.lowStock}`);
}
