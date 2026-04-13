import type { GameWrapper, Table, Player, Game } from "./types/game.types.js";
import { randomUUID } from "crypto";

let games : GameWrapper[] = [

];

const getAllGames = () : GameWrapper[] => games;

const getGameById = (id_game : string) : GameWrapper | undefined => games.find(g => g.id_game == id_game);

const resetGame = (id_game : string) : void => {
  const gameWrapper = games.find(g => g.id_game === id_game);
  if (!gameWrapper) {
    return;
  }
  gameWrapper.game.players.forEach(player => {
    player.table = [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]];
    player.points = {
      col1: 0,
      col2: 0,
      col3: 0
    };
    player.totalPoints = 0;
  });
  gameWrapper.game.turn = Math.floor(Math.random() * 2);
  gameWrapper.game.state = "playing";
  gameWrapper.game.winner = null;
  gameWrapper.game.dice = updateDice();
};

const createGame = () : {ok: boolean, error?: string, data?: GameWrapper} => {
  const newGame : GameWrapper = {
    id_game: 'ritual_' + Date.now() + '_' + randomUUID(),
    game: {
      players: [],
      turn: Math.floor(Math.random() * 2),
      state: "waiting",
      winner: null,
       dice: updateDice()
    }
   
  };

  games.push(newGame);
  return { ok: true, data: newGame };
};

const deleteGame = (id_game : string) : {ok: boolean, error?: string, message?: string} => {
  const index = games.findIndex(g => g.id_game === id_game);
  
  if (index === -1) {
    return { ok: false, error: "Juego no encontrado." };
  }

  games.splice(index, 1);
  return { ok: true, message: `Juego ${id_game} eliminado.` };
};


const checkFinish = (table : Table) => {
  return !table.flat().includes(-1) ? "finish" : "playing";
};

const checkWinner = (id_game : string) : Player | null => {
  const gameWrapper = games.find(g => g.id_game === id_game);
  
  if (!gameWrapper) {
    return null;
  }

  const player1 = gameWrapper.game.players[0];
  const player2 = gameWrapper.game.players[1];

  if (!player1 || !player2) {
    return null;
  }
  
  return player1.totalPoints > player2.totalPoints ? player1 : player2;
};

const validatePlay = (column: number, id_game: string, id_player: string) => {
  const gameWrapper = games.find(g => g.id_game === id_game);

  if (!gameWrapper) {
    return { ok: false as const, error: "Juego no encontrado." };
  }

  const game = gameWrapper.game;

  if (game.state === "finish") {
    return { ok: false as const, error: "El juego ha terminado." };
  }

  if (game.state === "waiting") {
    return { ok: false as const, error: "El juego no ha comenzado." };
  }

  if (column < 0 || column > 2) {
    return { ok: false as const, error: "Columna inválida." };
  }

  const player = game.players[game.turn];
  const opponent = game.players[game.turn === 0 ? 1 : 0];

  if (!player || !opponent) {
    return { ok: false as const, error: "Jugador no encontrado." };
  }

  if (player.id !== id_player) {
    return { ok: false as const, error: "No es tu turno." };
  }

  const col = player.table[column];

  if (!col) {
    return { ok: false as const, error: "Columna inválida." };
  }

  const index = col.findIndex(cell => cell === -1);

  if (index === -1) {
    return { ok: false as const, error: "Columna llena." };
  }

  return {
    ok: true as const,
    data: {
      player,
      col,
      index,
      game,
      opponent
    }
  };
};

const updatePoints = (column : number, id_game : string) : void => {
  const gameWrapper = games.find(g => g.id_game === id_game);

  if (!gameWrapper) {
    return;
  }

  const game = gameWrapper.game;
  game.players.forEach(player =>{
    const col = player.table[column];
    if (!col) return;

    let columnPoints = 0;
    
    const validValues = col.filter(cell => cell !== -1);
    
    const colKey = `col${column + 1}` as keyof Player["points"];

    if (validValues.length === 0) {
      player.points[colKey] = 0;
      updateTotalPoints(player.id, id_game);
      return;
    }
    
    const frequency: Record<number, number> = {};
    validValues.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    
    Object.entries(frequency).forEach(([value, count]) => {
      columnPoints += Number(value) * count * count;
    });

    player.points[colKey] = columnPoints;
    updateTotalPoints(player.id, id_game);
  });
 
};

const updateDice = () : number => {
  return Math.floor(Math.random() * 6) + 1;
}

const erasePointsOpponent = (column : number, value : number, id_player: string, id_game : string) : void => {
  const gameWrapper = games.find(g => g.id_game === id_game);

  if (!gameWrapper) {
    return;
  }

  const game = gameWrapper.game;
  const player = game.players.find(p => p.id === id_player);
  if (!player) return;

  const col = player.table[column];
  if (!col) return;

  const newValues = col.map((cell) => cell === value ? -1 : cell);
  
  player.table[column] = newValues;
  updatePoints(column, id_game);
}

const updateTotalPoints = (id_player: string, id_game : string) : void => {
  const gameWrapper = games.find(g => g.id_game === id_game);

  if (!gameWrapper) {
    return;
  }

  const game = gameWrapper.game;
  const player = game.players.find(p => p.id === id_player);
  if (!player) return;
  const total = Object.values(player.points).reduce((sum, col) => sum + col, 0);
  player.totalPoints = total;
};


const doPlay = (
  column: number,
  id_player: string,
  id_game: string
) => {
  const {ok, error, data} = validatePlay(column, id_game, id_player);

  if (!ok) {
    return { ok: false, error: error };
  }

  const { player, col, index , game, opponent } = data;
  const value = game.dice;
  col[index] = value;

  
  console.log(`Jugada: id_game=${id_game}, column=${column}, dice=${value}`);
  erasePointsOpponent(column, value, opponent.id, id_game);
  updatePoints(column, id_game);

  game.state = checkFinish(player.table)

  if (game.state === "finish") {
    const winner = checkWinner(id_game);
    game.winner = winner ? winner.id : null;
    return { ok: true, gameState: game };
  }

  game.turn = game.turn === 0 ? 1 : 0;
  game.dice = updateDice();

  return { ok: true, gameState: game };
};


const createPlayer = (name : string) : Player => {
  return  {
    id: randomUUID(),
    name: name,
    table: [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]],
    points: {
      col1: 0,
      col2: 0,
      col3: 0
    },
    totalPoints: 0
  };
};


export {
  getAllGames,
  getGameById,
  createGame,
  deleteGame,
  doPlay,
  checkFinish,
  checkWinner,
  updatePoints,
  updateTotalPoints,
  createPlayer,
  resetGame
};
