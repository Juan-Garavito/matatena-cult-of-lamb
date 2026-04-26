export const SoundManager = {
  _bgm: new Audio('/music/background.mp3'),
  init() {
    this._bgm.loop = true;
    this._bgm.volume = 0.3;
    document.addEventListener('click', () => this._bgm.play().catch(() => {}), { once: true });
  },
  play(name) {
    const sfx = new Audio(`/music/${name}.mp3`);
    sfx.volume = 0.8;
    sfx.play().catch(() => {});
  }
};
