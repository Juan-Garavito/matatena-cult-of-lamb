const DICE_DOT_MAP = {
  1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  2: [0, 0, 1, 0, 0, 0, 1, 0, 0],
  3: [0, 0, 1, 0, 1, 0, 1, 0, 0],
  4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
};

export function createDiceFaceHTML(value) {
  const dots = DICE_DOT_MAP[value] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let html = "";
  for (let i = 0; i < 9; i++) {
    const dotClass = dots[i] ? "dice-dot" : "dice-dot invisible";
    html += `<div class="dice-dot-slot"><div class="${dotClass}"></div></div>`;
  }
  return html;
}

export function renderDiceFace(container, value, animate) {
  if (!container) return;
  container.innerHTML = createDiceFaceHTML(value);
  if (animate) {
    container.classList.remove("rolling");
    void container.offsetWidth;
    container.classList.add("rolling");
    setTimeout(() => container.classList.remove("rolling"), 650);
  }
}

export function createCellDiceFace(value, shouldDrop) {
  const wrapper = document.createElement("div");
  wrapper.className = "cell-dice-face" + (shouldDrop ? " dice-drop" : "");
  wrapper.innerHTML = createDiceFaceHTML(value);
  if (shouldDrop) {
    setTimeout(() => wrapper.classList.remove("dice-drop"), 550);
  }
  return wrapper;
}

export function animateDice(finalValue, turnIndex) {
  return new Promise((resolve) => {
    const diceFace = document.getElementById(`player${turnIndex + 1}DiceFace`);
    if (!diceFace || !finalValue || finalValue < 1 || finalValue > 6) {
      resolve(finalValue === -1 ? 0 : finalValue);
      return;
    }

    const spinInterval = setInterval(() => {
      renderDiceFace(diceFace, Math.floor(Math.random() * 6) + 1, false);
    }, 60);

    setTimeout(() => {
      clearInterval(spinInterval);
      renderDiceFace(diceFace, finalValue, true);
      resolve(finalValue);
    }, 500);
  });
}
