/**
 * Thrown by the data layer (`db/*.ts`, `game.ts`) whenever Supabase/Postgres
 * is unreachable or a query/transaction fails for infrastructure reasons.
 *
 * Callers at the HTTP/socket boundary use this to distinguish an
 * infrastructure failure (503 - service unavailable) from a domain failure
 * such as "game not found" (which stays a normal `{ ok: false, error }`
 * result, not a thrown error).
 */
export class DbUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DbUnavailableError";
  }
}
