import PlayerProfileFrame from '../pages/Juegos/domino/components/PlayerProfileFrame';
import { resolveDisplayName } from '../lib/userDisplayName';

/**
 * Mapeo de IDs de badge a variantes del componente PlayerBadge.
 * Mantener sincronizado con la constante BADGE_VARIANT_MAP en Profile.jsx.
 */
const BADGE_VARIANT_MAP = {
  default: 'default',
  vip: 'vip',
  torneo: 'torneo',
  fundador: 'fundador',
  winner: 'default',
  streak: 'default',
};

/**
 * Componente modular del avatar del jugador que aplica los cosméticos equipados.
 * Ahora es exclusivo para Dominó, eliminando la dualidad de contextos.
 *
 * @param {object} props 
 * @param {object} props.user - Objeto usuario con campos:
 *   - photo_url: URL de la foto de Telegram (opcional)
 *   - nickname, tg_firstName, first_name, tg_username, username: nombre mostrado (ver resolveDisplayName)
 *   - pr, rank: para color del marco
 *   - avatar_id: ID del avatar equipado (por ahora 'telegram' o 'default')
 *   - frame_id: ID del marco equipado
 *   - badge_id: ID del badge equipado
 * @param {('small'|'medium'|'large')} [props.size='medium'] - Tamaño del avatar.
 * @param {boolean} [props.showName=true] - Mostrar nombre debajo del avatar.
 * @param {boolean} [props.showPR=false] - Mostrar PR (solo tiene sentido en partida de dominó).
 * @param {boolean} [props.showNameLabel=false] - Nombre encima del círculo (típico en mesa); fuera de partida suele ir en false.
 * @param {('left'|'right')} [props.layoutSide='left'] - Lado del marcador de puntos (partida).
 * @param {boolean} [props.isActiveTurn=false] - Resalta turno activo (partida).
 * @param {number} [props.score=0] - Puntos actuales en la liga (partida).
 * @param {number|null} [props.targetScore=null] - Objetivo de puntos (partida).
 * @param {number|null} [props.tileCount=null] - Fichas en mano del rival (partida).
 */
export default function PlayerAvatar({
  user,
  size = 'medium',
  showName = true,
  showPR = false,
  showNameLabel = false,
  layoutSide = 'left',
  isActiveTurn = false,
  score = 0,
  targetScore = null,
  tileCount = null,
}) {
  // Valores por defecto seguros
  const {
    photo_url,
    pr = 1000,
    rank = 'BRONCE',
    avatar_id = 'telegram',
    frame_id = 'rank',
    badge_id = 'default',
  } = user || {};

  // Mapear badge ID a variant
  const badgeVariant = BADGE_VARIANT_MAP[badge_id] || 'default';

  // Determinar avatar URL (si avatar_id es 'telegram' y hay photo_url)
  const avatarUrl = avatar_id === 'telegram' && photo_url ? photo_url : null;

  const displayName = resolveDisplayName(user, 'Jugador');

  // PlayerProfileFrame espera un objeto `player` con esta estructura:
  const player = {
    name: displayName,
    avatarUrl,
    pr,
    rankColor: rank,
    badgeVariant,
  };

  // Tamaños (pueden ajustarse según diseño)
  const sizeStyles = {
    small: { transform: 'scale(0.75)' },
    medium: { transform: 'scale(1)' },
    large: { transform: 'scale(1.5)' },
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <div style={sizeStyles[size]}>
        <PlayerProfileFrame
          player={player}
          layoutSide={layoutSide}
          isActiveTurn={isActiveTurn}
          score={score}
          targetScore={targetScore}
          tileCount={tileCount}
          showPr={showPR}
          showNameLabel={showNameLabel}
        />
      </div>
      {showName && (
        <span
          className="mt-2 text-sm font-semibold text-white truncate max-w-[100px]"
          title={displayName}
        >
          {displayName}
        </span>
      )}
    </div>
  );
}