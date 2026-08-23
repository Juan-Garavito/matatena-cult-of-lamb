import type { Request, RequestHandler } from "express";
import { verifyGameToken, type GameTokenClaims } from "./token.js";

type AnyRequestHandler = RequestHandler<any, any, any, any>;

export const bearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};

const requestedGameIds = (req: Request): string[] =>
  [req.params.idGame, req.body?.id_game].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

export const requireGameToken: AnyRequestHandler = (req, res, next) => {
  const token = bearerToken(req);
  const claims = token ? verifyGameToken(token) : null;

  if (!claims) {
    return res.status(401).json({ error: "Sesión inválida o vencida." });
  }

  const gameIds = requestedGameIds(req);
  if (gameIds.length === 0 || gameIds.some((id) => id !== claims.game_id)) {
    return res
      .status(403)
      .json({ error: "El token no corresponde a esta partida." });
  }

  const id_player = req.body?.id_player;
  if (typeof id_player === "string" && id_player !== claims.sub) {
    return res
      .status(403)
      .json({ error: "El token no corresponde a este jugador." });
  }

  res.locals.gameAuth = claims satisfies GameTokenClaims;
  next();
};
