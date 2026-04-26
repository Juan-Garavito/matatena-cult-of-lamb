
import { SoundManager } from './sounds.js';
SoundManager.init();

const currentGameId = localStorage.getItem("currentGameId");
const currentPlayer = localStorage.getItem("player");
if (currentGameId && currentPlayer) {
  window.location.href = `/game.html?id=${currentGameId}`;
}

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;

    // Remove active class from all buttons and contents
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(`tab-${tabName}`).classList.add("active");
  });
});

document
  .getElementById("createGameForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const loading = document.getElementById("createGameLoading");
    const playerName = document.getElementById("player1Name").value;

    loading.classList.add("show");

    try {
      // 1. Crear el juego
      const baseUrl = window.ENV ? window.ENV.API_URL : "";
      const createResponse = await fetch(`${baseUrl}/create-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({type: "multiplayer"}),
      });

      if (!createResponse.ok) throw new Error("Error al crear la sala");

      const createData = await createResponse.json();
      const gameId = createData.gameId;
      
      loading.classList.remove("show");
      await unirAlJuego(gameId, playerName);
      window.location.href = `/game.html?id=${gameId}`;
    } catch (error) {
      console.error(error);
      loading.classList.remove("show");
    }
  });


document
  .getElementById("joinGameForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const gameId = document.getElementById("gameId").value;
    const playerName = document.getElementById("playerName").value;

    const loading = document.getElementById("joinGameLoading");
    const message = document.getElementById("joinGameMessage");

    loading.classList.add("show");
    message.classList.remove("show", "success", "error");

    try {
     await unirAlJuego(gameId, playerName);
      loading.classList.remove("show");
      message.classList.add("show", "success");

      window.location.href = `/game.html?id=${gameId}`;
    } catch (error) {
      console.error(error);
      loading.classList.remove("show");
      message.classList.add("show", "error");
      message.textContent = `Error: ${error.message}`;
    }
  });


document
  .getElementById("soloGameForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const loading = document.getElementById("soloGameLoading");
    const playerName = document.getElementById("soloPlayerName").value;
    loading.classList.add("show");
    try {
      const baseUrl = window.ENV ? window.ENV.API_URL : "";
      const res = await fetch(`${baseUrl}/create-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "singleplayer" }),
      });
      if (!res.ok) throw new Error("Error al crear la partida");
      const { gameId } = await res.json();
      await unirAlJuego(gameId, playerName);
      window.location.href = `/game.html?id=${gameId}`;
    } catch (err) {
      console.error(err);
      loading.classList.remove("show");
    }
  });


async function unirAlJuego(id_game, playerName) {
  const baseUrl = window.ENV ? window.ENV.API_URL : "";
  const response = await fetch(`${baseUrl}/join-game`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_game,
      playerName,
    }),
  });

  if (!response.ok) throw new Error("No se pudo unir al altar");

  const data = await response.json();
  localStorage.setItem("player", JSON.stringify(data.player));
  localStorage.setItem("currentGameId", id_game);
}



