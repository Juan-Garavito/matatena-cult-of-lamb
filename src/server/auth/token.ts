import "dotenv/config";
import { createHmac, timingSafeEqual } from "crypto";

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
 * Settings → API → JWT Secret). Realtime verifies the token on its side with
 * the same secret; `verifyGameToken` below is how the game's own HTTP routes
 * check it, so a player can only act on the game and identity it was cut for.
 */
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

if (!JWT_SECRET) {
  console.warn(
    "SUPABASE_JWT_SECRET no está configurada: los clientes no podrán suscribirse al canal privado y todas las rutas de partida responderán 401.",
  );
}

/** Long enough to outlast any realistic game, short enough to limit reuse. */
export const TOKEN_TTL_SECONDS = 60 * 60 * 4;

/**
 * How long after expiry a token may still be traded for a fresh one. It covers
 * the laptop that slept through the night, and it is safe to be this generous
 * because `/refresh-token` also requires the game to still exist with that
 * player in it — the game's own lifetime is the real bound, not the clock.
 */
export const REFRESH_GRACE_SECONDS = 60 * 60 * 24;

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

export interface GameTokenClaims {
  sub: string;
  game_id: string;
  exp: number;
}

const decodePayload = (segment: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    );
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

interface VerifyOptions {
  graceSeconds?: number;
}

export const verifyGameToken = (
  token: string,
  { graceSeconds = 0 }: VerifyOptions = {},
): GameTokenClaims | null => {
  if (!JWT_SECRET) return null;

  const [headerSegment, payloadSegment, signature] = token.split(".");
  if (!headerSegment || !payloadSegment || !signature) return null;

  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest("base64url");

  const provided = Buffer.from(signature);
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length) return null;
  if (!timingSafeEqual(provided, computed)) return null;

  const claims = decodePayload(payloadSegment);
  if (!claims) return null;

  const { sub, game_id, exp } = claims;
  if (typeof sub !== "string" || sub.length === 0) return null;
  if (typeof game_id !== "string" || game_id.length === 0) return null;
  if (typeof exp !== "number") return null;
  if ((exp + graceSeconds) * 1000 <= Date.now()) return null;

  return { sub, game_id, exp };
};
