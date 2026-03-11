const { authSocket } = require('../middleware/authSocket');
const { RoomManager } = require('../matchmaking/RoomManager');
const { MatchmakingQueue } = require('../matchmaking/MatchmakingQueue');
const { createDefaultQueueStore } = require('../matchmaking/QueueStore');
const { chargeEntryFees } = require('../matchmaking/chargeEntryFees');
const { handleGameOver } = require('../matchmaking/handleGameOver');
const { enrichPlayersWithUsernames } = require('../matchmaking/enrichPlayers');
const configManager = require('../config/ConfigManager');
const { User } = require('@el-patio/database');

/**
 * Registra el namespace /domino en la instancia de Socket.io.
 * @param {import('socket.io').Server} io
 */
function createDominoNamespace(io) {
  const nsp = io.of('/domino');
  const roomManager = new RoomManager();
  const queueStore = createDefaultQueueStore();
  const matchmakingQueue = new MatchmakingQueue(roomManager, nsp, queueStore);
  matchmakingQueue.start();

  // ── Auth middleware ──────────────────────────────────────────────────────────
  nsp.use(authSocket);

  // ── Conexión ────────────────────────────────────────────────────────────────
  nsp.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.data.currentRoom = null;
    socket.data.inQueue = false;

    console.log(`[Domino] Conectado: userId=${userId} (socket=${socket.id})`);

    // ── Configuración inicial del lobby ────────────────────────────────────────
    socket.emit('init_lobby_config', {
      categories: configManager.getAllRanks('domino').map((c) => ({
        ...c,
        maxPR: c.maxPR === Infinity ? null : c.maxPR,
      })),
    });

    // ── join_queue ─────────────────────────────────────────────────────────────
    socket.on('join_queue', async ({ categoryId, allowLowerLeague = false } = {}) => {
      try {
        // 1. Validar categoryId
        const config = configManager.getRankConfig('domino', categoryId);
        if (!config) {
          return socket.emit('error', { message: `Categoría de rango inválida: ${categoryId}` });
        }

        // 2. Fase 1: solo BRONCE y PLATA (maxPlayers === 2)
        if (config.maxPlayers !== 2) {
          return socket.emit('error', {
            message: 'El matchmaking para esta categoría aún no está disponible. Próximamente.',
          });
        }

        // 3. Evitar que un jugador esté en cola o sala a la vez
        if (socket.data.currentRoom || socket.data.inQueue) {
          return socket.emit('error', { message: 'Ya estás en cola. Sal antes de unirte a otra.' });
        }

        // 4. Consultar datos frescos del usuario desde la DB
        const freshUser = await User.findById(userId).lean();
        if (!freshUser) {
          return socket.emit('error', { message: 'Usuario no encontrado.' });
        }

        // 5. Validar acceso por rango
        const userPR   = freshUser.pr ?? 1000;
        const userRank = freshUser.rank ?? configManager.getRankForPR('domino', userPR);
        if (!configManager.isCategoryAccessible('domino', userRank, categoryId)) {
          return socket.emit('pr_out_of_range', {
            message:     `Tu rango (${userRank}) no permite acceder a ${config.label}. Desbloquea categorías superiores subiendo de rango.`,
            userPR,
            userRank,
            categoryId,
          });
        }

        // 6. Validar saldo suficiente
        if (freshUser.balance_subunits < config.entryFee_subunits) {
          return socket.emit('insufficient_balance', {
            message:  'Saldo insuficiente para unirte a esta partida.',
            required: config.entryFee_subunits / 100,
            current:  freshUser.balance_subunits / 100,
          });
        }

        // 7. Añadir a la cola de matchmaking (tick-based)
        const result = matchmakingQueue.addPlayer(socket, categoryId, allowLowerLeague, userPR);
        if (!result.ok) {
          return socket.emit('error', { message: result.error });
        }

        socket.data.inQueue = true;
      } catch (err) {
        console.error(`[Domino] Error en join_queue (userId=${userId}):`, err.message);
        socket.emit('error', { message: 'Error interno al unirse a la cola.' });
      }
    });

    // ── leave_queue ───────────────────────────────────────────────────────────
    socket.on('leave_queue', () => {
      if (socket.data.inQueue) {
        matchmakingQueue.removePlayer(socket.id);
        socket.data.inQueue = false;
      }
    });

    // ── rejoin_room ────────────────────────────────────────────────────────────
    socket.on('rejoin_room', async ({ roomId } = {}) => {
      try {
        if (!roomId) {
          return socket.emit('rejoin_error', { message: 'roomId requerido.' });
        }

        const room = roomManager.getRoom(roomId);

        if (!room || room.status !== 'IN_GAME') {
          return socket.emit('rejoin_error', {
            message: 'La partida ya no está disponible.',
            code:    'ROOM_NOT_FOUND',
          });
        }

        const player = room.players.find((p) => p.userId === userId);
        if (!player) {
          return socket.emit('rejoin_error', {
            message: 'No perteneces a esta sala.',
            code:    'NOT_A_PLAYER',
          });
        }

        player.socket   = socket;
        player.socketId = socket.id;
        socket.join(roomId);
        socket.data.currentRoom = room;

        const enrichedPlayers = await enrichPlayersWithUsernames(room);
        socket.emit('game_rejoined', {
          roomId,
          categoryId: room.modeId,
          config:     room.config,
          players:    enrichedPlayers,
          state:      room.game.getState(userId),
        });

        console.log(`[Domino] userId=${userId} reconectado a sala ${roomId} (socket=${socket.id})`);

      } catch (err) {
        console.error(`[Domino] Error en rejoin_room (userId=${userId}):`, err.message);
        socket.emit('rejoin_error', { message: 'Error interno al reconectar.' });
      }
    });

    // ── game_action ────────────────────────────────────────────────────────────
    socket.on('game_action', async ({ actionType, ...data } = {}) => {
      try {
        const room = socket.data.currentRoom;

        if (!room || room.status !== 'IN_GAME') {
          return socket.emit('error', { message: 'No hay partida activa en tu sala.' });
        }

        if (!room.game) {
          return socket.emit('error', { message: 'El motor de juego no está inicializado.' });
        }

        if (!actionType) {
          return socket.emit('error', { message: 'Debes indicar un actionType.' });
        }

        const validation = room.game.validateMove(userId, { actionType, ...data });
        if (!validation.valid) {
          return socket.emit('invalid_move', { reason: validation.reason });
        }

        const result = room.game.handleAction(userId, { actionType, ...data });

        if (result.gameOver === true) {
          // Fin definitivo de la partida (Alguien alcanzó la meta de puntos)
          // Emitimos el estado una última vez para que se vea la última jugada
          room.players.forEach((p) => {
            p.socket.emit('game_state', room.game.getState(p.userId));
          });
          await handleGameOver(room, result.winnerId, nsp, result.finalScores);

          room.players.forEach((p) => {
            p.socket.data.currentRoom = null;
          });
          roomManager.delete(room.roomId);

        } else if (result.roundOver === true) {
          // 1. Emitir el estado actual para que vean la última ficha que se jugó
          room.players.forEach((p) => {
            p.socket.emit('game_state', room.game.getState(p.userId));
          });

          // 2. Emitir evento de fin de mano para mostrar la animación de puntos
          const roomId = room.roomId;
          nsp.to(roomId).emit('round_over', {
            roundWinner: result.roundWinner,
            pointsWon: result.pointsWon,
            currentScores: result.currentScores
          });

          // 3. Pausa de 5 segundos y luego iniciar la siguiente ronda automáticamente
          setTimeout(() => {
            if (room.status === 'FINISHED') return; // Prevención de bugs si alguien se desconectó

            room.game.startNextRound();

            // 4. Enviar el nuevo estado (tablero limpio, nueva mano)
            room.players.forEach((p) => {
              p.socket.emit('game_state', room.game.getState(p.userId));
            });
          }, 5000);

        } else {
          // Turno normal: actualizar el estado a todos los jugadores
          room.players.forEach((p) => {
            p.socket.emit('game_state', room.game.getState(p.userId));
          });
        }

      } catch (err) {
        console.error(`[Domino] Error en game_action (userId=${userId}):`, err.message);
        socket.emit('error', { message: 'Error interno al procesar la acción.' });
      }
    });

    // ── send_chat ───────────────────────────────────────────────────────────────
    socket.on('send_chat', (payload) => {
      const room = socket.data.currentRoom;
      const roomId = room?.roomId;
      if (!roomId || room?.status !== 'IN_GAME') return;
      nsp.to(roomId).emit('chat_message', {
        userId,
        type: payload?.type ?? 'text',
        content: payload?.content ?? '',
      });
    });

    // ── game_over ──────────────────────────────────────────────────────────────
    socket.on('game_over', async ({ winnerId } = {}) => {
      try {
        const room = socket.data.currentRoom;

        if (!room || room.status !== 'IN_GAME') {
          return socket.emit('error', { message: 'No hay partida activa en tu sala.' });
        }

        if (!room.players.some((p) => p.userId === winnerId)) {
          return socket.emit('error', { message: 'El winnerId no pertenece a esta sala.' });
        }

        const finalScores = room.game?._getFinalScores?.() ?? {};
        await handleGameOver(room, winnerId, nsp, finalScores);

        for (const player of room.players) {
          player.socket.data.currentRoom = null;
        }

        roomManager.delete(room.roomId);

      } catch (err) {
        console.error(`[Domino] Error en game_over (userId=${userId}):`, err.message);
        socket.emit('error', { message: 'Error al procesar el fin de partida.' });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Domino] Desconectado: userId=${userId} (socket=${socket.id})`);

      if (socket.data.inQueue) {
        matchmakingQueue.removePlayer(socket.id);
        socket.data.inQueue = false;
      }

      const room = socket.data.currentRoom;
      if (room) {
        if (room.status === 'WAITING') {
          room.removePlayer(userId);
          if (room.players.length === 0) {
            roomManager.delete(room.roomId);
          } else {
            nsp.to(room.roomId).emit('player_removed', {
              userId,
              reason:  'disconnect',
              message: 'Un jugador se desconectó.',
            });
            nsp.to(room.roomId).emit('queue_update', {
              roomId:     room.roomId,
              categoryId: room.modeId,
              players:    room.getPublicPlayers(),
              needed:     room.config.maxPlayers - room.players.length,
            });
          }
        }
        socket.data.currentRoom = null;
      }
    });
  });

  return nsp;
}

module.exports = { createDominoNamespace };
