import type { Bots, Game } from "../types/game.types.js";

/**
 * Reads a bot's traits off the game it is playing in.
 *
 * These used to live in a module-level array populated when the agent invented
 * the bot. That only holds while one long-lived process serves every request:
 * a restart, or a deployment that spreads requests across instances, left the
 * array empty and this lookup returned undefined. The agent then played on with
 * no personality and no skill level, without anything failing loudly.
 *
 * The traits now travel on the `players` row (migration 0003), so they arrive
 * already loaded with the game and this stays a pure lookup — no query, no
 * cache to invalidate, nothing to lose on restart.
 */
export const getBotByGame = (game: Game): Bots | undefined => {
  const bot = game.players.findLast((p) => p.type === "bot");

  // A bot row always carries both traits — the database constraint in
  // migration 0003 enforces it — but the columns are nullable for humans, so
  // narrow here before promising a fully populated Bots.
  if (!bot || bot.personality === undefined || bot.smart === undefined) {
    return undefined;
  }

  return {
    id: bot.id,
    name: bot.name,
    personality: bot.personality,
    smart: bot.smart,
  };
};
