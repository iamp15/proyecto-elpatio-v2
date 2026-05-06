import { useEffect, useState } from 'react';
import PlayerBadge from './PlayerBadge';
import PlayerVipCapsule from './PlayerVipCapsule';
import { VIP_HIGHLIGHT_GREEN } from '../../../../lib/vipUserUi';

/**
 * Marco de perfil del jugador.
 *
 * Overlay no-interactivo sobre el tablero de juego.
 *
 * @param {{
 *   player: {
 *     name:         string,
 *     avatarUrl:    string | null,
 *     frameUrl:     string | null,
 *     badgeUrl:     string | null,
 *     pr:           number,
 *     isVip?: boolean,
 *   },
 *   size?: 'small' | 'medium' | 'large',
 *   isActiveTurn?: boolean,
 *   tileCount?:    number | null,
 *   showPr?:       boolean,
 *   showNameLabel?: boolean,
 *   showVipCapsule?: boolean,
 * }} props
 */
export default function PlayerProfileFrame({
  player,
  size = 'medium',
  score = 0,
  targetScore = null,
  layoutSide = 'left',
  isActiveTurn = false,
  tileCount = null,
  showPr = true,
  showNameLabel = true,
  showVipCapsule = true,
}) {
  const {
    name      = 'Jugador',
    avatarUrl = null,
    frameUrl  = null,
    badgeUrl  = null,
    pr        = 1000,
    isVip     = false,
  } = player ?? {};

  const [isNarrowViewport, setIsNarrowViewport] = useState(window.innerWidth < 400);
  useEffect(() => {
    const check = () => setIsNarrowViewport(window.innerWidth < 400);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isSmall = size === 'small' || (size !== 'large' && isNarrowViewport);
  const isLarge = size === 'large';

  /** Inset desde la esquina del marco para la cápsula VIP (arriba-izq.) */
  const vipFrameInsetPx = isSmall ? -2 : -4;
  /** En partida no hay cápsula VIP: PR con offset clásico + bajada para no rozar el nombre encima del marco */
  const prTopMatchNudgePx = showVipCapsule ? 0 : 5;
  const prFrameTopPx =
    showVipCapsule && isVip
      ? vipFrameInsetPx + 4
      : (isSmall ? -2 : -4) + prTopMatchNudgePx;
  const prFrameRightPx =
    showVipCapsule && isVip ? vipFrameInsetPx : (isSmall ? -4 : -8);
  const avatarSizePx = isLarge ? 96 : isSmall ? 48 : 64;
  const badgeWidthPx = Math.round(avatarSizePx * 0.78);
  const badgeHeightPx = Math.round(badgeWidthPx * 0.36);
  const badgeBottomPx = -Math.round(badgeHeightPx * 0.35);
  const containerBottomMarginPx = Math.max(12, badgeHeightPx + badgeBottomPx + 6);
  const turnShadow = isActiveTurn
    ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 20px rgba(255,255,255,0.28)'
    : '0 2px 10px rgba(0,0,0,0.4)';

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {/* ── Nombre del jugador (solo en partida / cuando se solicita) ── */}
      {showNameLabel && (
        <span
          style={{
            fontSize:      isSmall ? '0.58rem' : '0.65rem',
            fontWeight:    isVip ? 800 : 600,
            maxWidth:      isSmall ? '56px' : '72px',
            overflow:      'hidden',
            textOverflow:  'ellipsis',
            whiteSpace:    'nowrap',
            lineHeight:    1,
            color: isVip ? VIP_HIGHLIGHT_GREEN : 'rgba(226,232,240,0.6)',
            textShadow: isVip
              ? '0 0 10px rgba(34, 197, 94, 0.55), 0 1px 6px rgba(0,0,0,0.95)'
              : '0 1px 6px rgba(0,0,0,0.9)',
            letterSpacing: '0.02em',
          }}
        >
          {name}
        </span>
      )}

      {/* ── Contenedor relativo: avatar + frame + badge + PR ── */}
      <div
        className="relative"
        style={{ position: 'relative', marginBottom: containerBottomMarginPx }}
      >
        {isVip && showVipCapsule ? (
          <div
            className="absolute pointer-events-none"
            style={{
              top:    vipFrameInsetPx,
              left:   vipFrameInsetPx,
              zIndex: 12,
            }}
          >
            <PlayerVipCapsule compact={isSmall} />
          </div>
        ) : null}

        {/* Avatar base y cosméticos superpuestos desde imágenes del catálogo. */}
        <div
          className="relative"
          style={{
            position:   'relative',
            width:      avatarSizePx,
            height:     avatarSizePx,
            boxShadow:  turnShadow,
            transition: 'box-shadow 0.4s ease',
            zIndex:     1,
          }}
        >
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={name}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
                display: 'block',
                zIndex: 1,
              }}
              draggable={false}
            />
          )}
          {frameUrl && (
            <img
              src={frameUrl}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                zIndex: 2,
              }}
              draggable={false}
              aria-hidden="true"
            />
          )}

          {/* ── Slot del Badge: centrado contra el propio frame ── */}
          <div
            style={{
              position:  'absolute',
              left:      '50%',
              transform: 'translateX(-50%)',
              zIndex:    10,
              bottom:    badgeBottomPx,
              width:     badgeWidthPx,
              height:    badgeHeightPx,
            }}
          >
            <PlayerBadge iconUrl={badgeUrl} alt={`${name} badge`} />
          </div>
        </div>

        {/* ── Indicador PR (solo en partidas de dominó) ── */}
        {showPr && (
          <div
            className="absolute bg-black border border-gray-600 text-white font-bold rounded-sm"
            style={{
              top:        prFrameTopPx,
              right:      prFrameRightPx,
              fontSize:   isSmall ? '8px' : '10px',
              padding:    isSmall ? '1px 4px' : '2px 6px',
              lineHeight: 1.3,
              boxShadow:  '0 1px 4px rgba(0,0,0,0.6)',
              zIndex:     20,
            }}
          >
            {pr.toLocaleString()}
          </div>
        )}

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
            color:         isActiveTurn ? '#f8fafc' : 'rgba(226,232,240,0.5)',
            textShadow:    isActiveTurn ? '0 0 8px rgba(248,250,252,0.65)' : 'none',
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
