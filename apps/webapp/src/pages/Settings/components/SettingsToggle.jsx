/**
 * Interruptor estilo píldora para opciones de audio.
 */
export default function SettingsToggle({
  pressed,
  onToggle,
  disabled,
  activeTrackClass,
  inactiveTrackClass,
  knobClassWhenPressed,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={`w-14 h-8 flex shrink-0 items-center rounded-full p-1 transition-colors duration-300 disabled:opacity-50 ${
        pressed ? activeTrackClass : inactiveTrackClass
      }`}
    >
      <span
        className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${
          pressed ? knobClassWhenPressed : 'translate-x-0'
        }`}
      />
    </button>
  );
}
