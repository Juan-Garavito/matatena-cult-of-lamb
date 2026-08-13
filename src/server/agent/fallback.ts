import type { Game } from "../types/game.types.js";

const COLUMN_COUNT = 3;
const EMPTY_CELL = -1;

/** Name pool used when the AI cannot invent one for the bot. */
export const FALLBACK_BOT_NAMES = [
  "Devoto Silente",
  "Acólito Sin Nombre",
  "Peregrino Errante",
  "Hermano Ciego",
];

export const FALLBACK_BOT_PERSONALITY = "silencioso y previsible";
export const FALLBACK_BOT_SMART = 5;

/** Same formula as `updatePoints` in `game.ts`: value * count^2 per group. */
const columnScore = (column: number[]): number => {
  const frequency: Record<number, number> = {};

  column
    .filter((cell) => cell !== EMPTY_CELL)
    .forEach((cell) => {
      frequency[cell] = (frequency[cell] ?? 0) + 1;
    });

  return Object.entries(frequency).reduce(
    (total, [value, count]) => total + Number(value) * count * count,
    0,
  );
};

const withDicePlaced = (column: number[], dice: number): number[] => {
  const index = column.findIndex((cell) => cell === EMPTY_CELL);
  if (index === -1) return column;

  const next = [...column];
  next[index] = dice;
  return next;
};

const withDiceErased = (column: number[], dice: number): number[] =>
  column.map((cell) => (cell === dice ? EMPTY_CELL : cell));

/**
 * Picks a column without asking the LLM, used when the agent is unavailable
 * so the match is not left frozen on the bot's turn.
 *
 * Scores every playable column by what the move is worth: the points the bot
 * gains plus the points the opponent loses to `erasePointsOpponent`. Ties go
 * to the lowest index, which keeps the choice deterministic.
 *
 * Returns `null` when there is no legal move (no such player, board full).
 */
export const chooseFallbackColumn = (
  game: Game,
  id_player: string,
): number | null => {
  const player = game.players.find((p) => p.id === id_player);
  const opponent = game.players.find((p) => p.id !== id_player);

  if (!player || !opponent) return null;

  let bestColumn: number | null = null;
  let bestScore = -Infinity;

  for (let column = 0; column < COLUMN_COUNT; column++) {
    const own = player.table[column];
    const rival = opponent.table[column];

    if (!own || !rival) continue;
    if (!own.includes(EMPTY_CELL)) continue;

    const gain = columnScore(withDicePlaced(own, game.dice)) - columnScore(own);
    const damage =
      columnScore(rival) - columnScore(withDiceErased(rival, game.dice));

    const score = gain + damage;

    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }

  return bestColumn;
};

export const pickFallbackBotName = (): string => {
  const index = Math.floor(Math.random() * FALLBACK_BOT_NAMES.length);
  return FALLBACK_BOT_NAMES[index] ?? "Devoto Silente";
};
