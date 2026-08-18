import z from "zod";
import { id } from "zod/locales";

export const GameSchema = z.object({
  id_game: z.uuid(),
  game: z.object({
    players: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          table: z
            .array(z.array(z.number().min(-1).max(6)).length(3))
            .length(3),
          points: z.object({
            col1: z.number(),
            col2: z.number(),
            col3: z.number(),
          }),
          totalPoints: z.number(),
          type: z.literal(["human", "bot"]),
          // Only bots carry these; they drive how the agent plays and talks.
          personality: z.string().optional(),
          smart: z.number().min(1).max(10).optional(),
        }),
      )
      .length(2),
    turn: z.number().min(0).max(1),
    state: z.literal(["playing", "finish", "waiting"]),
    winner: z.uuid().nullable(),
    dice: z.number().min(1).max(6),
    type: z.literal(["multiplayer", "singleplayer"]),
  }),
});

export const JoinGameRequestSchema = z.object({
  id_game: z.string(),
  playerName: z.string().min(1),
});

export const PlayRequestSchema = z.object({
  column: z.number().min(0).max(2),
  id_game: z.string(),
  id_player: z.string(),
});

export const CreateGameRequestSchema = z.object({
  type: z.literal(["multiplayer", "singleplayer"]),
});

export const MessageRequestSchema = z.object({
  id_game: z.string(),
  message: z.string().min(1),
  id_player: z.string(),
});

export const BotsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  personality: z.string(),
  smart: z.number().min(1).max(10),
});

export const PlayerSchema = GameSchema.shape.game.shape.players.element;
