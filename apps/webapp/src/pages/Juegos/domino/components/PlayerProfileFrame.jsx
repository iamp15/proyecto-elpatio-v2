import { useEffect, useState } from 'react';
import PlayerBadge from './PlayerBadge';

/** Color sólido del anillo por rango. */
const RANK_COLORS = {
  BRONCE:   '#cd7f32',
  PLATA:    '#c5cdd3',
  ORO:      '#ffd54f',
  DIAMANTE: '#80deea',
};

/**
 * Marco de perfil del jugador.
 *
 * Overlay no-interactivo sobre el tablero de juego.
 *
 * @param {{
 *   player: {
 *     name:         string,
 *     avatarUrl:    string | null,
 *     pr:           number,
 *     rankColor:    'BRONCE' | 'PLATA' | 'ORO' | 'DIAMANTE',
 *     badgeVariant: 'default' | 'vip' | 'torneo' | 'fundador',
 *   },
 *   isActiveTurn?: boolean,
 *   tileCount?:    number | null,
 * }} props
 */
export default function PlayerProfileFrame({ player, score = 0, targetScore = null, layoutSide = 'left', isActiveTurn = false, tileCount = null }) {
  const {
    name         = 'Jugador',
    avatarUrl    = null,
    pr           = 1000,
    rankColor    = 'BRONCE',
    badgeVariant = 'default',
  } = player ?? {};

  const color   = RANK_COLORS[rankColor] ?? RANK_COLORS.BRONCE;
  const initial = name.charAt(0).toUpperCase();

  const [isSmall, setIsSmall] = useState(window.innerWidth < 400);
  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < 400);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {/* ── Nombre del jugador ── */}
      <span
        style={{
          fontSize:      isSmall ? '0.58rem' : '0.65rem',
          fontWeight:    600,
          maxWidth:      isSmall ? '56px' : '72px',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
          lineHeight:    1,
          color:         'rgba(226,232,240,0.6)',
          textShadow:    '0 1px 6px rgba(0,0,0,0.9)',
          letterSpacing: '0.02em',
        }}
      >
        {name}
      </span>

      {/* ── Contenedor relativo: avatar + badge slot + PR ── */}
      <div className="relative">

        {/* Anillo pulsante externo — solo visible cuando es el turno activo */}
        {isActiveTurn && (
          <div
            style={{
              position:     'absolute',
              inset:        isSmall ? '-6px' : '-8px',
              borderRadius: '50%',
              border:       `2px solid ${color}`,
              opacity:      0,
              animation:    'profile-ring-pulse 1.6s ease-out infinite',
              pointerEvents:'none',
              zIndex:       0,
            }}
          />
        )}

        {/* Marco grueso — resplandor activo cuando es el turno de este jugador */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width:     isSmall ? '48px' : '64px',
            height:    isSmall ? '48px' : '64px',
            border:    `${isSmall ? 4 : 6}px solid ${color}`,
            boxShadow: isActiveTurn
              ? `0 0 0 2px ${color}, 0 0 20px ${color}99, 0 0 40px ${color}44`
              : `0 0 0 1px rgba(0,0,0,0.55), 0 0 16px ${color}55`,
            transition: 'box-shadow 0.4s ease',
            position:   'relative',
            zIndex:     1,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-bold"
              style={{
                fontSize:   isSmall ? '0.9rem' : '1.125rem',
                background: `linear-gradient(135deg, ${color}30, ${color}0d)`,
                color,
              }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* ── Slot del Badge ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{
            bottom: isSmall ? '-8px' : '-12px',
            width:  isSmall ? '44px' : '56px',
            height: isSmall ? '16px' : '20px',
          }}
        >
          <PlayerBadge variant={badgeVariant} color={rankColor} />
        </div>

        {/* ── Indicador PR ── */}
        <div
          className="absolute bg-black border border-gray-600 text-white font-bold rounded-sm"
          style={{
            top:        isSmall ? '-2px' : '-4px',
            right:      isSmall ? '-4px' : '-8px',
            fontSize:   isSmall ? '8px' : '10px',
            padding:    isSmall ? '1px 4px' : '2px 6px',
            lineHeight: 1.3,
            boxShadow:  '0 1px 4px rgba(0,0,0,0.6)',
            zIndex:     20,
          }}
        >
          {pr.toLocaleString()}
        </div>

        {/* ── Puntuación de la Liga (Flotante a un lado) ── */}
        {targetScore && (
          <div
            className="absolute flex items-center justify-center font-bold tracking-wide bg-gray-900/90 border border-gray-600 rounded-full"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              [layoutSide === 'left' ? 'left' : 'right']: 'calc(100% + 16px)',
              fontSize: isSmall ? '0.65rem' : '0.75rem',
              color: '#fbbf24',
              padding: isSmall ? '4px 10px' : '4px 12px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
            }}
          >
            {score} / {targetScore} pts
          </div>
        )}

      </div>

      {/* ── Contador de fichas (oponente) ── */}
      {tileCount !== null && (
        <span
          style={{
            marginTop:     isSmall ? '10px' : '14px',
            fontSize:      isSmall ? '0.58rem' : '0.65rem',
            fontWeight:    700,
            color:         isActiveTurn ? color : 'rgba(226,232,240,0.5)',
            textShadow:    isActiveTurn ? `0 0 8px ${color}99` : 'none',
            transition:    'color 0.3s, text-shadow 0.3s',
            letterSpacing: '0.04em',
          }}
        >
          {tileCount} {tileCount === 1 ? 'ficha' : 'fichas'}
        </span>
      )}
    </div>
  );
}
