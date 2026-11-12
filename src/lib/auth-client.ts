"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The admin UI talks to Better Auth directly for sign-in and TOTP, because the
 * session cookie has to be set by an HTTP response. Everything else goes
 * through guarded server actions.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
