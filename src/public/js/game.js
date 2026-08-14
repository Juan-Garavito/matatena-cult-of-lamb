import { SoundManager } from "./sounds.js";
import { animateDice, createCellDiceFace } from "./dice.js";
import {
  displayMessage,
  updateTurnStatus,
  hideStatus,
  showGameResult,
  showWaitingForPlayer,
  showSpeechBubble,
} from "./ui.js";
import { supabase } from "./supabase.js";

let currentPlayer = null;
let gameId = null;
let gameState = null;
let previousTables = [null, null];
let leaving = false;

const baseUrl = window.ENV ? window.ENV.API_URL : "";

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

(function loadGame() {
  try {
    gameId = localStorage.getItem("currentGameId");
    currentPlayer = JSON.parse(localStorage.getItem("player") ?? "");
    if (!gameId || !currentPlayer || !currentPlayer.id) leaveGame();
  } catch (e) {
    leaveGame();
  }
})();

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

function renderGame(game) {
  updateTurnStatus(game);

  const playerSections = document.querySelectorAll(".player-section");
  const newCellsByPlayer = [[], []];

  for (let pIdx = 0; pIdx < game.players.length; pIdx++) {
    if (previousTables[pIdx] && game.players[pIdx]) {
      newCellsByPlayer[pIdx] = getNewlyPlacedCells(
        previousTables[pIdx],
        game.players[pIdx].table,
      );
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
            const isNew = newCellsByPlayer[index].some(
              (c) => c.col === colIdx && c.row === rowIdx,
            );
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

function playColumn(columnIndex) {
  fetch(`${baseUrl}/play/${gameId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_game: gameId,
      id_player: currentPlayer.id,
      column: columnIndex,
    }),
  });
}

function resetGame() {
  fetch(`${baseUrl}/reset-game/${gameId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_game: gameId,
      id_player: currentPlayer.id,
    }),
  });
}
window.resetGame = resetGame;

function clearStoredGame() {
  localStorage.removeItem("currentGameId");
  localStorage.removeItem("player");
}

function leaveGame() {
  leaving = true;
  clearStoredGame();
  window.location.href = "/";
}
window.leaveGame = leaveGame;

async function closeGameAndLeave() {
  leaving = true;
  try {
    if (gameId) {
      await fetch(`${baseUrl}/leave-game/${gameId}`, { method: "POST" });
    }
  } catch (e) {}
  leaveGame();
}

window.closeGameAndLeave = closeGameAndLeave;

window.addEventListener("beforeunload", () => {
  if (leaving || !gameId) return;
  navigator.sendBeacon(`${baseUrl}/leave-game/${gameId}`);
});

function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  fetch(`${baseUrl}/message/${gameId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_game: gameId,
      id_player: currentPlayer.id,
      message: msg,
    }),
  });
  input.value = "";
}

function hideLoading() {
  const loading = document.getElementById("ritualLoading");
  if (!loading) return;
  loading.classList.add("hidden");
  setTimeout(() => loading.remove(), 800);
}

function applyGameState(game) {
  if (!game || !game.players) return;
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
}

async function loadInitialState() {
  try {
    const res = await fetch(`${baseUrl}/game/${gameId}`);
    if (res.status === 404) {
      leaveGame();
      return;
    }
    if (!res.ok) return;
    const { game } = await res.json();
    applyGameState(game);
  } catch (e) {}
}

const channel = supabase.channel(gameId, {
  config: { presence: { key: currentPlayer?.id } },
});

channel
  .on("broadcast", { event: "game_state" }, ({ payload: game }) => {
    if (!game || !game.players) return;
    SoundManager.play("wood");
    applyGameState(game);

    if (game.state === "playing") {
      setTimeout(() => {
        animateDice(game.dice, game.turn);
        SoundManager.play("dice");
      }, 600);
    }
  })
  .on(
    "broadcast",
    { event: "play_error/" + currentPlayer.id },
    ({ payload }) => {
      SoundManager.play("message");
      displayMessage(payload?.error || "Hubo un error en el ritual.", "error");
    },
  )
  .on("broadcast", { event: "agent_unavailable" }, ({ payload }) => {
    SoundManager.play("message");
    displayMessage(
      payload?.message || "El oponente no está disponible.",
      "error",
    );
  })
  .on("broadcast", { event: "message" }, ({ payload }) => {
    const { message, id_player } = payload ?? {};
    if (!gameState) return;
    const playerIndex = gameState.players.findIndex((p) => p.id === id_player);
    if (playerIndex === -1) return;
    SoundManager.play("message");
    showSpeechBubble(playerIndex, message);
  })
  .on("broadcast", { event: "game_closed" }, () => {
    if (leaving) return;
    leaving = true;
    displayMessage("El rival abandonó el ritual. La partida terminó.", "error");
    setTimeout(() => leaveGame(), 1500);
  })
  .on("presence", { event: "join" }, ({ key, newPresences }) => {
    console.log("presence join", key, newPresences);
  })
  .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
    console.log("presence leave", key, leftPresences);
    if (leaving) return;
    closeGameAndLeave();
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      hideLoading();
      await channel.track({ id: currentPlayer?.id, name: currentPlayer?.name });
      loadInitialState();
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      leaveGame();
    }
  });

const messageInput = document.getElementById("messageInput");
const messageSendBtn = document.getElementById("messageSendBtn");
if (messageInput)
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
if (messageSendBtn) messageSendBtn.addEventListener("click", sendMessage);
