import type {
  GameWrapper,
  Player,
  Points,
  State,
  Table,
  TypeGame,
  TypePlayer,
} from "../types/game.types.js";

/** Shape of a row from the `games` table (snake_case, as returned by Postgres/Supabase). */
export interface GameRow {
  id_game: string;
  type: TypeGame;
  state: State;
  turn: number;
  dice: number;
  winner: string | null;
}

/** Shape of a row from the `players` table (snake_case, `table`/`points` are jsonb). */
export interface PlayerRow {
  id: string;
  game_id: string;
  seat: number;
  name: string;
  type: TypePlayer;
  table: Table;
  points: Points;
  total_points: number;
  personality: string | null;
  smart: number | null;
}

/**
 * Combines one `games` row with its `players` rows (ordered by `seat`)
 * into the app-level `GameWrapper` shape used by `game.ts` and validated
 * by `GameSchema`.
 */
export const toGameWrapper = (
  gameRow: GameRow,
  playerRows: PlayerRow[],
): GameWrapper => {
  const players: Player[] = [...playerRows]
    .sort((a, b) => a.seat - b.seat)
    .map(toPlayer);

  return {
    id_game: gameRow.id_game,
    game: {
      players,
      turn: gameRow.turn,
      state: gameRow.state,
      winner: gameRow.winner,
      dice: gameRow.dice,
      type: gameRow.type,
    },
  };
};

/** Maps a single `players` row to the app-level `Player` shape. */
export const toPlayer = (playerRow: PlayerRow): Player => ({
  id: playerRow.id,
  name: playerRow.name,
  table: playerRow.table,
  points: playerRow.points,
  totalPoints: playerRow.total_points,
  type: playerRow.type,
  // Spread conditionally rather than assigning null: `exactOptionalPropertyTypes`
  // treats an explicit undefined as different from an absent property.
  ...(playerRow.personality !== null && { personality: playerRow.personality }),
  ...(playerRow.smart !== null && { smart: playerRow.smart }),
});

/**
 * Maps an app-level `Player` to a `players` table row for a given game
 * and seat, ready to insert/update.
 */
export const toPlayerRow = (
  player: Player,
  gameId: string,
  seat: number,
): PlayerRow => ({
  id: player.id,
  game_id: gameId,
  seat,
  name: player.name,
  type: player.type,
  table: player.table,
  points: player.points,
  total_points: player.totalPoints,
  personality: player.personality ?? null,
  smart: player.smart ?? null,
});
