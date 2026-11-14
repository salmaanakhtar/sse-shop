"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteAccountSchema, profileSchema } from "@/lib/account";
import { auth } from "@/server/auth";
import { requireUserAction } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { mergeCartOnSignIn } from "@/server/services/cart";
import { anonymizeCustomer } from "@/server/services/customers";
import { setMarketingConsent } from "@/server/services/marketing";
import {
  LOCALE_COOKIE,
  NUMERALS_COOKIE,
} from "@/server/services/preferences";

export type ProfileState = { error?: string; success?: string } | null;
export type DeleteAccountState = { error?: string } | null;

/** Called by the sign-in and sign-up forms after the session cookie exists. */
export async function setMarketingConsentAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const consent = formData.get("marketingConsent") === "on";

  await setMarketingConsent(session.user.id, consent);
  revalidatePath("/account");
  revalidatePath("/", "layout");
}

export async function mergeCartAfterSignInAction(): Promise<void> {
  const session = await requireUserAction();
  await mergeCartOnSignIn(session.user.id);

  const store = await cookies();
  const hasLocale = store.get(LOCALE_COOKIE)?.value;
  const hasNumerals = store.get(NUMERALS_COOKIE)?.value;
  if (!hasLocale || !hasNumerals) {
    const [user] = await db
      .select({ locale: users.locale, numeralStyle: users.numeralStyle })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (user) {
      if (!hasLocale) {
        store.set(LOCALE_COOKIE, user.locale, {
          path: "/",
          sameSite: "lax",
          httpOnly: true,
          secure: (process.env.NEXT_PUBLIC_STORE_URL ?? "").startsWith("https://"),
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      if (!hasNumerals) {
        store.set(NUMERALS_COOKIE, user.numeralStyle, {
          path: "/",
          sameSite: "lax",
          httpOnly: true,
          secure: (process.env.NEXT_PUBLIC_STORE_URL ?? "").startsWith("https://"),
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }
  }

  revalidatePath("/", "layout");
}

export async function signOutCustomerAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function updateProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireUserAction();

  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/account");
  revalidatePath("/", "layout");

  return { success: "Profile updated." };
}

export async function deleteAccountAction(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await requireUserAction();

  if (session.user.role === "admin") {
    return { error: "Admin accounts cannot be deleted here." };
  }

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const parsed = deleteAccountSchema.safeParse({ password, confirmation });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  if (parsed.data.confirmation !== "DELETE") return { error: "Type DELETE to confirm." };

  const verified = await auth.api
    .verifyPassword({ body: { password: parsed.data.password }, headers: await headers() })
    .catch(() => null);

  if (!verified?.status) return { error: "That password is not correct." };

  const deleted = await anonymizeCustomer(session.user.id, session.user.id);
  if (!deleted) return { error: "This account is already deleted." };

  revalidatePath("/", "layout");
  redirect("/account/sign-in?deleted=1");
}
