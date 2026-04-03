import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Howler } from 'howler';

const STORAGE_KEY = 'el_patio_audio_settings';

const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.4,
  masterMute: false,
  sfxMute: false,
  musicMute: false,
};

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const legacyMute = parsed.isMuted ?? false;
    return {
      masterVolume: parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume,
      sfxVolume: parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume,
      musicVolume: parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume,
      masterMute: parsed.masterMute ?? legacyMute,
      sfxMute: parsed.sfxMute ?? DEFAULT_SETTINGS.sfxMute,
      musicMute: parsed.musicMute ?? DEFAULT_SETTINGS.musicMute,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveToStorage(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
}

const AudioSettingsContext = createContext(null);

export function AudioSettingsProvider({ children }) {
  const [state, setState] = useState(loadFromStorage);

  useEffect(() => {
    Howler.volume(state.masterMute ? 0 : state.masterVolume);
    Howler.mute(state.masterMute);
  }, [state.masterVolume, state.masterMute]);

  const updateSettings = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setMasterVolume = useCallback(
    (value) => updateSettings({ masterVolume: Math.min(1, Math.max(0, value)) }),
    [updateSettings],
  );

  const setSfxVolume = useCallback(
    (value) => updateSettings({ sfxVolume: Math.min(1, Math.max(0, value)) }),
    [updateSettings],
  );

  const setMusicVolume = useCallback(
    (value) => updateSettings({ musicVolume: Math.min(1, Math.max(0, value)) }),
    [updateSettings],
  );

  const toggleMasterMute = useCallback(
    () => updateSettings({ masterMute: !state.masterMute }),
    [updateSettings, state.masterMute],
  );

  const toggleSfxMute = useCallback(
    () => updateSettings({ sfxMute: !state.sfxMute }),
    [updateSettings, state.sfxMute],
  );

  const toggleMusicMute = useCallback(
    () => updateSettings({ musicMute: !state.musicMute }),
    [updateSettings, state.musicMute],
  );

  const setVolume = useCallback(
    (value) => setMasterVolume(value),
    [setMasterVolume],
  );

  const settings = useMemo(
    () => ({
      masterMute: state.masterMute,
      volume: state.masterVolume,
      sfxMute: state.sfxMute,
      musicMute: state.musicMute,
      sfxVolume: state.sfxVolume,
      musicVolume: state.musicVolume,
    }),
    [state],
  );

  const value = useMemo(
    () => ({
      settings,
      toggleMasterMute,
      toggleSfxMute,
      toggleMusicMute,
      setVolume,
      setMasterVolume,
      setSfxVolume,
      setMusicVolume,
      /** @deprecated usar settings.masterMute */
      isMuted: state.masterMute,
      /** @deprecated usar toggleMasterMute */
      toggleMute: toggleMasterMute,
      setIsMuted: (v) => updateSettings({ masterMute: Boolean(v) }),
    }),
    [
      settings,
      toggleMasterMute,
      toggleSfxMute,
      toggleMusicMute,
      setVolume,
      setMasterVolume,
      setSfxVolume,
      setMusicVolume,
      state.masterMute,
      updateSettings,
    ],
  );

  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings() {
  const ctx = useContext(AudioSettingsContext);
  if (!ctx) throw new Error('useAudioSettings must be used within AudioSettingsProvider');
  return ctx;
}
