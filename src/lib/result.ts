/**
 * A result the server can hand to the UI without leaking an exception.
 * Actions return these; unexpected errors are logged and become a generic message.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(error: string): Result<never> {
  return { ok: false, error };
}

export const GENERIC_ERROR = "Something went wrong. Please try again.";
