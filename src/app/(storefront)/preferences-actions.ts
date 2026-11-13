"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuthSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { THEME_COOKIE } from "@/server/services/preferences";

const themeSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
});

export async function setThemePreferenceAction(theme: string): Promise<void> {
  const parsed = themeSchema.safeParse({ theme });
  if (!parsed.success) return;

  const session = await getAuthSession();
  if (session) {
    await db
      .update(users)
      .set({ themePreference: parsed.data.theme, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  const store = await cookies();
  store.set(THEME_COOKIE, parsed.data.theme, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_STORE_URL ?? "").startsWith("https://"),
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
