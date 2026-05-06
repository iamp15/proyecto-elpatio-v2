import { VIP_HIGHLIGHT_GREEN } from '../../../../lib/vipUserUi';

/**
 * Etiqueta compacta "VIP" para superponer al marco del avatar.
 * Solo debe renderizarse cuando el jugador tiene membresía VIP activa.
 *
 * @param {{ compact?: boolean }} props
 */
export default function PlayerVipCapsule({ compact = false }) {
  return (
    <span
      title="VIP"
      aria-label="Miembro VIP"
      style={{
        display: 'inline-block',
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize: compact ? '0.4rem' : '0.45rem',
        lineHeight: 1,
        letterSpacing: '0.048em',
        textTransform: 'uppercase',
        color: '#ecfdf5',
        padding: compact ? '1px 4px' : '2px 6px',
        borderRadius: '9999px',
        border: '1px solid rgba(0, 0, 0, 0.45)',
        background: `linear-gradient(145deg, ${VIP_HIGHLIGHT_GREEN} 0%, #16a34a 45%, #15803d 100%)`,
        boxShadow:
          '0 0 8px rgba(34, 197, 94, 0.75), 0 0 3px rgba(16, 185, 129, 0.9) inset, 0 1px 2px rgba(0,0,0,0.55)',
        textShadow: '0 1px 1px rgba(0,0,0,0.45)',
      }}
    >
      VIP
    </span>
  );
}
