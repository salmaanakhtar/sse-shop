import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { env } from "@/lib/env";
import { db, schema } from "../db/client";

/**
 * Authorization is enforced by helpers in `./guard`, not by Better Auth's
 * configuration alone. This file establishes identity; it does not decide what
 * an identity may do.
 */

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * The admin runs on its own host, so it is a different origin from the
 * storefront. Better Auth rejects any origin it was not told about, which is
 * exactly what happened before this list existed.
 */
function trustedOrigins(): string[] {
  const base = originOf(env.BETTER_AUTH_URL);
  const store = originOf(env.NEXT_PUBLIC_STORE_URL);

  let admin: string | null = null;
  try {
    const port = new URL(env.BETTER_AUTH_URL).port;
    admin = `http://${env.ADMIN_HOST}${port ? `:${port}` : ""}`;
  } catch {
    admin = null;
  }

  const extra = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...new Set([base, store, admin, ...extra].filter((value): value is string => Boolean(value)))];
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: trustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        // Users cannot choose their own role; only the seed and admin UI set it.
        input: false,
      },
    },
  },
  plugins: [twoFactor({ issuer: "sse-shop" })],
});
