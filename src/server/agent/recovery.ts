import { runAgent, type AgentRunInput } from "./agent.js";
import type { AgentUnavailableError } from "./errors.js";
import {
  chooseFallbackColumn,
  pickFallbackBotName,
  FALLBACK_BOT_PERSONALITY,
  FALLBACK_BOT_SMART,
} from "./fallback.js";
import { createBot } from "./data.js";
import { addPlayerToGame, createPlayer, getGameById } from "../game.js";
import {
  doPlaySocket,
  notifyAgentUnavailable,
  sendGameState,
} from "../socket.js";
import { DbUnavailableError } from "../db/errors.js";

const createFallbackBot = async (id_game: string): Promise<boolean> => {
  const wrapper = await getGameById(id_game);
  if (!wrapper) return false;
  if (wrapper.game.players.length >= 2) return false;

  const name = pickFallbackBotName();
  const player = createPlayer(name, "bot");

  createBot(player.id, name, FALLBACK_BOT_PERSONALITY, FALLBACK_BOT_SMART);

  const result = await addPlayerToGame(id_game, player);
  if (!result.ok) return false;

  await sendGameState(id_game);

  // If the bot joined into the opening turn, play it here — otherwise the game
  // deadlocks waiting for a move the fallback never makes. playFallbackMove is
  // a no-op when it isn't the bot's turn (e.g. the bot joined first).
  await playFallbackMove(id_game, player.id);

  return true;
};

const playFallbackMove = async (
  id_game: string,
  id_bot: string,
): Promise<boolean> => {
  const wrapper = await getGameById(id_game);
  if (!wrapper) return false;

  const game = wrapper.game;
  if (game.state !== "playing") return false;

  const inTurn = game.players[game.turn];
  if (!inTurn || inTurn.id !== id_bot) return false;

  const column = chooseFallbackColumn(game, id_bot);
  if (column === null) return false;

  const result = await doPlaySocket(column, id_bot, id_game);
  return !result.error;
};

const findBotId = async (id_game: string): Promise<string | undefined> => {
  const wrapper = await getGameById(id_game);
  return wrapper?.game.players.findLast((p) => p.type === "bot")?.id;
};

const recover = async (
  input: AgentRunInput,
  id_game: string,
  error: AgentUnavailableError,
): Promise<string> => {
  switch (input.request) {
    case "create_player": {
      const created = await createFallbackBot(id_game);
      return created
        ? `${error.playerMessage} Un devoto sin voz ocupó su lugar.`
        : `${error.playerMessage} No se pudo sumar un oponente a la partida.`;
    }

    case "play_game": {
      const id_bot = input.player?.id ?? (await findBotId(id_game));
      const played = id_bot ? await playFallbackMove(id_game, id_bot) : false;
      return played
        ? `${error.playerMessage} Jugó por instinto para no trabar la partida.`
        : `${error.playerMessage} Reinicia la partida para seguir jugando.`;
    }

    case "send_message":
      return `${error.playerMessage} No puede responderte por ahora.`;

    default:
      return error.playerMessage;
  }
};

export const runAgentWithFallback = async (
  input: AgentRunInput,
): Promise<void> => {
  const result = await runAgent(input);
  if (result.ok) return;

  const { error } = result;
  const id_game = input.gameState?.id_game;

  console.error(
    `Agente no disponible (${error.reason}) en "${input.request}":`,
    error.cause ?? error,
  );

  if (!id_game) return;

  try {
    await notifyAgentUnavailable(id_game, await recover(input, id_game, error));
  } catch (cause) {
    if (cause instanceof DbUnavailableError) {
      console.error("Fallback del agente sin base de datos:", cause);
      return;
    }
    console.error("El fallback del agente falló:", cause);
  }
};
