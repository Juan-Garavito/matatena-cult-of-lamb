import z from "zod";

export const GameSchema = z.object({
    id_game: z.uuid(),
    game: z.object({
        players: z.array(z.object({
            id: z.uuid(),
            name: z.string(),
            table: z.array(z.array(z.number().min(-1).max(6)).length(3)).length(3),
            points: z.object({
                col1: z.number(),
                col2: z.number(),
                col3: z.number()
            }),
            totalPoints: z.number()
        })).length(2),
        turn: z.number().min(0).max(1),
        state: z.literal(["playing", "finish", "waiting"]),
        winner: z.uuid().nullable(),
        dice: z.number().min(1).max(6)
    })
})

export const JoinGameRequestSchema = z.object({
  id_game: z.string(),
  playerName: z.string().min(1),
});


export const PlayRequestSchema = z.object({
  column: z.number().min(0).max(2),
  id_game: z.string(),
  id_player: z.string(),
});



