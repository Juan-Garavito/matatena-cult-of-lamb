import "dotenv/config";
import express from "express";
import http from "http";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import {
  doPlaySocket,
  sendMessage,
  sendGameState,
  sendError,
  notifyGameClosed,
} from "./socket.js";
import {
  createGame,
  createPlayer,
  getGameById,
  resetGame,
  addPlayerToGame,
  deleteGame,
} from "./game.js";
import { DbUnavailableError } from "./db/errors.js";
import type { Player, JoinGameRequest, TypeGame } from "./types/game.types.js";
import {
  CreateGameRequestSchema,
  JoinGameRequestSchema,
  MessageRequestSchema,
  PlayRequestSchema,
} from "./types/game.schema.js";
import { runAgentWithFallback } from "./agent/recovery.js";
import { getBotByGame } from "./agent/data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resolveStaticDir = (): string => {
  const candidates = [
    path.join(__dirname, "../public"),
    path.join(process.cwd(), "src/public"),
  ];

  return candidates.find((dir) => existsSync(dir)) ?? candidates[0]!;
};

const staticDir = resolveStaticDir();

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(express.static(staticDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

app.get("/js/env.js", (req, res) => {
  res.type("application/javascript");
  res.send(
    `window.ENV = { API_URL: '${API_URL}', SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}' };`,
  );
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
      void runAgentWithFallback({
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

app.get("/game/:idGame", async (req, res) => {
  const { idGame } = req.params;

  try {
    const gameWrapper = await getGameById(idGame);

    if (!gameWrapper) {
      return res.status(404).json({ error: "La partida no existe" });
    }

    return res.json({ game: gameWrapper.game });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

app.post("/leave-game/:idGame", async (req, res) => {
  const { idGame } = req.params;

  try {
    // Broadcast before deleting so any client still subscribed gets the signal.
    await notifyGameClosed(idGame);
    await deleteGame(idGame);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

app.post("/play/:idGame", async (req, res) => {
  const { success, data: playRequest } = await PlayRequestSchema.safeParseAsync(
    req.body,
  );

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const { column, id_game, id_player } = playRequest;

  try {
    const { error } = await doPlaySocket(column, id_player, id_game);

    if (error) {
      await sendError(id_game, id_player, error);
      return res.status(400).json({ error });
    }

    const updatedGame = await getGameById(id_game);
    if (
      updatedGame?.game.type === "singleplayer" &&
      updatedGame.game.state !== "finish"
    ) {
      const botPlayer = getBotByGame(updatedGame.game);
      void runAgentWithFallback({
        request: "play_game",
        player: botPlayer ?? undefined,
        message: "Te toca jugar",
        gameState: updatedGame,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      await sendError(id_game, id_player, "Servicio no disponible");
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

app.post("/reset-game/:idGame", async (req, res) => {
  const { idGame } = req.params;
  const { idPlayer } = req.body;

  try {
    const result = await resetGame(idGame);
    if (!result.ok) return res.status(400).json({ error: result.error });
    await sendGameState(idGame);
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      await sendError(idGame, idPlayer, "Servicio no disponible");
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

app.post("/message/:idGame", async (req, res) => {
  const { idGame } = req.params;
  const { success, data: messageRequest } =
    await MessageRequestSchema.safeParseAsync(req.body);

  if (!success) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const { id_game, message, id_player } = messageRequest;

  try {
    await sendMessage(id_game, id_player, message);

    const game = await getGameById(idGame);
    if (game?.game.type == "singleplayer") {
      const botPlayer = getBotByGame(game.game);

      void runAgentWithFallback({
        request: "send_message",
        player: botPlayer ?? undefined,
        message: message,
        gameState: game,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      await sendError(idGame, id_player, "Servicio no disponible");
      return res
        .status(503)
        .json({ error: "Servicio no disponible, intenta más tarde." });
    }
    throw error;
  }
});

// io.on("connection", async (socket) => {
//   const { idGame } = socket.handshake.auth;

//   try {
//     await sendGameState(idGame);
//   } catch (error) {
//     if (error instanceof DbUnavailableError) {
//       await sendError(
//         idGame,
//         socket.handshake.auth.idPlayer,
//         "Servicio no disponible",
//       );
//     } else {
//       throw error;
//     }
//   }

//   socket.on("disconnect", () => {
//     console.log("Cliente desconectado:", socket.id);
//   });
// });
