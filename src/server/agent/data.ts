import type { Bots, Game } from "../types/game.types.js";

let bots: Bots[] = [];

export const createBot = (
  id: string,
  name: string,
  personality: string,
  smart: number,
): Bots => {
  const bot: Bots = {
    id: id,
    name: name,
    personality: personality,
    smart: smart,
  };
  bots.push(bot);
  return bot;
};

export const getBotById = (id: string): Bots | undefined => {
  return bots.find((b) => b.id === id);
};

export const getBotByGame = (game: Game): Bots | undefined => {
  const botGame = game.players.findLast((p) => p.type == "bot");
  if (botGame == undefined) return undefined;
  return bots.find((b) => b.id == botGame.id);
};
