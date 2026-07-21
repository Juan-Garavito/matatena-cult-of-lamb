import "dotenv/config";
import { Pool, type PoolClient } from "pg";
import { DbUnavailableError } from "./errors.js";

/**
 * Raw Postgres connection pool for the two operations that need a lock
 * held across a read-mutate-write sequence: `doPlay` and
 * `addPlayerToGame`.
 *
 * IMPORTANT — `SUPABASE_DB_URL` MUST be Supabase's session-mode connection
 * string (port 5432), NOT the pgbouncer transaction-pooling connection
 * string (port 6543). `SELECT ... FOR UPDATE` locks a row only for the
 * lifetime of the Postgres session that acquired it; pgbouncer in
 * transaction-pooling mode can hand the underlying server connection to a
 * different client between statements, so the lock would not reliably
 * persist across the `BEGIN` / `SELECT ... FOR UPDATE` / business logic /
 * `UPDATE` / `COMMIT` sequence run through `withGameLock`. Session mode
 * keeps one client bound to one server connection for the whole
 * transaction, which is required here.
 */
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || "";

if (!SUPABASE_DB_URL) {
  console.warn("SUPABASE_DB_URL no está configurada.");
}

export const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
});

/**
 * Runs `fn` inside a transaction that holds a row lock on `games` for
 * `id_game` for the whole duration of the callback. Use this for any
 * operation that reads game/player state and must write back a mutated
 * version atomically (e.g. `doPlay`, `addPlayerToGame`).
 *
 * - Acquires one client from the pool for the whole transaction.
 * - `BEGIN`s, then locks the `games` row (`SELECT ... FOR UPDATE`) before
 *   calling `fn`, so concurrent calls for the same `id_game` serialize.
 * - `fn` receives the locked `client` to run any further reads/writes
 *   (e.g. `SELECT ... FOR UPDATE` on `players`, then the final `UPDATE`s)
 *   within the same session/transaction.
 * - Commits on success, rolls back on any thrown error, and always
 *   releases the client back to the pool.
 * - Any failure (connection, query, transaction) is normalized to a
 *   `DbUnavailableError` so callers can distinguish infra failure from
 *   domain errors like "game not found".
 */
export const withGameLock = async <T>(
  id_game: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  let client: PoolClient;

  try {
    client = await pool.connect();
  } catch (cause) {
    throw new DbUnavailableError("No se pudo conectar a la base de datos.", {
      cause,
    });
  }

  try {
    await client.query("BEGIN");
    await client.query("SELECT id_game FROM games WHERE id_game = $1 FOR UPDATE", [
      id_game,
    ]);

    const result = await fn(client);

    await client.query("COMMIT");
    return result;
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => {});

    if (cause instanceof DbUnavailableError) {
      throw cause;
    }

    throw new DbUnavailableError(
      "No se pudo completar la operación de base de datos.",
      { cause },
    );
  } finally {
    client.release();
  }
};
