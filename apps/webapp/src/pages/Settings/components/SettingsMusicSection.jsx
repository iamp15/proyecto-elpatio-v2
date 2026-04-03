import SettingsToggle from './SettingsToggle';
import SettingsVolumeSlider from './SettingsVolumeSlider';

/**
 * Música de fondo: silencio + volumen relativo.
 */
export default function SettingsMusicSection({
  t,
  masterBlocks,
  musicMute,
  musicVolume,
  onToggleMusicMute,
  onMusicVolumeChange,
}) {
  const sliderDisabled = masterBlocks || musicMute;

  return (
    <>
      <div
        className={`flex justify-between items-center gap-4 mb-4 transition-opacity duration-300 ${
          masterBlocks ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div>
          <p className="text-lg font-semibold">{t('settings.musicLabel')}</p>
          <p className="text-sm text-gray-500">{t('settings.musicHint')}</p>
        </div>
        <SettingsToggle
          pressed={!musicMute}
          onToggle={onToggleMusicMute}
          disabled={masterBlocks}
          activeTrackClass="bg-green-500"
          inactiveTrackClass="bg-gray-600"
          knobClassWhenPressed="translate-x-6"
        />
      </div>

      <div
        className={`transition-opacity duration-300 ${
          masterBlocks || musicMute ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      >
        <SettingsVolumeSlider
          label={t('settings.musicVolumeLabel')}
          value={musicVolume}
          onChange={onMusicVolumeChange}
          disabled={sliderDisabled}
          percentLabel={`${Math.round(musicVolume * 100)}%`}
        />
      </div>
    </>
  );
}
