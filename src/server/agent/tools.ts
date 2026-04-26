import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createPlayer, getGameById } from "../game.js";
import { createBot } from "./data.js";
import { PlayerSchema } from "../types/game.schema.js";
import { readFile } from "fs/promises";
import { doPlaySocket, sendGameState, sendMessage } from "../socket.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const createPlayerAgent = tool(
  ({ name, personality, smart }) => {
    const player = createPlayer(name, "bot");
    createBot(player.id, name, personality, smart);
    return player;
  },
  {
    name: "create_player",
    description: "Create a new bot player with a name, personality, and smart level. Returns the player object.",
    schema: z.object({
      name: z.string().describe("Invented unique name for the bot."),
      personality: z.string().describe("Short personality description (e.g. 'aggressive', 'cautious', 'chaotic')."),
      smart: z.number().min(1).max(10).describe("Intelligence level from 1 (random moves) to 10 (optimal strategy)."),
    }),
  },
);

export const JoinToGameAgent = tool(
  ({ id_game, player }) => {
    const wrapper = getGameById(id_game);
    if (!wrapper) return "No existe la partida con el id proporcionado";
    wrapper.game.players.push(player);
    if (wrapper.game.players.length === 2) {
      wrapper.game.state = "playing";
    }
    sendGameState(id_game);
    return "Jugador unido a la partida correctamente";
  },
  {
    name: "join_game",
    description: "Join an existing game using the player returned by create_player.",
    schema: z.object({
      id_game: z.string().describe("The game ID provided in the user message."),
      player: PlayerSchema.describe("The full player object returned by create_player."),
    }),
  },
);

export const playGameAgent = tool(
  ({ column, id_player, id_game }) => {
    const result = doPlaySocket(column, id_player, id_game);
    if (result.error) {
      return { error: result.error, gameState: null };
    }

    return { gameState: result.gameState, error: null };
  },
  {
    name: "play_game",
    description: "Place your dice in a column (0, 1, or 2) to make your move.",
    schema: z.object({
      column: z.number().min(0).max(2).describe("Column index: 0 (left), 1 (center), 2 (right). Must have fewer than 3 dice."),
      id_player: z.string().describe("Your player ID — found in 'Your player id' field."),
      id_game: z.string().describe("The game ID — found in 'Game id' field."),
    }),
  },
);

export const sendMessageAgent = tool(
  ({ message, id_player, id_game }) => {
    console.log("message agent: " + message);
    console.log;
    sendMessage(id_game, id_player, message);
    return "Mensaje enviado correctamente";
  },
  {
    name: "send_message",
    description: "Send a chat message to the other player in the game.",
    schema: z.object({
      message: z.string().describe("The message text to send. Match your bot personality."),
      id_player: z.string().describe("Your player ID — found in 'Your player id' field."),
      id_game: z.string().describe("The game ID — found in 'Game id' field."),
    }),
  },
);

export const readRulesGameAgent = tool(
  async ({}) => {
    const filePath = path.join(__dirname, "rules.game.md");
    const rules = await readFile(filePath, "utf-8");
    return rules;
  },
  {
    name: "read_rules",
    description: "Read the Matatena game rules. Call this once before playing if you are unsure how to choose a column.",
    schema: z.object({}),
  },
);
