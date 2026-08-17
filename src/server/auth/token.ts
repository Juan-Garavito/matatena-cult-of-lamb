import "dotenv/config";
import { createHmac } from "crypto";

/**
 * Mints short-lived JWTs so browser clients can subscribe to a private
 * Realtime channel without the app having a login flow.
 *
 * The app has no user accounts, so there is no Supabase Auth session to
 * borrow a token from. Instead the server — which already knows which
 * player belongs to which game, because it created both — signs a token
 * scoped to exactly one game and hands it to that player on join.
 *
 * The token carries `role: "authenticated"` because Realtime Authorization
 * evaluates RLS policies on `realtime.messages` against the JWT's role, and
 * the policies in migration 0002 are granted `to authenticated`. The custom
 * `game_id` claim is what those policies compare against `realtime.topic()`,
 * which is why a token issued for one game cannot subscribe to another.
 *
 * Signed with HS256 using the project's JWT secret (Supabase dashboard →
 * Settings → API → JWT Secret). This module only ever SIGNS — verification
 * happens inside Realtime, which already holds the same secret.
 */
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

if (!JWT_SECRET) {
  console.warn(
    "SUPABASE_JWT_SECRET no está configurada. Los clientes no podrán suscribirse al canal privado.",
  );
}

/** Long enough to outlast any realistic game, short enough to limit reuse. */
const TOKEN_TTL_SECONDS = 60 * 60 * 4;

const encodeSegment = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export const signGameToken = (id_game: string, id_player: string): string => {
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    role: "authenticated",
    aud: "authenticated",
    sub: id_player,
    game_id: id_game,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
  };

  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = createHmac("sha256", JWT_SECRET)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
};
