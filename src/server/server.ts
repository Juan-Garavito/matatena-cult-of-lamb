import "dotenv/config";
import express from "express";
import http from "http";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { doPlaySocket, sendMessage, initIO, sendGameState } from "./socket.js";
import {
  createGame,
  createPlayer,
  getGameById,
  resetGame,
  addPlayerToGame,
} from "./game.js";
import { DbUnavailableError } from "./db/errors.js";
import type {
  Player,
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

  try {
    const result = await createGame(data.type);

    if (result.ok && data.type === "singleplayer") {
      runAgent({
        request: "create_player",
        player: undefined,
        message: "",
        gameState: result.data,
      }).catch((e) => console.error("runAgent create_player failed:", e));
    }

    if (result.ok) {
      res.json({ gameId: result.data?.id_game });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

app.post("/join-game", async (req, res) => {
  const { success, data } = await JoinGameRequestSchema.safeParseAsync(
    req.body as JoinGameRequest,
  );

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const newPlayer: Player = createPlayer(data.playerName, "human");

  try {
    const result = await addPlayerToGame(data.id_game, newPlayer);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      player: { id: newPlayer.id, name: newPlayer.name },
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

io.on("connection", async (socket) => {
  const { idGame } = socket.handshake.auth;

  try {
    await sendGameState(idGame);
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      io.emit("server_error/" + idGame, "Servicio no disponible");
    } else {
      throw error;
    }
  }

  socket.on("play/" + idGame, async (data) => {
    const { success, data: playRequest } =
      await PlayRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { column, id_game, id_player } = playRequest;

    try {
      const { error } = await doPlaySocket(column, id_player, id_game);

      if (error) {
        io.emit(`play_error/${id_game}/${id_player}`, error);
        return;
      }

      const updatedGame = await getGameById(id_game);
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
    } catch (error) {
      if (error instanceof DbUnavailableError) {
        io.emit("server_error/" + id_game, "Servicio no disponible");
        return;
      }
      throw error;
    }
  });

  socket.on("reset_game/" + idGame, async () => {
    try {
      const result = await resetGame(idGame);
      if (!result.ok) return;
      await sendGameState(idGame);
    } catch (error) {
      if (error instanceof DbUnavailableError) {
        io.emit("server_error/" + idGame, "Servicio no disponible");
        return;
      }
      throw error;
    }
  });

  socket.on("message/" + idGame, async (data) => {
    const { success, data: messageRequest } =
      await MessageRequestSchema.safeParseAsync(data);

    if (!success) {
      return;
    }

    const { id_game, message, id_player } = messageRequest;
    sendMessage(id_game, id_player, message);

    try {
      const game = await getGameById(idGame);
      if (game?.game.type == "singleplayer") {
        const botPlayer = getBotByGame(game.game);

        runAgent({
          request: "send_message",
          player: botPlayer ?? undefined,
          message: message,
          gameState: game,
        });
      }
    } catch (error) {
      if (error instanceof DbUnavailableError) {
        io.emit("server_error/" + idGame, "Servicio no disponible");
        return;
      }
      throw error;
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});
