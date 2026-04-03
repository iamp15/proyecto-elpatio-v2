/**
 * Utilidades para volumen y comprobaciones de silencio (dominó / Howler).
 */

export function clampUnit(v) {
  return Math.min(1, Math.max(0, v));
}

/** Si se pueden reproducir efectos (respeta silencio maestro y SFX). */
export function canPlaySfx(settings) {
  return !settings.masterMute && !settings.sfxMute;
}

/** Si se puede reproducir música de fondo. */
export function canPlayMusic(settings) {
  return !settings.masterMute && !settings.musicMute;
}
