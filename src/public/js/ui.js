const speechBubbleTimers = [null, null];

export function displayMessage(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-content">${msg}</div>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

export function updateTurnStatus(gameState) {
  if (!gameState) return;

  for (let i = 0; i < 2; i++) {
    const diceArea = document.getElementById(`player${i + 1}Dice`);
    if (!diceArea) continue;
    const wrapper = diceArea.querySelector('.dice-face-wrapper');
    if (i === gameState.turn) {
      diceArea.classList.add("active-glow");
      if (wrapper) wrapper.classList.remove("dice-hidden");
    } else {
      diceArea.classList.remove("active-glow");
      if (wrapper) wrapper.classList.add("dice-hidden");
    }
  }

  document.querySelectorAll(".player-section").forEach((section, index) => {
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

export function hideStatus() {
  document.getElementById("gameStatus")?.classList.remove("show");
}

export function showGameResult(gameState) {
  const statusDiv = document.getElementById("gameStatus");
  statusDiv.classList.add("show");

  const winner = gameState.players.find(p => p.id === gameState.winner);
  const loser = gameState.players.find(p => p.id !== gameState.winner);

  statusDiv.innerHTML = `
    <div class="modal-panel">
      <h2>✦ FIN DEL RITUAL ✦</h2>
      <p>${winner.name} ha sido coronado!</p>
      <p>${winner.name}: ${winner.totalPoints} pts | ${loser.name}: ${loser.totalPoints} pts</p>
      <button class="back-button btn-lamb" onclick="window.closeGameAndLeave()">VOLVER AL ALTAR</button>
      <button class="back-button btn-lamb" onclick="window.resetGame()">JUGAR DE NUEVO</button>
    </div>`;
}

export function showWaitingForPlayer(gameState, gameId) {
  const statusDiv = document.getElementById("gameStatus");
  statusDiv.classList.add("show");
  const isSolo = gameState?.type === "singleplayer";
  statusDiv.innerHTML = isSolo
    ? `<div class="modal-panel">
        <h2>✦ INVOCANDO AL ORÁCULO ✦</h2>
        <p>El oráculo está preparando su estrategia...</p>
        <button class="back-button btn-lamb" onclick="window.closeGameAndLeave()">VOLVER AL INICIO</button>
      </div>`
    : `<div class="modal-panel">
        <h2>✦ ESPERANDO A LOS DEMÁS ADEPTOS ✦</h2>
        <p>El ritual aún no está completo. Comparte el ID de esta sala con tu oponente:</p>
        <p style="font-size: 1.5rem; font-weight: bold; margin: 1rem 0; color: var(--gold);">${gameId}</p>
        <button class="back-button btn-lamb" onclick="window.closeGameAndLeave()">VOLVER AL INICIO</button>
      </div>`;
}

export function showSpeechBubble(playerIndex, message) {
  const bubble = document.getElementById(`player${playerIndex + 1}Bubble`);
  if (!bubble) return;
  const textEl = bubble.querySelector(".speech-bubble-text");
  if (textEl) textEl.textContent = message;
  bubble.classList.add("show");

  if (speechBubbleTimers[playerIndex]) clearTimeout(speechBubbleTimers[playerIndex]);
  speechBubbleTimers[playerIndex] = setTimeout(() => {
    bubble.classList.remove("show");
    speechBubbleTimers[playerIndex] = null;
  }, 6000);
}
