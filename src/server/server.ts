import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  createGame,
  createPlayer,
  doPlay,
  getGameById,
  resetGame,
} from "./game.js";
import type {
  Player,
  GameWrapper,
  JoinGameRequest,
  TypeGame,
} from "./types/game.types.js";
import {
  CreateGameRequestSchema,
  JoinGameRequestSchema,
  MessageRequestSchema,
  PlayRequestSchema,
} from "./types/game.schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(express.static(__dirname + "/../public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/../public/index.html");
});

const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "";

app.get("/js/env.js", (req, res) => {
  res.type("application/javascript");
  res.send(`window.ENV = { API_URL: '${API_URL}' };`);
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en ${API_URL}`);
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.post("/create-game", async (req, res) => {
  const { success, data } = await CreateGameRequestSchema.safeParseAsync(
    req.body as TypeGame,
  );

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const result = createGame(data.type);

  if (data.type === "singleplayer") {
    const newPlayer: Player = createPlayer("BOT", "bot");
    result.data?.game.players.push(newPlayer);
  }

  if (result.ok) {
    res.json({ gameId: result.data?.id_game });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.post("/join-game", async (req, res) => {
  const { success, data } = await JoinGameRequestSchema.safeParseAsync(
    req.body as JoinGameRequest,
  );

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const gameWrapper: GameWrapper | undefined = getGameById(data.id_game);

  if (!gameWrapper) {
    return res.status(404).json({ error: "El juego no existe" });
  }

  const game = gameWrapper.game;

  if (game.players.length >= 2) {
    return res.status(400).json({ error: "El juego ya está lleno" });
  }
  const newPlayer: Player = createPlayer(data.playerName, "human");

  game.players.push(newPlayer);

  if (game.players.length === 2) {
    game.state = "playing";
  }

  res.json({
    success: true,
    player: { id: newPlayer.id, name: newPlayer.name },
  });
});

io.use((socket, next) => {
  const { idGame } = socket.handshake.auth;
  const gameWrapper = getGameById(idGame);

  if (!gameWrapper) {
    return next(new Error("El juego no existe"));
  }
  next();
});

io.on("connection", (socket) => {
  const { idGame } = socket.handshake.auth;
  const game = getGameById(idGame)?.game;
  io.emit("game_state/" + idGame, game);

  socket.on("play/" + idGame, async (data) => {
    const { success, data: playRequest } =
      await PlayRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { column, id_game, id_player } = playRequest;

    const result = doPlay(column, id_player, id_game);
    if (result.ok) {
      io.emit("game_state/" + idGame, result.gameState);
      return;
    }

    io.emit("play_error/" + idGame + "/" + id_player, { error: result.error });
  });

  socket.on("reset_game/" + idGame, () => {
    resetGame(idGame);
    io.emit("game_state/" + idGame, getGameById(idGame)?.game);
  });

  socket.on("message/" + idGame, async (data) => {
    const { success, data: messageRequest } =
      await MessageRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { id_game, message, id_player } = messageRequest;
    io.emit("message/" + id_game, { message: message, id_player });
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});
