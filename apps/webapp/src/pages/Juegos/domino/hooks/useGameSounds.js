import { useCallback, useEffect } from 'react';
import { useAudioSettings } from '../../../../context/AudioSettingsContext';
import audioManager from '../audio/AudioManager';

/**
 * Fachada React sobre el singleton AudioManager (una instancia Howl por recurso).
 */
export default function useGameSounds() {
  const { settings } = useAudioSettings();

  useEffect(() => {
    audioManager.updateSettings(settings);
  }, [settings]);

  const playClack = useCallback(() => audioManager.playClack(), []);
  const playClack2 = useCallback(() => audioManager.playClack2(), []);
  const playHeavyClack = useCallback(() => audioManager.playHeavyClack(), []);
  const playShuffle = useCallback(() => audioManager.playShuffle(), []);
  const playTurn = useCallback(() => audioManager.playTurn(), []);
  const playPass = useCallback(() => audioManager.playPass(), []);
  const playSlam = useCallback(() => audioManager.playSlam(), []);
  const playDing = useCallback(() => audioManager.playDing(), []);
  const playChatPop = useCallback(() => audioManager.playChatPop(), []);
  const playWriting = useCallback(() => audioManager.playWriting(), []);
  const playVictory = useCallback(() => audioManager.playVictory(), []);
  const playDefeat = useCallback(() => audioManager.playDefeat(), []);
  const playButton = useCallback(() => audioManager.playButton(), []);
  const playThunder = useCallback(() => audioManager.playThunder(), []);
  const playTick = useCallback(() => audioManager.playTick(), []);
  const playLobbyMusic = useCallback(() => audioManager.playLobbyMusic(), []);
  const stopLobbyMusic = useCallback(() => audioManager.stopLobbyMusic(), []);
  const playGameMusic = useCallback(() => audioManager.playGameMusic(), []);
  const stopGameMusic = useCallback(() => audioManager.stopGameMusic(), []);

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
