import { Star, Shield, Zap, Crown } from 'lucide-react';

/**
 * Mapa de estilos por clave de rango.
 * `solid`    → color de acento para el icono y el halo.
 * `gradient` → degradado metálico espejo para el fondo de la chapa.
 */
const COLOR_MAP = {
  BRONCE:   {
    solid:    '#cd7f32',
    gradient: 'linear-gradient(90deg, #2a1a0a 0%, #7a5128 35%, #b8782a 50%, #7a5128 65%, #2a1a0a 100%)',
  },
  PLATA:    {
    solid:    '#c5cdd3',
    gradient: 'linear-gradient(90deg, #252a2d 0%, #4d6070 35%, #8a9eab 50%, #4d6070 65%, #252a2d 100%)',
  },
  ORO:      {
    solid:    '#ffd54f',
    gradient: 'linear-gradient(90deg, #2a2200 0%, #7a5f00 35%, #c8a820 50%, #7a5f00 65%, #2a2200 100%)',
  },
  DIAMANTE: {
    solid:    '#80deea',
    gradient: 'linear-gradient(90deg, #041c22 0%, #005060 35%, #40b8cc 50%, #005060 65%, #041c22 100%)',
  },
  gray:     {
    solid:    '#6b7280',
    gradient: 'linear-gradient(90deg, #1a1a1a 0%, #374151 35%, #6b7280 50%, #374151 65%, #1a1a1a 100%)',
  },
};

/**
 * Icono central de la chapa, intercambiable por variant.
 * Punto de extensión: agregar nuevas variantes aquí para nuevos cosméticos.
 */
function VariantIcon({ variant, color }) {
  const props = { size: 10, strokeWidth: 2.5, color, fill: `${color}33` };
  if (variant === 'vip')      return <Crown  {...props} />;
  if (variant === 'torneo')   return <Zap    {...props} />;
  if (variant === 'fundador') return <Shield {...props} />;
  return <Star {...props} />;
}

/**
 * Cosmético intercambiable de la placa de rango.
 *
 * Ocupa el 100% del slot que le asigne su contenedor padre (PlayerProfileFrame).
 * Las dimensiones siempre las impone el slot externo, nunca este componente.
 *
 * Para añadir una nueva variante visual en el futuro:
 *   1. Agregar el caso en `VariantIcon`.
 *   2. Opcionalmente, agregar una nueva rama en el render para variantes
 *      con layouts radicalmente distintos (ej. bandera, corona flotante...).
 *
 * @param {{
 *   variant?: 'default' | 'vip' | 'torneo' | 'fundador',
 *   color?:   'BRONCE' | 'PLATA' | 'ORO' | 'DIAMANTE' | 'gray',
 * }} props
 */
export default function PlayerBadge({ variant = 'default', color = 'gray' }) {
  const { solid, gradient } = COLOR_MAP[color] ?? COLOR_MAP.gray;

  return (
    <div
      className="w-full h-full flex items-center justify-between rounded-sm border border-black px-[3px]"
      style={{
        background: gradient,
        boxShadow:  `0 2px 6px rgba(0,0,0,0.65), 0 0 5px ${solid}33`,
      }}
    >
      {/* Remache izquierdo */}
      <div className="w-1 h-1 rounded-full bg-black/60 shrink-0" />

      {/* Icono central — define la variante del cosmético */}
      <VariantIcon variant={variant} color="rgba(255,255,255,0.92)" />

      {/* Remache derecho */}
      <div className="w-1 h-1 rounded-full bg-black/60 shrink-0" />
    </div>
  );
}
