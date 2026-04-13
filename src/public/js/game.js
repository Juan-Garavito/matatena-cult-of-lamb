let currentPlayer = null;
let gameId = null;
let gameState = null;
let previousTables = [null, null];

(function loadPlayerName() {
  const playerJSON = localStorage.getItem("player");
  if (playerJSON) {
    try {
      const player = JSON.parse(playerJSON);
      const nameEl = document.querySelector(
        "[data-current-player-name]",
      );
      if (nameEl) nameEl.textContent = player.name;
    } catch (e) {
      console.error("Error loading player name:", e);
    }
  }
})();

const DICE_DOT_MAP = {
  1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  2: [0, 0, 1, 0, 0, 0, 1, 0, 0],
  3: [0, 0, 1, 0, 1, 0, 1, 0, 0],
  4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
};

try {
gameId = localStorage.getItem("currentGameId");
currentPlayer = JSON.parse(localStorage.getItem("player") ?? "");

if (!gameId || !currentPlayer || !currentPlayer.id) {
  window.location.href = "/";
}
} catch (e) {
  window.location.href = "/";
}

const baseUrl = window.ENV ? window.ENV.API_URL : "";
const socket = io(baseUrl, {
  auth: {
    idGame: gameId,
  },
});


function createDiceFaceHTML(value) {
  const dots = DICE_DOT_MAP[value] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let html = "";
  for (let i = 0; i < 9; i++) {
    const dotClass = dots[i] ? "dice-dot" : "dice-dot invisible";
    html += `<div class="dice-dot-slot"><div class="${dotClass}"></div></div>`;
  }
  return html;
}

function renderDiceFace(container, value, animate) {
  if (!container) return;
  container.innerHTML = createDiceFaceHTML(value);
  if (animate) {
    container.classList.remove("rolling");
    void container.offsetWidth;
    container.classList.add("rolling");
    setTimeout(() => container.classList.remove("rolling"), 650);
  }
}

function createCellDiceFace(value, shouldDrop) {
  const wrapper = document.createElement("div");
  wrapper.className =
    "cell-dice-face" + (shouldDrop ? " dice-drop" : "");
  wrapper.innerHTML = createDiceFaceHTML(value);
  if (shouldDrop) {
    setTimeout(() => wrapper.classList.remove("dice-drop"), 550);
  }
  return wrapper;
}

function animateDice(finalValue, turnIndex) {
  return new Promise((resolve) => {
    const diceFace = document.getElementById(
      `player${turnIndex + 1}DiceFace`,
    );
    if (!diceFace || !finalValue || finalValue < 1 || finalValue > 6) {
      resolve(finalValue === -1 ? 0 : finalValue);
      return;
    }

    let spinCount = 0;
    const spinInterval = setInterval(() => {
      const randomVal = Math.floor(Math.random() * 6) + 1;
      renderDiceFace(diceFace, randomVal, false);
      spinCount++;
    }, 60);

    setTimeout(() => {
      clearInterval(spinInterval);
      renderDiceFace(diceFace, finalValue, true);
      resolve(finalValue);
    }, 500);
  });
}

function displayMessage(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    console.error("Toast container not found.");
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-content">${msg}</div>`;

  container.appendChild(toast);

  // Trigger entering animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 400); // 400ms matches the CSS transition length
  }, 4000);
}

function getIsCurrentPlayerTurn() {
  const currentPlayerJSON = localStorage.getItem("player");
  if (!currentPlayerJSON || !gameState) {
    return false;
  }

  try {
    const currentPlayer = JSON.parse(currentPlayerJSON);
    const currentTurnPlayer = gameState.players[gameState.turn];
    return currentPlayer.id === currentTurnPlayer.id;
  } catch (e) {
    console.error("Error checking turn:", e);
    return false;
  }
}

function playColumn(columnIndex) {
  socket.emit("play/"+gameId, {
    column: columnIndex,
    id_game: gameId,
    id_player: currentPlayer.id,
  });
}

function updateTurnStatus() {
  if (!gameState) return;

  for (let i = 0; i < 2; i++) {
    const diceArea = document.getElementById(`player${i + 1}Dice`);
    if (!diceArea) continue;

    if (i === gameState.turn) {
      diceArea.classList.add("active-glow");
      const wrapper = diceArea.querySelector('.dice-face-wrapper');
      if (wrapper) wrapper.classList.remove("dice-hidden");
    } else {
      diceArea.classList.remove("active-glow");
      const wrapper = diceArea.querySelector('.dice-face-wrapper');
      if (wrapper) wrapper.classList.add("dice-hidden");
    }
  }

  const playerSections = document.querySelectorAll(".player-section");
  playerSections.forEach((section, index) => {
    const badge = section.querySelector(".player-turn-badge");
    const columns = section.querySelectorAll(".column");

    if (index === gameState.turn) {
      section.classList.remove("inactive");
      badge.classList.remove("inactive");
      badge.textContent = "TU TURNO";
      columns.forEach((col) => col.classList.remove("disabled"));
    } else {
      section.classList.add("inactive");
      badge.classList.add("inactive");
      badge.textContent = "ESPERANDO";
      columns.forEach((col) => col.classList.add("disabled"));
    }
  });
}

function getNewlyPlacedCells(oldTable, newTable) {
  const newCells = [];
  if (!oldTable || !newTable) return newCells;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < (newTable[col]?.length || 0); row++) {
      const oldVal = oldTable[col]?.[row] ?? -1;
      const newVal = newTable[col]?.[row] ?? -1;
      if (oldVal === -1 && newVal !== -1) {
        newCells.push({ col, row });
      }
    }
  }
  return newCells;
}

socket.on("game_state/"+gameId, (game) => {
  console.log(game);
  if (!game || !game.players) return;

  const newCellsByPlayer = [[], []];
  for (let pIdx = 0; pIdx < game.players.length; pIdx++) {
    if (previousTables[pIdx] && game.players[pIdx]) {
      newCellsByPlayer[pIdx] = getNewlyPlacedCells(
        previousTables[pIdx],
        game.players[pIdx].table,
      );
    }
  }

  gameState = game;

  if (game.state === "waiting") {
    showWaitingForPlayer();
    return;
  }

  if (game.state === "finish") {
    renderGame(game);
    showGameResult();
    return;
  }

  hideStatus();
  renderGame(game);
  
  setTimeout(() => {
    animateDice(game.dice, game.turn);
  }, 600);
});

function hideStatus() {
  const statusDiv = document.getElementById("gameStatus");
  if (statusDiv) {
    statusDiv.classList.remove("show");
  }
}

function renderGame(game) {
  updateTurnStatus();

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
    if (scoreEl) {
      const totalPoints = player.totalPoints || 0;
      scoreEl.textContent = `${totalPoints} pts`;
    }

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
            
            // Add GLOW if there are multiple dice of the same value in this column
            if (freq[val] > 1) {
              diceFace.classList.add("dice-multiplied");
            }

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
        if (!col.classList.contains("disabled")) {
          playColumn(colIdx);
        }
      });

      tableGrid.appendChild(col);
    }
  });

  for (let pIdx = 0; pIdx < game.players.length; pIdx++) {
    previousTables[pIdx] = game.players[pIdx].table.map((col) => [
      ...col,
    ]);
  }
}

socket.on("play_error/"+gameId+"/"+currentPlayer.id, (errorObj) => {
  const errorMsg = errorObj && errorObj.error ? errorObj.error : "Hubo un error en el ritual.";
  displayMessage(`${errorMsg}`, "error");
});

function showGameResult() {
  const statusDiv = document.getElementById("gameStatus");
  statusDiv.classList.add("show");
  
  const winner = gameState.players.find(p => p.id === gameState.winner);
  const loser = gameState.players.find(p => p.id !== gameState.winner);
  
  statusDiv.innerHTML = `
      <div class="modal-panel">
        <h2>✦ FIN DEL RITUAL ✦</h2>
        <p>${winner.name} ha sido coronado!</p>
        <p>${winner.name}: ${winner.totalPoints} pts | ${loser.name}: ${loser.totalPoints} pts</p>
        <button class="back-button btn-lamb" onclick="location.href='index.html'">VOLVER AL ALTAR</button>
        <button class="back-button btn-lamb" onclick="resetGame()">JUGAR DE NUEVO</button>
      </div>
      `;
}

function showWaitingForPlayer() {
  const statusDiv = document.getElementById("gameStatus");
  statusDiv.classList.add("show");
  statusDiv.innerHTML = `
      <div class="modal-panel">
        <h2>✦ ESPERANDO A LOS DEMÁS ADEPTOS ✦</h2>
        <p>El ritual aún no está completo. Comparte el ID de esta sala con tu oponente:</p>
        <p style="font-size: 1.5rem; font-weight: bold; margin: 1rem 0; color: var(--gold);">${gameId}</p>
        <button class="back-button btn-lamb" onclick="location.href='index.html'">VOLVER AL INICIO</button>
      </div>
      `;
}

function resetGame() {
  socket.emit("reset_game/"+gameId);
}


socket.on("connect", () => {
  const loading = document.getElementById("ritualLoading");
  if (loading) {
    loading.classList.add("hidden");
    // Optionally remove from DOM after transition
    setTimeout(() => loading.remove(), 800);
  }
});

socket.on("connect_error", (err) => {
  window.location.href = "/";
  localStorage.removeItem("currentGameId");
  localStorage.removeItem("player");
});
