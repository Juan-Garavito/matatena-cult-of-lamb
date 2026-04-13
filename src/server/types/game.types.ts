import { z } from "zod";
import { GameSchema , JoinGameRequestSchema} from "./game.schema.js";

export type Player = z.infer<typeof GameSchema>["game"]["players"][0];

export type State = z.infer<typeof GameSchema>["game"]["state"];

export type Dice = z.infer<typeof GameSchema>["game"]["dice"];

export type Points = z.infer<typeof GameSchema>["game"]["players"][0]["points"];

export type Table = z.infer<typeof GameSchema>["game"]["players"][0]["table"];

export type Game = z.infer<typeof GameSchema>["game"];

export type GameWrapper = z.infer<typeof GameSchema>;

export type JoinGameRequest = z.infer<typeof JoinGameRequestSchema>;