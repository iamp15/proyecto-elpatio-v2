import { Shield } from 'lucide-react';

/** Gradientes metálicos por rango. */
const RANK_GRADIENTS = {
  BRONCE:   'linear-gradient(135deg, #cd7f32 0%, #8b5a00 50%, #cd7f32 100%)',
  PLATA:    'linear-gradient(135deg, #e8eef2 0%, #697a85 50%, #c5cdd3 100%)',
  ORO:      'linear-gradient(135deg, #ffd54f 0%, #b8860b 50%, #ffec8b 100%)',
  DIAMANTE: 'linear-gradient(135deg, #80deea 0%, #006680 50%, #b2ebf2 100%)',
};

/**
 * Badge de rango con icono Shield y gradiente metálico.
 *
 * @param {{ rank?: string }} props
 */
export default function RankBadge({ rank = 'BRONCE' }) {
  const gradient = RANK_GRADIENTS[rank] ?? RANK_GRADIENTS.BRONCE;

  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width:  28,
        height: 28,
        background: gradient,
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Shield
        size={16}
        className="text-white"
        strokeWidth={2}
        fill="rgba(255,255,255,0.15)"
      />
    </div>
  );
}
