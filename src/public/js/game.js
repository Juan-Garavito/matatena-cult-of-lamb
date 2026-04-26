import { SoundManager } from './sounds.js';
import { animateDice, createCellDiceFace } from './dice.js';
import {
  displayMessage,
  updateTurnStatus,
  hideStatus,
  showGameResult,
  showWaitingForPlayer,
  showSpeechBubble,
} from './ui.js';

let currentPlayer = null;
let gameId = null;
let gameState = null;
let previousTables = [null, null];

SoundManager.init();

(function loadPlayerName() {
  const playerJSON = localStorage.getItem("player");
  if (playerJSON) {
    try {
      const player = JSON.parse(playerJSON);
      const nameEl = document.querySelector("[data-current-player-name]");
      if (nameEl) nameEl.textContent = player.name;
    } catch (e) {}
  }
})();

try {
  gameId = localStorage.getItem("currentGameId");
  currentPlayer = JSON.parse(localStorage.getItem("player") ?? "");
  if (!gameId || !currentPlayer || !currentPlayer.id) window.location.href = "/";
} catch (e) {
  window.location.href = "/";
}

const baseUrl = window.ENV ? window.ENV.API_URL : "";
const socket = io(baseUrl, { auth: { idGame: gameId } });

function getNewlyPlacedCells(oldTable, newTable) {
  const newCells = [];
  if (!oldTable || !newTable) return newCells;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < (newTable[col]?.length || 0); row++) {
      const oldVal = oldTable[col]?.[row] ?? -1;
      const newVal = newTable[col]?.[row] ?? -1;
      if (oldVal === -1 && newVal !== -1) newCells.push({ col, row });
    }
  }
  return newCells;
}

function playColumn(columnIndex) {
  socket.emit("play/" + gameId, {
    column: columnIndex,
    id_game: gameId,
    id_player: currentPlayer.id,
  });
}

function renderGame(game) {
  updateTurnStatus(game);

  const playerSections = document.querySelectorAll(".player-section");
  const newCellsByPlayer = [[], []];

  for (let pIdx = 0; pIdx < game.players.length; pIdx++) {
    if (previousTables[pIdx] && game.players[pIdx]) {
      newCellsByPlayer[pIdx] = getNewlyPlacedCells(previousTables[pIdx], game.players[pIdx].table);
    }
  }

  playerSections.forEach((section, index) => {
    const player = game.players[index];
    if (!player) return;

    const nameEl = section.querySelector(".player-name");
    if (nameEl) nameEl.textContent = player.name;

    const scoreEl = section.querySelector(".player-score");
    if (scoreEl) scoreEl.textContent = `${player.totalPoints || 0} pts`;

    const tableGrid = section.querySelector(".table-grid");
    tableGrid.innerHTML = "";

    for (let colIdx = 0; colIdx < 3; colIdx++) {
      const col = document.createElement("div");
      col.className = "column";
      col.setAttribute("data-player", index);
      col.setAttribute("data-column", colIdx);

      const columnData = player.table?.[colIdx] || [];
      const freq = {};
      columnData.forEach((val) => {
        if (val !== -1) freq[val] = (freq[val] || 0) + 1;
      });

      const values = document.createElement("div");
      values.className = "column-values";

      if (columnData.length > 0) {
        columnData.forEach((val, rowIdx) => {
          const item = document.createElement("div");
          item.className = "value-item";
          if (val === -1) {
            item.classList.add("empty");
            item.textContent = "···";
          } else {
            item.classList.add("occupied");
            const isNew = newCellsByPlayer[index].some((c) => c.col === colIdx && c.row === rowIdx);
            const diceFace = createCellDiceFace(val, isNew);
            if (freq[val] > 1) diceFace.classList.add("dice-multiplied");
            item.appendChild(diceFace);
          }
          values.appendChild(item);
        });
      } else {
        const item = document.createElement("div");
        item.className = "value-item empty";
        item.textContent = "···";
        values.appendChild(item);
      }

      const points = document.createElement("div");
      points.className = "column-points";
      let colPoints = 0;
      Object.entries(freq).forEach(([value, count]) => {
        colPoints += Number(value) * count * count;
      });
      points.textContent = colPoints > 0 ? `+${colPoints} pts` : "0 pts";

      col.appendChild(values);
      col.appendChild(points);
      col.addEventListener("click", () => {
        if (!col.classList.contains("disabled")) playColumn(colIdx);
      });
      tableGrid.appendChild(col);
    }
  });

  for (let pIdx = 0; pIdx < game.players.length; pIdx++) {
    previousTables[pIdx] = game.players[pIdx].table.map((col) => [...col]);
  }
}

function resetGame() {
  socket.emit("reset_game/" + gameId);
}
window.resetGame = resetGame;

function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit("message/" + gameId, { id_game: gameId, message: msg, id_player: currentPlayer.id });
  input.value = "";
}

// --- Socket events ---

socket.on("game_state/" + gameId, (game) => {
  if (!game || !game.players) return;
  SoundManager.play('wood');
  gameState = game;

  if (game.state === "waiting") {
    showWaitingForPlayer(game, gameId);
    return;
  }

  if (game.state === "finish") {
    renderGame(game);
    showGameResult(game);
    return;
  }

  hideStatus();
  renderGame(game);
  setTimeout(() => {
    animateDice(game.dice, game.turn)
    SoundManager.play('dice');
  }, 600);
});

socket.on("play_error/" + gameId + "/" + currentPlayer.id, (errorMsg) => {
  SoundManager.play('message');
  displayMessage(errorMsg || "Hubo un error en el ritual.", "error");
});

socket.on("message/" + gameId, ({ message, id_player }) => {
  if (!gameState) return;
  const playerIndex = gameState.players.findIndex((p) => p.id === id_player);
  if (playerIndex === -1) return;
  SoundManager.play('message');
  showSpeechBubble(playerIndex, message);
});

socket.on("connect", () => {
  const loading = document.getElementById("ritualLoading");
  if (loading) {
    loading.classList.add("hidden");
    setTimeout(() => loading.remove(), 800);
  }
});

socket.on("connect_error", () => {
  window.location.href = "/";
  localStorage.removeItem("currentGameId");
  localStorage.removeItem("player");
});

// --- UI bindings ---

const messageInput = document.getElementById("messageInput");
const messageSendBtn = document.getElementById("messageSendBtn");
if (messageInput) messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
if (messageSendBtn) messageSendBtn.addEventListener("click", sendMessage);
