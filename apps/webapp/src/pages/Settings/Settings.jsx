import { useTranslation } from 'react-i18next';
import { useAudioSettings } from '../../context/AudioSettingsContext';
import SettingsToggle from './components/SettingsToggle';
import SettingsVolumeSlider from './components/SettingsVolumeSlider';
import SettingsSfxSection from './components/SettingsSfxSection';
import SettingsMusicSection from './components/SettingsMusicSection';

export default function Settings() {
  const { t } = useTranslation();
  const {
    settings,
    toggleMasterMute,
    toggleSfxMute,
    toggleMusicMute,
    setVolume,
    setSfxVolume,
    setMusicVolume,
  } = useAudioSettings();

  const masterBlocks = settings.masterMute;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
      <h1 className="text-4xl font-black text-yellow-400 mb-10 drop-shadow-md tracking-wider uppercase">
        {t('settings.title')}
      </h1>

      <div className="w-full max-w-md bg-gray-800 rounded-3xl p-6 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-gray-400 mb-6 border-b border-gray-700 pb-2">
          {t('settings.audioSectionTitle')}
        </h2>

        {/* Silenciar todo */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div>
            <p className="text-lg font-semibold">{t('settings.masterMuteLabel')}</p>
            <p className="text-sm text-gray-500">{t('settings.masterMuteHint')}</p>
          </div>
          <SettingsToggle
            pressed={settings.masterMute}
            onToggle={toggleMasterMute}
            activeTrackClass="bg-red-500"
            inactiveTrackClass="bg-gray-600"
            knobClassWhenPressed="translate-x-6"
          />
        </div>

        {/* Volumen general → Howler global (AudioSettingsContext) */}
        <div
          className={`mb-8 transition-opacity duration-300 ${
            masterBlocks ? 'opacity-50 pointer-events-none' : 'opacity-100'
          }`}
        >
          <SettingsVolumeSlider
            label={t('settings.masterVolumeLabel')}
            value={settings.volume}
            onChange={setVolume}
            disabled={masterBlocks}
            percentLabel={`${Math.round(settings.volume * 100)}%`}
          />
        </div>

        <SettingsSfxSection
          t={t}
          masterBlocks={masterBlocks}
          sfxMute={settings.sfxMute}
          sfxVolume={settings.sfxVolume}
          onToggleSfxMute={toggleSfxMute}
          onSfxVolumeChange={setSfxVolume}
        />

        <SettingsMusicSection
          t={t}
          masterBlocks={masterBlocks}
          musicMute={settings.musicMute}
          musicVolume={settings.musicVolume}
          onToggleMusicMute={toggleMusicMute}
          onMusicVolumeChange={setMusicVolume}
        />
      </div>
    </div>
  );
}
