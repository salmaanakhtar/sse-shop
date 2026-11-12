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
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
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
