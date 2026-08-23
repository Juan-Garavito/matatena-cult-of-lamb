import type { Request, RequestHandler } from "express";

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export type RateLimiter = (key: string) => RateLimitDecision;

interface RateLimiterOptions {
  capacity: number;
  refillMs: number;
  idleMs?: number;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const createRateLimiter = ({
  capacity,
  refillMs,
  idleMs,
}: RateLimiterOptions): RateLimiter => {
  const forgetAfterMs = idleMs ?? Math.max(capacity * refillMs * 2, 600_000);
  const buckets = new Map<string, Bucket>();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt > forgetAfterMs) buckets.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  sweeper.unref?.();

  return (key: string): RateLimitDecision => {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket) {
      buckets.set(key, { tokens: capacity - 1, updatedAt: now });
      return { allowed: true };
    }

    const earned = Math.floor((now - bucket.updatedAt) / refillMs);
    if (earned > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + earned);
      bucket.updatedAt =
        bucket.tokens === capacity ? now : bucket.updatedAt + earned * refillMs;
    }

    if (bucket.tokens <= 0) {
      return {
        allowed: false,
        retryAfterMs: refillMs - (now - bucket.updatedAt),
      };
    }

    bucket.tokens -= 1;
    return { allowed: true };
  };
};

const clientIp = (req: Request): string =>
  req.ip ?? req.socket.remoteAddress ?? "unknown";

const byIp = (req: Request): string => clientIp(req);

const byPlayer = (req: Request): string => {
  const id_game = req.params.idGame ?? req.body?.id_game ?? "";
  const id_player = req.body?.id_player ?? "";
  return `${clientIp(req)}|${id_game}|${id_player}`;
};

const byGame = (req: Request): string =>
  `${clientIp(req)}|${req.params.idGame ?? ""}`;

type AnyRequestHandler = RequestHandler<any, any, any, any>;

export const rateLimit = (
  limiter: RateLimiter,
  keyOf: (req: Request) => string,
): AnyRequestHandler => {
  return (req, res, next) => {
    const decision = limiter(keyOf(req));

    if (decision.allowed) return next();

    const retryAfterMs = Math.max(decision.retryAfterMs, 0);
    res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    res.status(429).json({
      error: "Vas demasiado rápido, espera un momento.",
      retryAfterMs,
    });
  };
};

const envNumber = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const limitMessages = rateLimit(
  createRateLimiter({
    capacity: envNumber("RATE_LIMIT_MESSAGE_BURST", 4),
    refillMs: envNumber("RATE_LIMIT_MESSAGE_REFILL_MS", 4000),
  }),
  byPlayer,
);

export const limitPlays = rateLimit(
  createRateLimiter({
    capacity: envNumber("RATE_LIMIT_PLAY_BURST", 8),
    refillMs: envNumber("RATE_LIMIT_PLAY_REFILL_MS", 1000),
  }),
  byPlayer,
);

export const limitGameCreation = rateLimit(
  createRateLimiter({
    capacity: envNumber("RATE_LIMIT_CREATE_BURST", 3),
    refillMs: envNumber("RATE_LIMIT_CREATE_REFILL_MS", 20_000),
  }),
  byIp,
);

export const limitJoins = rateLimit(
  createRateLimiter({
    capacity: envNumber("RATE_LIMIT_JOIN_BURST", 5),
    refillMs: envNumber("RATE_LIMIT_JOIN_REFILL_MS", 10_000),
  }),
  byIp,
);

export const limitGameAdmin = rateLimit(
  createRateLimiter({
    capacity: envNumber("RATE_LIMIT_ADMIN_BURST", 6),
    refillMs: envNumber("RATE_LIMIT_ADMIN_REFILL_MS", 3000),
  }),
  byGame,
);
