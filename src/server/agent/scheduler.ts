import type { AgentRunInput } from "./agent.js";
import { runAgentWithFallback } from "./recovery.js";

const MAX_CONCURRENT_RUNS = (() => {
  const parsed = Number(process.env.AGENT_MAX_CONCURRENT_RUNS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
})();

const tails = new Map<string, Promise<void>>();
const pending = new Map<string, number>();

let inFlight = 0;

const track = (id_game: string, delta: number): void => {
  const next = (pending.get(id_game) ?? 0) + delta;
  if (next > 0) pending.set(id_game, next);
  else pending.delete(id_game);
};

export const scheduleAgentRun = (input: AgentRunInput): void => {
  const id_game = input.gameState?.id_game;

  if (!id_game) return;

  const droppable = input.request === "send_message";

  if (droppable && (pending.get(id_game) ?? 0) > 0) {
    console.warn(`Mensaje descartado: el agente ya trabaja en ${id_game}`);
    return;
  }

  if (droppable && inFlight >= MAX_CONCURRENT_RUNS) {
    console.warn(
      `Mensaje descartado: ${inFlight} ejecuciones del agente en curso`,
    );
    return;
  }

  track(id_game, 1);

  const previous = tails.get(id_game) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      inFlight += 1;
      try {
        await runAgentWithFallback(input);
      } finally {
        inFlight -= 1;
        track(id_game, -1);
      }
    })
    .catch((cause) => {
      console.error(`La ejecución del agente falló en ${id_game}:`, cause);
    })
    .finally(() => {
      if (tails.get(id_game) === next) tails.delete(id_game);
    });

  tails.set(id_game, next);
};
