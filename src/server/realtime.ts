import { getGameById, doPlay } from "./game.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const broadcast = async (
  id_game: string,
  event: string,
  payload: unknown,
): Promise<void> => {
  // `?private=true` is required for topics the clients subscribe to with
  // `config: { private: true }` — without it Realtime treats this as a
  // different, public topic and subscribers never receive the message.
  const url = `${SUPABASE_URL}/realtime/v1/api/broadcast/${encodeURIComponent(
    id_game,
  )}/events/${encodeURIComponent(event)}?private=true`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(
      `Broadcast '${event}' falló (${response.status}) para ${id_game}`,
    );
  }
};

export const sendMessage = async (
  id_game: string,
  id_player: string,
  message: string,
) => {
  await broadcast(id_game, "message", { message, id_player });
};

export const notifyAgentUnavailable = async (
  id_game: string,
  message: string,
) => {
  await broadcast(id_game, "agent_unavailable", { message });
};

export const notifyGameClosed = async (id_game: string) => {
  await broadcast(id_game, "game_closed", {});
};

export const playAndBroadcast = async (
  column: number,
  id_player: string,
  id_game: string,
) => {
  const result = await doPlay(column, id_player, id_game);
  if (!result.ok) return { error: result.error, gameState: null };
  await sendGameState(id_game);
  return { gameState: result.gameState, error: null };
};

export const sendGameState = async (id_game: string) => {
  const gameWrapper = await getGameById(id_game);
  if (!gameWrapper) return;
  await broadcast(id_game, "game_state", gameWrapper.game);
};

export const sendError = async (
  id_game: string,
  id_player: string,
  error: string,
) => {
  await broadcast(id_game, `play_error/${id_player}`, { error });
};
