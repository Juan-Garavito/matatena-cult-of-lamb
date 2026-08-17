/**
 * Why the AI opponent could not answer. Each reason maps to a different
 * player-facing message, so the human knows whether to wait, retry later,
 * or give up on the bot for this session.
 */
export type AgentUnavailableReason =
  | "quota"
  | "auth"
  | "timeout"
  | "network"
  | "unknown";

const PLAYER_MESSAGES: Record<AgentUnavailableReason, string> = {
  quota: "El oponente se quedó sin energía: la cuota de la IA se agotó.",
  auth: "El oponente no está disponible: la IA no está bien configurada.",
  timeout: "El oponente tardó demasiado en responder.",
  network: "El oponente no está disponible: no se pudo contactar a la IA.",
  unknown: "El oponente no está disponible en este momento.",
};

/**
 * Thrown (and caught) around every LLM call in `agent/*.ts` when the model
 * cannot answer: exhausted quota, invalid key, timeout, or an unreachable
 * service.
 *
 * Callers at the realtime boundary use `reason` to decide the recovery path and
 * `playerMessage` to tell the human what happened. A failure here is never
 * fatal for the game — `agent/recovery.ts` keeps the match going.
 */
export class AgentUnavailableError extends Error {
  readonly reason: AgentUnavailableReason;

  constructor(
    reason: AgentUnavailableReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AgentUnavailableError";
    this.reason = reason;
  }

  /** Short, non-technical text safe to show to the player. */
  get playerMessage(): string {
    return PLAYER_MESSAGES[this.reason];
  }
}

/** Digs a numeric HTTP status out of the many shapes SDK errors arrive in. */
const readStatus = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;

  const candidate = cause as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };

  const values = [
    candidate.status,
    candidate.statusCode,
    candidate.code,
    candidate.response?.status,
  ];

  for (const value of values) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }

  return undefined;
};

const readText = (cause: unknown): string => {
  if (cause instanceof Error) return `${cause.name} ${cause.message}`;
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause) ?? "";
  } catch {
    return "";
  }
};

const matchReason = (cause: unknown): AgentUnavailableReason => {
  const status = readStatus(cause);
  const text = readText(cause).toLowerCase();

  if (
    status === 429 ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("insufficient_quota")
  ) {
    return "quota";
  }

  if (
    status === 401 ||
    status === 403 ||
    text.includes("unauthenticated") ||
    text.includes("permission_denied") ||
    text.includes("api key") ||
    text.includes("api_key")
  ) {
    return "auth";
  }

  if (
    status === 408 ||
    status === 504 ||
    text.includes("aborterror") ||
    text.includes("timeouterror") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("etimedout") ||
    text.includes("aborted")
  ) {
    return "timeout";
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    text.includes("unavailable") ||
    text.includes("overloaded") ||
    text.includes("fetch failed") ||
    text.includes("econnreset") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("network")
  ) {
    return "network";
  }

  return "unknown";
};

/**
 * Normalizes anything thrown by the model, the graph, or a tool into an
 * `AgentUnavailableError`. Already-classified errors pass through untouched.
 */
export const classifyAgentError = (
  cause: unknown,
  context?: string,
): AgentUnavailableError => {
  if (cause instanceof AgentUnavailableError) return cause;

  const reason = matchReason(cause);
  const detail = readText(cause) || "Error desconocido";
  const where = context ? ` [${context}]` : "";

  return new AgentUnavailableError(
    reason,
    `El agente no pudo responder (${reason})${where}: ${detail}`,
    { cause },
  );
};
