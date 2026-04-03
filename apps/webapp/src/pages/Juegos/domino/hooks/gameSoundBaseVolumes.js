/**
 * Volúmenes base por sonido (0–1) antes de multiplicar por ajustes del usuario.
 */
export const SFX_BASE = {
  clack: 0.5,
  clack2: 0.5,
  heavyClack: 1,
  shuffle: 0.7,
  turn: 0.8,
  pass: 0.8,
  slam: 0.9,
  ding: 0.6,
  writing: 0.7,
  chatPop: 0.3,
  victory: 0.7,
  defeat: 0.7,
  button: 0.5,
  thunder: 1.0,
  tick: 0.6,
};

/**
 * Compensa que el archivo del lobby suene más bajo que game-music a igual ganancia.
 * Sigue multiplicándose por `musicVolume` de Ajustes (mismo control que el juego).
 */
export const LOBBY_MUSIC_BASE = 0.55;

export const GAME_MUSIC_BASE = 0.35;
