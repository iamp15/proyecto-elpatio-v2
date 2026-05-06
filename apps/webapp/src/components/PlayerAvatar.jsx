import PlayerProfileFrame from '../pages/Juegos/domino/components/PlayerProfileFrame';
import { ITEM_CATALOG } from '../lib/inventory/itemCatalog';
import { resolveDisplayName } from '../lib/userDisplayName';
import { isVipUser, vipDisplayNameStyleOnDark } from '../lib/vipUserUi';

const DEFAULT_AVATAR_ID = 'avatar_default';
const DEFAULT_FRAME_ID = 'frame_bronce';
const DEFAULT_BADGE_ID = 'badge_bronce';

function getCatalogImageUrl(itemId, fallbackItemId) {
  return ITEM_CATALOG[itemId]?.iconUrl ?? ITEM_CATALOG[fallbackItemId]?.iconUrl ?? null;
}

/**
 * Componente modular del avatar del jugador que aplica los cosméticos equipados.
 * Ahora es exclusivo para Dominó, eliminando la dualidad de contextos.
 *
 * @param {object} props 
 * @param {object} props.user - Objeto usuario con campos:
 *   - nickname, tg_firstName, first_name, tg_username, username: nombre mostrado (ver resolveDisplayName)
 *   - pr, rank: datos de partida/perfil
 *   - avatar_id, frame_id, badge_id: IDs equipados del catálogo maestro
 *   - vip_status: { is_vip?: boolean, ... } — si is_vip es true y showVipCapsule, cápsula en el marco; en partida el nombre puede ir en verde
 * @param {('small'|'medium'|'large')} [props.size='medium'] - Tamaño del avatar.
 * @param {boolean} [props.showName=true] - Mostrar nombre debajo del avatar.
 * @param {boolean} [props.showPR=false] - Mostrar PR (solo tiene sentido en partida de dominó).
 * @param {boolean} [props.showNameLabel=false] - Nombre encima del círculo (típico en mesa); fuera de partida suele ir en false.
 * @param {('left'|'right')} [props.layoutSide='left'] - Lado del marcador de puntos (partida).
 * @param {boolean} [props.isActiveTurn=false] - Resalta turno activo (partida).
 * @param {number} [props.score=0] - Puntos actuales en la liga (partida).
 * @param {number|null} [props.targetScore=null] - Objetivo de puntos (partida).
 * @param {number|null} [props.tileCount=null] - Fichas en mano del rival (partida).
 * @param {boolean} [props.showVipCapsule=true] - En false (p. ej. partida) se oculta la cápsula VIP; el nombre puede resaltarse en verde.
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
  showVipCapsule = true,
}) {
  // Valores por defecto seguros
  const {
    pr = 1000,
    avatar_id = DEFAULT_AVATAR_ID,
    frame_id = DEFAULT_FRAME_ID,
    badge_id = DEFAULT_BADGE_ID,
  } = user || {};

  const isVip = isVipUser(user);
  const displayName = resolveDisplayName(user, 'Jugador');

  // Los cosméticos se resuelven exclusivamente como imágenes del catálogo.
  const player = {
    name: displayName,
    avatarUrl: getCatalogImageUrl(avatar_id, DEFAULT_AVATAR_ID),
    frameUrl: getCatalogImageUrl(frame_id, DEFAULT_FRAME_ID),
    badgeUrl: getCatalogImageUrl(badge_id, DEFAULT_BADGE_ID),
    pr,
    isVip,
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <div>
        <PlayerProfileFrame
          player={player}
          size={size}
          layoutSide={layoutSide}
          isActiveTurn={isActiveTurn}
          score={score}
          targetScore={targetScore}
          tileCount={tileCount}
          showPr={showPR}
          showNameLabel={showNameLabel}
          showVipCapsule={showVipCapsule}
        />
      </div>
      {showName && (
        <span
          className="mt-2 text-sm font-semibold text-white truncate max-w-[100px]"
          title={displayName}
          style={isVipUser(user) ? vipDisplayNameStyleOnDark() : undefined}
        >
          {displayName}
        </span>
      )}
    </div>
  );
}