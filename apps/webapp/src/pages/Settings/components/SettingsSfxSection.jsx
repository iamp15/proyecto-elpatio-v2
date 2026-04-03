import SettingsToggle from './SettingsToggle';
import SettingsVolumeSlider from './SettingsVolumeSlider';

/**
 * Efectos de sonido: silencio + volumen relativo (usa AudioSettingsContext vía props).
 */
export default function SettingsSfxSection({
  t,
  masterBlocks,
  sfxMute,
  sfxVolume,
  onToggleSfxMute,
  onSfxVolumeChange,
}) {
  const sliderDisabled = masterBlocks || sfxMute;

  return (
    <>
      <div
        className={`flex justify-between items-center gap-4 mb-4 transition-opacity duration-300 ${
          masterBlocks ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div>
          <p className="text-lg font-semibold">{t('settings.sfxLabel')}</p>
          <p className="text-sm text-gray-500">{t('settings.sfxHint')}</p>
        </div>
        <SettingsToggle
          pressed={!sfxMute}
          onToggle={onToggleSfxMute}
          disabled={masterBlocks}
          activeTrackClass="bg-green-500"
          inactiveTrackClass="bg-gray-600"
          knobClassWhenPressed="translate-x-6"
        />
      </div>

      <div
        className={`mb-8 transition-opacity duration-300 ${
          masterBlocks || sfxMute ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      >
        <SettingsVolumeSlider
          label={t('settings.sfxVolumeLabel')}
          value={sfxVolume}
          onChange={onSfxVolumeChange}
          disabled={sliderDisabled}
          percentLabel={`${Math.round(sfxVolume * 100)}%`}
        />
      </div>
    </>
  );
}
