import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAudioSettings } from '../../../../context/AudioSettingsContext';

export default function GameOptionsModal({ isOpen, onClose, onForfeit }) {
  const { t } = useTranslation();
  const { settings, toggleMasterMute, toggleSfxMute, toggleMusicMute } = useAudioSettings();
  const [view, setView] = useState('menu');
  const masterEnabled = !settings.masterMute;
  const sfxEnabled = !settings.masterMute && !settings.sfxMute;
  const musicEnabled = !settings.masterMute && !settings.musicMute;
  const handleToggleSfx = () => {
    if (settings.masterMute) return;
    toggleSfxMute();
  };
  const handleToggleMusic = () => {
    if (settings.masterMute) return;
    toggleMusicMute();
  };

  useEffect(() => {
    if (isOpen) {
      setView('menu');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1117] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold text-white">{t('gameOptions.title')}</h3>

            {view === 'menu' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/10"
                  onClick={() => setView('sounds')}
                >
                  {t('gameOptions.sounds')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left text-sm font-medium text-red-200 hover:bg-red-500/20"
                  onClick={() => setView('confirm')}
                >
                  {t('gameOptions.forfeit')}
                </button>
              </div>
            )}

            {view === 'sounds' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400">{t('gameOptions.soundsTitle')}</p>
                <button
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                  onClick={toggleMasterMute}
                >
                  <span>{t('gameOptions.master')}</span>
                  <input
                    type="checkbox"
                    checked={masterEnabled}
                    readOnly
                    className="h-4 w-4 accent-emerald-500"
                  />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleToggleSfx}
                  disabled={settings.masterMute}
                >
                  <span>{t('gameOptions.sfx')}</span>
                  <input
                    type="checkbox"
                    checked={sfxEnabled}
                    readOnly
                    disabled={settings.masterMute}
                    className="pointer-events-none h-4 w-4 accent-emerald-500"
                  />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleToggleMusic}
                  disabled={settings.masterMute}
                >
                  <span>{t('gameOptions.music')}</span>
                  <input
                    type="checkbox"
                    checked={musicEnabled}
                    readOnly
                    disabled={settings.masterMute}
                    className="pointer-events-none h-4 w-4 accent-emerald-500"
                  />
                </button>
                <button
                  type="button"
                  className="mt-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5"
                  onClick={() => setView('menu')}
                >
                  {t('gameOptions.back')}
                </button>
              </div>
            )}

            {view === 'confirm' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-red-200">{t('gameOptions.confirmTitle')}</p>
                <p className="text-xs text-gray-300">{t('gameOptions.confirmWarning')}</p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => setView('menu')}
                  >
                    {t('gameOptions.cancel')}
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-red-500/50 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30"
                    onClick={onForfeit}
                  >
                    {t('gameOptions.confirm')}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
