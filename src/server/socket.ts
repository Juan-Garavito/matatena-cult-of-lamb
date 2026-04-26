import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { getGameById, doPlay } from "./game.js";

let io: Server;

export const initIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer);

  io.use((socket, next) => {
    const { idGame } = socket.handshake.auth;
    const gameWrapper = getGameById(idGame);
    if (!gameWrapper) return next(new Error("El juego no existe"));
    next();
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

export const doPlaySocket = (
  column: number,
  id_player: string,
  id_game: string,
) => {
  const result = doPlay(column, id_player, id_game);
  if (!result.ok) return { error: result.error, gameState: null };
  getIO().emit("game_state/" + id_game, result.gameState);
  return { gameState: result.gameState, error: null };
};

export const sendGameState = (id_game: string) => {
  const gameWrapper = getGameById(id_game);
  if (!gameWrapper) return;
  getIO().emit("game_state/" + id_game, gameWrapper.game);
};
