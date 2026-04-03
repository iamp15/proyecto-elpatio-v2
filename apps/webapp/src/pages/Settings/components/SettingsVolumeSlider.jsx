/**
 * Slider de volumen maestro (0–1).
 */
export default function SettingsVolumeSlider({ value, onChange, disabled, label, percentLabel }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-lg font-semibold">{label}</span>
        <span className="text-yellow-400 font-bold">{percentLabel}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-400 disabled:cursor-not-allowed"
      />
    </div>
  );
}
