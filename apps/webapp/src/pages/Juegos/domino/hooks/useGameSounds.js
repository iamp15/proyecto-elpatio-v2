import { useMemo, useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useAudioSettings } from '../../../../context/AudioSettingsContext';
import { canPlaySfx, canPlayMusic, clampUnit } from './gameSoundHelpers';
import { SFX_BASE, LOBBY_MUSIC_BASE, GAME_MUSIC_BASE } from './gameSoundBaseVolumes';

export default function useGameSounds() {
  const { settings } = useAudioSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const sounds = useMemo(
    () => ({
      clack:      new Howl({ src: ['/sounds/clack.mp3'],        volume: SFX_BASE.clack }),
      clack2:     new Howl({ src: ['/sounds/clack2.mp3'],       volume: SFX_BASE.clack2 }),
      heavyClack: new Howl({ src: ['/sounds/heavy-clack.mp3'], volume: SFX_BASE.heavyClack }),
      shuffle:    new Howl({ src: ['/sounds/shuffle.mp3'],      volume: SFX_BASE.shuffle }),
      turn:       new Howl({ src: ['/sounds/turn.mp3'],         volume: SFX_BASE.turn }),
      pass:       new Howl({ src: ['/sounds/pass.mp3'],         volume: SFX_BASE.pass }),
      slam:       new Howl({ src: ['/sounds/slam.mp3'],         volume: SFX_BASE.slam }),
      ding:       new Howl({ src: ['/sounds/coins.mp3'],        volume: SFX_BASE.ding }),
      writing:    new Howl({ src: ['/sounds/wrinting.mp3'],     volume: SFX_BASE.writing }),
      chatPop:    new Howl({ src: ['/sounds/pop.mp3'],          volume: SFX_BASE.chatPop }),
      victory:    new Howl({ src: ['/sounds/victory.mp3'],      volume: SFX_BASE.victory }),
      defeat:     new Howl({ src: ['/sounds/defeat.mp3'],       volume: SFX_BASE.defeat }),
      button:     new Howl({ src: ['/sounds/button.mp3'],       volume: SFX_BASE.button }),
      thunder:    new Howl({ src: ['/sounds/thunder.mp3'],      volume: SFX_BASE.thunder }),
      tick:       new Howl({ src: ['/sounds/tick.mp3'],         volume: SFX_BASE.tick }),
      lobbyMusic: new Howl({ src: ['/sounds/lobby-music.mp3'],  volume: LOBBY_MUSIC_BASE, loop: true }),
      gameMusic:  new Howl({ src: ['/sounds/game-music.ogg'],   volume: GAME_MUSIC_BASE,  loop: true }),
    }),
    [],
  );

  // ── SFX helper ──────────────────────────────────────────────────────────────

  const playSfx = useCallback(
    (howl, baseKey) => {
      const s = settingsRef.current;
      if (!canPlaySfx(s)) return;
      howl.volume(clampUnit(SFX_BASE[baseKey] * s.sfxVolume));
      howl.play();
    },
    [],
  );

  const playClack     = useCallback(() => playSfx(sounds.clack,      'clack'),      [playSfx, sounds.clack]);
  const playClack2    = useCallback(() => playSfx(sounds.clack2,     'clack2'),     [playSfx, sounds.clack2]);
  const playHeavyClack = useCallback(() => playSfx(sounds.heavyClack,'heavyClack'), [playSfx, sounds.heavyClack]);
  const playShuffle   = useCallback(() => playSfx(sounds.shuffle,    'shuffle'),    [playSfx, sounds.shuffle]);
  const playTurn      = useCallback(() => playSfx(sounds.turn,       'turn'),       [playSfx, sounds.turn]);
  const playPass      = useCallback(() => playSfx(sounds.pass,       'pass'),       [playSfx, sounds.pass]);
  const playSlam      = useCallback(() => playSfx(sounds.slam,       'slam'),       [playSfx, sounds.slam]);
  const playDing      = useCallback(() => playSfx(sounds.ding,       'ding'),       [playSfx, sounds.ding]);
  const playChatPop   = useCallback(() => playSfx(sounds.chatPop,    'chatPop'),    [playSfx, sounds.chatPop]);
  const playWriting   = useCallback(() => playSfx(sounds.writing,    'writing'),    [playSfx, sounds.writing]);
  const playVictory   = useCallback(() => playSfx(sounds.victory,    'victory'),    [playSfx, sounds.victory]);
  const playDefeat    = useCallback(() => playSfx(sounds.defeat,     'defeat'),     [playSfx, sounds.defeat]);
  const playButton    = useCallback(() => playSfx(sounds.button,     'button'),     [playSfx, sounds.button]);
  const playThunder   = useCallback(() => playSfx(sounds.thunder,    'thunder'),    [playSfx, sounds.thunder]);
  const playTick      = useCallback(() => playSfx(sounds.tick,       'tick'),       [playSfx, sounds.tick]);

  // ── Música del lobby ────────────────────────────────────────────────────────

  const playLobbyMusic = useCallback(() => {
    const s = settingsRef.current;
    sounds.lobbyMusic.volume(clampUnit(LOBBY_MUSIC_BASE * s.musicVolume));
    sounds.lobbyMusic.mute(!canPlayMusic(s));
    if (!sounds.lobbyMusic.playing()) sounds.lobbyMusic.play();
  }, [sounds.lobbyMusic]);

  const stopLobbyMusic = useCallback(() => {
    sounds.lobbyMusic.stop();
  }, [sounds.lobbyMusic]);

  // ── Música de la partida ─────────────────────────────────────────────────

  const playGameMusic = useCallback(() => {
    const s = settingsRef.current;
    sounds.gameMusic.volume(clampUnit(GAME_MUSIC_BASE * s.musicVolume));
    sounds.gameMusic.mute(!canPlayMusic(s));
    if (!sounds.gameMusic.playing()) sounds.gameMusic.play();
  }, [sounds.gameMusic]);

  const stopGameMusic = useCallback(() => {
    sounds.gameMusic.stop();
  }, [sounds.gameMusic]);

  // ── Efectos reactivos: volumen y mute para ambas músicas ────────────────────

  useEffect(() => {
    const s = settingsRef.current;
    const vol = clampUnit(LOBBY_MUSIC_BASE * s.musicVolume);
    if (sounds.lobbyMusic.playing()) {
      sounds.lobbyMusic.volume(vol);
    }
    const gameVol = clampUnit(GAME_MUSIC_BASE * s.musicVolume);
    if (sounds.gameMusic.playing()) {
      sounds.gameMusic.volume(gameVol);
    }
  }, [settings.musicVolume, settings.masterMute, settings.musicMute, sounds.lobbyMusic, sounds.gameMusic]);

  useEffect(() => {
    const s = settingsRef.current;
    const muted = !canPlayMusic(s);
    sounds.lobbyMusic.mute(muted);
    sounds.gameMusic.mute(muted);
  }, [settings.masterMute, settings.musicMute, sounds.lobbyMusic, sounds.gameMusic]);

  return {
    playClack,
    playClack2,
    playHeavyClack,
    playShuffle,
    playTurn,
    playPass,
    playSlam,
    playDing,
    playChatPop,
    playWriting,
    playVictory,
    playDefeat,
    playButton,
    playThunder,
    playTick,
    playLobbyMusic,
    stopLobbyMusic,
    playGameMusic,
    stopGameMusic,
  };
}
