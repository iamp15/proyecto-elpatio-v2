/**
 * Ejecuta un plan de autoplay (timeout de turno) con retraso humano inicial y pasos espaciados.
 * Emite `autoplay_action` antes de cada `handleAction` (mismo contrato que el cliente ya usa).
 */

const INTRO_MS_MIN = 1500;
const INTRO_MS_MAX = 2500;
const STEP_MS = 650;

function randomIntroMs() {
  return INTRO_MS_MIN + Math.random() * (INTRO_MS_MAX - INTRO_MS_MIN);
}

/**
 * @param {object} opts
 * @param {object} opts.room
 * @param {import('socket.io').Namespace} opts.nsp
 * @param {number|string} opts.actorUserId
 * @param {Array<{actionType: string}>} opts.plan
 * @param {(room: object, result: object) => Promise<void>} opts.broadcastResult
 */
function runDominoAutoplayPlan({ room, nsp, actorUserId, plan, broadcastResult }) {
  if (!plan?.length) return;

  const introMs = randomIntroMs();
  room._autoPlayPending = true;

  plan.forEach((action, i) => {
    const isLast = i === plan.length - 1;

    setTimeout(async () => {
      try {
        if (!room.game || room.status !== 'IN_GAME') {
          room._autoPlayPending = false;
          return;
        }
        if (room.game.turn !== actorUserId && !isLast) {
          room._autoPlayPending = false;
          return;
        }

        nsp.to(room.roomId).emit('autoplay_action', { actionType: action.actionType });

        const stepResult = room.game.handleAction(actorUserId, action);

        if (isLast) {
          room._autoPlayPending = false;
          await broadcastResult(room, stepResult);
        } else {
          room.players.forEach((p) => {
            p.socket?.emit('game_state', room.game.getState(p.userId));
          });
        }
      } catch (err) {
        room._autoPlayPending = false;
        console.error(
          `[runDominoAutoplayPlan] Error en step ${i} (sala=${room.roomId}):`,
          err.message,
        );
      }
    }, introMs + i * STEP_MS);
  });
}

module.exports = { runDominoAutoplayPlan, INTRO_MS_MIN, INTRO_MS_MAX, STEP_MS };
