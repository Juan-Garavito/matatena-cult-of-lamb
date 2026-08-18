import type {
  Game,
  GameWrapper,
  Table,
  Player,
  TypeGame,
  TypePlayer,
} from "./types/game.types.js";
import { randomUUID } from "crypto";
import { supabase } from "./db/supabase.js";
import { withGameLock } from "./db/pool.js";
import { DbUnavailableError } from "./db/errors.js";
import {
  toGameWrapper,
  toPlayerRow,
  type GameRow,
  type PlayerRow,
} from "./db/mappers.js";

const emptyTable = (): Table => [
  [-1, -1, -1],
  [-1, -1, -1],
  [-1, -1, -1],
];

const emptyPoints = () => ({ col1: 0, col2: 0, col3: 0 });

/**
 * Normalizes any thrown error into a `DbUnavailableError`, logs it, and
 * returns the message so mutators can respond with `{ ok: false, error }`
 * instead of throwing uncaught.
 */
const toDbErrorMessage = (cause: unknown, fallback: string): string => {
  const dbError =
    cause instanceof DbUnavailableError
      ? cause
      : new DbUnavailableError(fallback, { cause });
  console.error(dbError.message, dbError.cause ?? cause);
  return dbError.message;
};

const getAllGames = async (): Promise<GameWrapper[]> => {
  try {
    const { data: gameRows, error: gamesError } = await supabase
      .from("games")
      .select("*");
    if (gamesError) throw gamesError;

    const { data: playerRows, error: playersError } = await supabase
      .from("players")
      .select("*");
    if (playersError) throw playersError;

    return ((gameRows ?? []) as GameRow[]).map((gameRow) =>
      toGameWrapper(
        gameRow,
        ((playerRows ?? []) as PlayerRow[]).filter(
          (row) => row.game_id === gameRow.id_game,
        ),
      ),
    );
  } catch (cause) {
    if (cause instanceof DbUnavailableError) throw cause;
    throw new DbUnavailableError("No se pudieron obtener los juegos.", {
      cause,
    });
  }
};

const getGameById = async (
  id_game: string,
): Promise<GameWrapper | undefined> => {
  try {
    const { data: gameRow, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id_game", id_game)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!gameRow) return undefined;

    const { data: playerRows, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", id_game)
      .order("seat", { ascending: true });
    if (playersError) throw playersError;

    return toGameWrapper(gameRow as GameRow, (playerRows ?? []) as PlayerRow[]);
  } catch (cause) {
    if (cause instanceof DbUnavailableError) throw cause;
    throw new DbUnavailableError("No se pudo obtener el juego.", { cause });
  }
};

const createGame = async (
  type: TypeGame,
): Promise<{ ok: boolean; error?: string; data?: GameWrapper }> => {
  try {
    const id_game = randomUUID();
    const turn = Math.floor(Math.random() * 2);
    const dice = updateDice();

    const { data: gameRow, error } = await supabase
      .from("games")
      .insert({ id_game, type, state: "waiting", turn, dice, winner: null })
      .select()
      .single();
    if (error) throw error;

    return { ok: true, data: toGameWrapper(gameRow as GameRow, []) };
  } catch (cause) {
    return {
      ok: false,
      error: toDbErrorMessage(cause, "No se pudo crear el juego."),
    };
  }
};

const deleteGame = async (
  id_game: string,
): Promise<{ ok: boolean; error?: string; message?: string }> => {
  try {
    const { data, error } = await supabase
      .from("games")
      .delete()
      .eq("id_game", id_game)
      .select();
    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: false, error: "Juego no encontrado." };
    }

    return { ok: true, message: `Juego ${id_game} eliminado.` };
  } catch (cause) {
    return {
      ok: false,
      error: toDbErrorMessage(cause, "No se pudo eliminar el juego."),
    };
  }
};

const checkFinish = (table: Table) => {
  return !table.flat().includes(-1) ? "finish" : "playing";
};

const checkWinner = (players: [Player, Player]): Player | null => {
  const [player1, player2] = players;

  return player1.totalPoints > player2.totalPoints ? player1 : player2;
};

const validatePlay = (column: number, game: Game, id_player: string) => {
  if (game.state === "finish") {
    return { ok: false as const, error: "El juego ha terminado." };
  }

  if (game.state === "waiting") {
    return { ok: false as const, error: "El juego no ha comenzado." };
  }

  if (column < 0 || column > 2) {
    return { ok: false as const, error: "Columna inválida." };
  }

  const player = game.players[game.turn];
  const opponent = game.players[game.turn === 0 ? 1 : 0];

  if (!player || !opponent) {
    return { ok: false as const, error: "Jugador no encontrado." };
  }

  if (player.id !== id_player) {
    return { ok: false as const, error: "No es tu turno." };
  }

  const col = player.table[column];

  if (!col) {
    return { ok: false as const, error: "Columna inválida." };
  }

  const index = col.findIndex((cell) => cell === -1);

  if (index === -1) {
    return { ok: false as const, error: "Columna llena." };
  }

  return {
    ok: true as const,
    data: { player, col, index, opponent },
  };
};

const updatePoints = (column: number, players: Player[]): void => {
  players.forEach((player) => {
    const col = player.table[column];
    if (!col) return;

    let columnPoints = 0;

    const validValues = col.filter((cell) => cell !== -1);

    const colKey = `col${column + 1}` as keyof Player["points"];

    if (validValues.length === 0) {
      player.points[colKey] = 0;
      updateTotalPoints(player);
      return;
    }

    const frequency: Record<number, number> = {};
    validValues.forEach((val) => {
      frequency[val] = (frequency[val] || 0) + 1;
    });

    Object.entries(frequency).forEach(([value, count]) => {
      columnPoints += Number(value) * count * count;
    });

    player.points[colKey] = columnPoints;
    updateTotalPoints(player);
  });
};

const updateDice = (): number => {
  return Math.floor(Math.random() * 6) + 1;
};

const erasePointsOpponent = (
  column: number,
  value: number,
  opponent: Player,
): void => {
  const col = opponent.table[column];
  if (!col) return;

  const newValues = col.map((cell) => (cell === value ? -1 : cell));

  opponent.table[column] = newValues;
};

const updateTotalPoints = (player: Player): void => {
  const total = Object.values(player.points).reduce((sum, col) => sum + col, 0);
  player.totalPoints = total;
};

const addPlayerToGame = async (
  id_game: string,
  player: Player,
): Promise<{ ok: boolean; error?: string; data?: GameWrapper }> => {
  try {
    const result = await withGameLock(id_game, async (client) => {
      const gameResult = await client.query<GameRow>(
        "SELECT * FROM games WHERE id_game = $1",
        [id_game],
      );
      const gameRow = gameResult.rows[0];

      if (!gameRow) {
        return { ok: false as const, error: "Juego no encontrado." };
      }

      const playersResult = await client.query<PlayerRow>(
        "SELECT * FROM players WHERE game_id = $1 ORDER BY seat",
        [id_game],
      );
      const existingPlayers = playersResult.rows;

      if (existingPlayers.length >= 2) {
        return { ok: false as const, error: "El juego ya está lleno." };
      }

      const seat = existingPlayers.some((p) => p.seat === 0) ? 1 : 0;
      const playerRow = toPlayerRow(player, id_game, seat);

      await client.query(
        'INSERT INTO players (id, game_id, seat, name, type, "table", points, total_points, personality, smart) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          playerRow.id,
          playerRow.game_id,
          playerRow.seat,
          playerRow.name,
          playerRow.type,
          JSON.stringify(playerRow.table),
          JSON.stringify(playerRow.points),
          playerRow.total_points,
          playerRow.personality,
          playerRow.smart,
        ],
      );

      const newState = existingPlayers.length === 1 ? "playing" : gameRow.state;

      if (newState !== gameRow.state) {
        await client.query("UPDATE games SET state = $1 WHERE id_game = $2", [
          newState,
          id_game,
        ]);
      }

      const updatedGameRow: GameRow = { ...gameRow, state: newState };
      const updatedPlayers = [...existingPlayers, playerRow];

      return {
        ok: true as const,
        data: toGameWrapper(updatedGameRow, updatedPlayers),
      };
    });

    return result;
  } catch (cause) {
    return {
      ok: false,
      error: toDbErrorMessage(cause, "No se pudo unir el jugador al juego."),
    };
  }
};

const doPlay = async (
  column: number,
  id_player: string,
  id_game: string,
): Promise<{ ok: boolean; error?: string; gameState?: Game }> => {
  try {
    const result = await withGameLock(id_game, async (client) => {
      const gameResult = await client.query<GameRow>(
        "SELECT * FROM games WHERE id_game = $1",
        [id_game],
      );
      const gameRow = gameResult.rows[0];

      if (!gameRow) {
        return { ok: false as const, error: "Juego no encontrado." };
      }

      const playersResult = await client.query<PlayerRow>(
        "SELECT * FROM players WHERE game_id = $1 ORDER BY seat",
        [id_game],
      );

      const gameWrapper = toGameWrapper(gameRow, playersResult.rows);
      const game = gameWrapper.game;

      const validation = validatePlay(column, game, id_player);

      if (!validation.ok) {
        return { ok: false as const, error: validation.error };
      }

      const { player, col, index, opponent } = validation.data;
      const value = game.dice;
      col[index] = value;

      erasePointsOpponent(column, value, opponent);
      updatePoints(column, game.players);

      game.state = checkFinish(player.table);

      if (game.state === "finish") {
        const winner = checkWinner([player, opponent]);
        game.winner = winner ? winner.id : null;
      } else {
        game.turn = game.turn === 0 ? 1 : 0;
        game.dice = updateDice();
      }

      await Promise.all(
        game.players.map((p, seat) => {
          const row = toPlayerRow(p, id_game, seat);
          return client.query(
            'UPDATE players SET "table" = $1, points = $2, total_points = $3 WHERE id = $4',
            [
              JSON.stringify(row.table),
              JSON.stringify(row.points),
              row.total_points,
              row.id,
            ],
          );
        }),
      );

      await client.query(
        "UPDATE games SET state = $1, turn = $2, dice = $3, winner = $4 WHERE id_game = $5",
        [game.state, game.turn, game.dice, game.winner, id_game],
      );

      return { ok: true as const, gameState: game };
    });

    return result;
  } catch (cause) {
    return {
      ok: false,
      error: toDbErrorMessage(cause, "No se pudo realizar la jugada."),
    };
  }
};

const resetGame = async (
  id_game: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const result = await withGameLock(id_game, async (client) => {
      const gameResult = await client.query<GameRow>(
        "SELECT id_game FROM games WHERE id_game = $1",
        [id_game],
      );

      if (!gameResult.rows[0]) {
        return { ok: false as const, error: "Juego no encontrado." };
      }

      const playersResult = await client.query<PlayerRow>(
        "SELECT id FROM players WHERE game_id = $1",
        [id_game],
      );

      const resetTable = JSON.stringify(emptyTable());
      const resetPoints = JSON.stringify(emptyPoints());

      await Promise.all(
        playersResult.rows.map((row) =>
          client.query(
            'UPDATE players SET "table" = $1, points = $2, total_points = $3 WHERE id = $4',
            [resetTable, resetPoints, 0, row.id],
          ),
        ),
      );

      const turn = Math.floor(Math.random() * 2);
      const dice = updateDice();

      await client.query(
        "UPDATE games SET turn = $1, state = $2, winner = $3, dice = $4 WHERE id_game = $5",
        [turn, "playing", null, dice, id_game],
      );

      return { ok: true as const };
    });

    return result;
  } catch (cause) {
    return {
      ok: false,
      error: toDbErrorMessage(cause, "No se pudo reiniciar el juego."),
    };
  }
};

/**
 * Builds an in-memory player. `traits` is only ever passed for bots — it
 * carries the personality and skill level the agent was created with, and
 * rides along into the `players` row so it survives a restart.
 */
const createPlayer = (
  name: string,
  type: TypePlayer,
  traits?: { personality: string; smart: number },
): Player => {
  return {
    id: randomUUID(),
    name: name,
    table: emptyTable(),
    points: emptyPoints(),
    totalPoints: 0,
    type: type,
    ...(traits ?? {}),
  };
};

export {
  getAllGames,
  getGameById,
  createGame,
  deleteGame,
  addPlayerToGame,
  doPlay,
  checkFinish,
  checkWinner,
  updatePoints,
  updateTotalPoints,
  createPlayer,
  resetGame,
};
