/**
 * Singleton de audio para Dominó: una instancia Howl por recurso,
 * sincronización con ajustes (updateSettings) y pausa por visibilidad de pestaña.
 */
import { Howl } from 'howler';
import { canPlaySfx, canPlayMusic, clampUnit } from '../hooks/gameSoundHelpers';
import { SFX_BASE, LOBBY_MUSIC_BASE, GAME_MUSIC_BASE } from '../hooks/gameSoundBaseVolumes';

/** Alineado con useAudioSettings().settings (volume = maestro). */
const DEFAULT_SETTINGS = {
  masterMute: false,
  musicMute: false,
  sfxMute: false,
  volume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.4,
};

/** @param {import('howler').Howl} howl */
function attachPlayErrorHandling(howl) {
  howl.on('playerror', () => {
    howl.once('unlock', () => {
      if (howl.playing()) return;
      howl.play();
    });
  });
}

function createHowlMap() {
  const map = {
    clack: new Howl({ src: ['/sounds/clack.mp3'], volume: SFX_BASE.clack }),
    clack2: new Howl({ src: ['/sounds/clack2.mp3'], volume: SFX_BASE.clack2 }),
    heavyClack: new Howl({ src: ['/sounds/heavy-clack.mp3'], volume: SFX_BASE.heavyClack }),
    shuffle: new Howl({ src: ['/sounds/shuffle.mp3'], volume: SFX_BASE.shuffle }),
    turn: new Howl({ src: ['/sounds/turn.mp3'], volume: SFX_BASE.turn }),
    pass: new Howl({ src: ['/sounds/pass.mp3'], volume: SFX_BASE.pass }),
    slam: new Howl({ src: ['/sounds/slam.mp3'], volume: SFX_BASE.slam }),
    ding: new Howl({ src: ['/sounds/coins.mp3'], volume: SFX_BASE.ding }),
    writing: new Howl({ src: ['/sounds/wrinting.mp3'], volume: SFX_BASE.writing }),
    chatPop: new Howl({ src: ['/sounds/pop.mp3'], volume: SFX_BASE.chatPop }),
    victory: new Howl({ src: ['/sounds/victory.mp3'], volume: SFX_BASE.victory }),
    defeat: new Howl({ src: ['/sounds/defeat.mp3'], volume: SFX_BASE.defeat }),
    button: new Howl({ src: ['/sounds/button.mp3'], volume: SFX_BASE.button }),
    thunder: new Howl({ src: ['/sounds/thunder.mp3'], volume: SFX_BASE.thunder }),
    tick: new Howl({ src: ['/sounds/tick.mp3'], volume: SFX_BASE.tick }),
    lobbyMusic: new Howl({ src: ['/sounds/lobby-music.mp3'], volume: LOBBY_MUSIC_BASE, loop: true }),
    gameMusic: new Howl({ src: ['/sounds/game-music.ogg'], volume: GAME_MUSIC_BASE, loop: true }),
  };

  for (const howl of Object.values(map)) {
    attachPlayErrorHandling(howl);
  }
  return map;
}

const howls = createHowlMap();

let settings = { ...DEFAULT_SETTINGS };
/** @type {'lobby' | 'game' | null} */
let activeMusic = null;
let visibilityListenersAttached = false;

function pauseAllHowls() {
  for (const key of Object.keys(howls)) {
    howls[key].pause();
  }
}

function resumeMusicIfAllowed() {
  if (document.hidden || !canPlayMusic(settings)) return;
  if (activeMusic === 'lobby' && !howls.lobbyMusic.playing()) {
    howls.lobbyMusic.volume(clampUnit(LOBBY_MUSIC_BASE * settings.musicVolume));
    howls.lobbyMusic.mute(false);
    howls.lobbyMusic.play();
  } else if (activeMusic === 'game' && !howls.gameMusic.playing()) {
    howls.gameMusic.volume(clampUnit(GAME_MUSIC_BASE * settings.musicVolume));
    howls.gameMusic.mute(false);
    howls.gameMusic.play();
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    pauseAllHowls();
    return;
  }
  resumeMusicIfAllowed();
}

function ensureVisibilityListeners() {
  if (visibilityListenersAttached || typeof document === 'undefined') return;
  visibilityListenersAttached = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
}

ensureVisibilityListeners();

function playSfxInternal(baseKey) {
  if (!canPlaySfx(settings) || document.hidden) return;
  const howl = howls[baseKey];
  if (!howl) return;
  howl.volume(clampUnit(SFX_BASE[baseKey] * settings.sfxVolume));
  howl.play();
}

export const audioManager = {
  /**
   * Última configuración de audio (misma forma que useAudioSettings().settings).
   * @param {Partial<typeof DEFAULT_SETTINGS>} next
   */
  updateSettings(next) {
    settings = { ...settings, ...next };

    const s = settings;
    const musicMuted = !canPlayMusic(s);

    howls.lobbyMusic.mute(musicMuted);
    howls.gameMusic.mute(musicMuted);

    if (howls.lobbyMusic.playing()) {
      howls.lobbyMusic.volume(clampUnit(LOBBY_MUSIC_BASE * s.musicVolume));
    }
    if (howls.gameMusic.playing()) {
      howls.gameMusic.volume(clampUnit(GAME_MUSIC_BASE * s.musicVolume));
    }

    if (musicMuted) {
      howls.lobbyMusic.pause();
      howls.gameMusic.pause();
    }
  },

  playClack: () => playSfxInternal('clack'),
  playClack2: () => playSfxInternal('clack2'),
  playHeavyClack: () => playSfxInternal('heavyClack'),
  playShuffle: () => playSfxInternal('shuffle'),
  playTurn: () => playSfxInternal('turn'),
  playPass: () => playSfxInternal('pass'),
  playSlam: () => playSfxInternal('slam'),
  playDing: () => playSfxInternal('ding'),
  playChatPop: () => playSfxInternal('chatPop'),
  playWriting: () => playSfxInternal('writing'),
  playVictory: () => playSfxInternal('victory'),
  playDefeat: () => playSfxInternal('defeat'),
  playButton: () => playSfxInternal('button'),
  playThunder: () => playSfxInternal('thunder'),
  playTick: () => playSfxInternal('tick'),

  playLobbyMusic() {
    const s = settings;
    howls.gameMusic.pause();
    howls.lobbyMusic.volume(clampUnit(LOBBY_MUSIC_BASE * s.musicVolume));
    howls.lobbyMusic.mute(!canPlayMusic(s));
    activeMusic = 'lobby';
    if (!canPlayMusic(s) || document.hidden) return;
    if (!howls.lobbyMusic.playing()) howls.lobbyMusic.play();
  },

  stopLobbyMusic() {
    howls.lobbyMusic.stop();
    if (activeMusic === 'lobby') activeMusic = null;
  },

  playGameMusic() {
    const s = settings;
    howls.lobbyMusic.pause();
    howls.gameMusic.volume(clampUnit(GAME_MUSIC_BASE * s.musicVolume));
    howls.gameMusic.mute(!canPlayMusic(s));
    activeMusic = 'game';
    if (!canPlayMusic(s) || document.hidden) return;
    if (!howls.gameMusic.playing()) howls.gameMusic.play();
  },

  stopGameMusic() {
    howls.gameMusic.stop();
    if (activeMusic === 'game') activeMusic = null;
  },
};

export default audioManager;
