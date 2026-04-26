import "dotenv/config";
import express from "express";
import http from "http";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { doPlaySocket, sendMessage, initIO, sendGameState } from "./socket.js";
import { createGame, createPlayer, getGameById, resetGame } from "./game.js";
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
import { runAgent } from "./agent/agent.js";
import { getBotByGame } from "./agent/data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = initIO(server);
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

app.post("/create-game", async (req, res) => {
  const { success, data } = await CreateGameRequestSchema.safeParseAsync(
    req.body as TypeGame,
  );

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const result = createGame(data.type);

  if (data.type === "singleplayer") {
    runAgent({
      request: "create_player",
      player: undefined,
      message: "",
      gameState: result.data,
    });
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

io.on("connection", (socket) => {
  const { idGame } = socket.handshake.auth;
  sendGameState(idGame);

  socket.on("play/" + idGame, async (data) => {
    const { success, data: playRequest } =
      await PlayRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { column, id_game, id_player } = playRequest;

    const { error } = doPlaySocket(column, id_player, id_game);

    if (error) {
      io.emit(`play_error/${id_game}/${id_player}`, error);
      return;
    }

    const updatedGame = getGameById(id_game);
    if (
      updatedGame?.game.type === "singleplayer" &&
      updatedGame.game.state !== "finish"
    ) {
      const botPlayer = getBotByGame(updatedGame.game);
      runAgent({
        request: "play_game",
        player: botPlayer ?? undefined,
        message: "Te toca jugar",
        gameState: updatedGame,
      });
    }
  });

  socket.on("reset_game/" + idGame, () => {
    resetGame(idGame);
    sendGameState(idGame);
  });

  socket.on("message/" + idGame, async (data) => {
    const { success, data: messageRequest } =
      await MessageRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { id_game, message, id_player } = messageRequest;
    sendMessage(id_game, id_player, message);

    const game = getGameById(idGame);
    if (game?.game.type == "singleplayer") {
      const botPlayer = getBotByGame(game.game);

      runAgent({
        request: "send_message",
        player: botPlayer ?? undefined,
        message: message,
        gameState: game,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});
