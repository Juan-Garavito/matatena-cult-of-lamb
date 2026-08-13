import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { getGameById, doPlay } from "./game.js";
import { DbUnavailableError } from "./db/errors.js";

let io: Server;

export const initIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer);

  io.use(async (socket, next) => {
    const { idGame } = socket.handshake.auth;
    try {
      const gameWrapper = await getGameById(idGame);
      if (!gameWrapper) return next(new Error("El juego no existe"));
      next();
    } catch (error) {
      if (error instanceof DbUnavailableError) {
        return next(new Error("Servicio no disponible"));
      }
      next(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.IO no ha sido inicializado");
  return io;
};

export const sendMessage = (
  id_game: string,
  id_player: string,
  message: string,
) => {
  getIO().emit("message/" + id_game, { message, id_player });
};

/**
 * Tells everyone in the game that the AI opponent could not answer, and what
 * was done about it. Emitted by `agent/recovery.ts` only.
 */
export const notifyAgentUnavailable = (id_game: string, message: string) => {
  getIO().emit("agent_unavailable/" + id_game, { message });
};

export const doPlaySocket = async (
  column: number,
  id_player: string,
  id_game: string,
) => {
  const result = await doPlay(column, id_player, id_game);
  if (!result.ok) return { error: result.error, gameState: null };
  getIO().emit("game_state/" + id_game, result.gameState);
  return { gameState: result.gameState, error: null };
};

export const sendGameState = async (id_game: string) => {
  const gameWrapper = await getGameById(id_game);
  if (!gameWrapper) return;
  getIO().emit("game_state/" + id_game, gameWrapper.game);
};
