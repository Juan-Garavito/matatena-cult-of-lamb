import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * `supabase-js` client backed by the `service_role` key. Talks to
 * Supabase's PostgREST HTTP API, which is stateless — good for simple,
 * non-racy CRUD (`getAllGames`, `getGameById`, `createGame`, `deleteGame`).
 *
 * It is NOT used for `doPlay`/`addPlayerToGame`: those need a Postgres
 * lock (`SELECT ... FOR UPDATE`) held across a read-mutate-write sequence,
 * which PostgREST cannot provide across separate HTTP calls. See
 * `db/pool.ts` for the raw `pg` connection used there.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});
