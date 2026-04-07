/** Tiempo que se muestra el anuncio antes del modal de fin de partida (ms). */
export const OPPONENT_ABANDON_ANNOUNCE_MS = 2800;

/**
 * ¿Debe ver el banner solo el ganador cuando el rival perdió por abandono/desconexión?
 */
export function shouldShowOpponentAbandonAnnouncement(payload, myUserId) {
  if (!payload?.forfeit || myUserId == null) return false;
  if (String(payload.winnerId) !== String(myUserId)) return false;
  return (
    payload.disconnectedPlayerId != null ||
    payload.forfeitingUserId != null
  );
}

export function getAbandonReason(payload) {
  if (payload?.disconnectedPlayerId != null) return 'disconnect';
  if (payload?.forfeitingUserId != null) return 'forfeit';
  return 'forfeit';
}

export function getAbandoningOpponentUserId(payload) {
  return payload?.disconnectedPlayerId ?? payload?.forfeitingUserId ?? null;
}
