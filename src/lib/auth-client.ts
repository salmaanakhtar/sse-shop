"use client";

import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/server/auth";

/**
 * The admin UI talks to Better Auth directly for sign-in and TOTP, because the
 * session cookie has to be set by an HTTP response. Everything else goes
 * through guarded server actions.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), inferAdditionalFields<typeof auth>()],
});
