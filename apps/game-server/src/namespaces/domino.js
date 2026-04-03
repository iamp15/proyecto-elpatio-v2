const { authSocket } = require('../middleware/authSocket');
const { RoomManager } = require('../matchmaking/RoomManager');
const { MatchmakingQueue } = require('../matchmaking/MatchmakingQueue');
const { createDefaultQueueStore } = require('../matchmaking/QueueStore');
const { chargeEntryFees } = require('../matchmaking/chargeEntryFees');
const { handleGameOver } = require('../matchmaking/handleGameOver');
const { enrichPlayersWithUsernames } = require('../matchmaking/enrichPlayers');
const configManager = require('../config/ConfigManager');
const { User } = require('@el-patio/database');
const timerManager = require('../utils/TimerManager');
const { setupDominoHeartbeat } = require('../sockets/setupDominoHeartbeat');

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

  /**
   * Propaga el resultado de una acción (autoplay o game_action) a todos los
   * jugadores de la sala, gestionando fin de mano, fin de partida y turno normal.
   */
  async function _broadcastResult(room, result) {
    if (result.gameOver === true) {
      room.players.forEach((p) => {
        p.socket?.emit('game_state', room.game.getState(p.userId));
      });
      nsp.to(room.roomId).emit('round_over', {
        roundWinner:   result.roundWinner,
        pointsWon:     result.pointsWon,
        currentScores: result.finalScores,
        revealedHands: result.revealedHands,
        isFinal:       true,
        isBlocked:     result.isBlocked,
      });
      await handleGameOver(room, result.winnerId, nsp, result.finalScores);
      room.players.forEach((p) => {
        p.socket.data.currentRoom = null;
      });
      roomManager.delete(room.roomId);

    } else if (result.roundOver === true) {
      room.players.forEach((p) => {
        p.socket?.emit('game_state', room.game.getState(p.userId));
      });
      nsp.to(room.roomId).emit('round_over', {
        roundWinner:   result.roundWinner,
        pointsWon:     result.pointsWon,
        currentScores: result.currentScores,
        revealedHands: result.revealedHands,
        isBlocked:     result.isBlocked,
      });
      setTimeout(() => {
        if (room.status === 'FINISHED') return;
        room.game.startNextRound();
        room.players.forEach((p) => {
          p.socket?.emit('game_state', room.game.getState(p.userId));
        });
      }, 7500);

    } else {
      room.players.forEach((p) => {
        p.socket?.emit('game_state', room.game.getState(p.userId));
      });
    }
  }

  // ── Auto-Play por timeout: revisa todas las salas cada 500ms ───────────────
  //
  // Cuando expira el turno, _planAutoPlay() devuelve la secuencia de acciones
  // (robos + acción final) SIN tocar el estado. Luego ejecutamos cada paso con
  // un delay de AUTOPLAY_STEP_MS para que el cliente pueda mostrar las animaciones.
  const AUTOPLAY_STEP_MS = 650;

  setInterval(() => {
    for (const room of roomManager._rooms.values()) {
      if (room.status !== 'IN_GAME' || !room.game) continue;
      if (room._autoPlayPending) continue; // secuencia en curso, no re-disparar

      try {
        // NO procesar autoplay si la sala está en estado suspendido
        if (room.suspended) {
          continue;
        }
        
        // 1. Verificar timeouts normales (30s)
        const timeout = room.game.checkTimeouts();
        if (timeout) {
          const { timedOutPlayerId, plan } = timeout;
          console.log(
            `[Domino] Auto-Play por timeout sala=${room.roomId} jugador=${timedOutPlayerId} pasos=${plan.length}`,
          );

          room._autoPlayPending = true;

          plan.forEach((action, i) => {
            const isLast = i === plan.length - 1;

            setTimeout(async () => {
              try {
                // Guardia: la sala/partida puede haber terminado entre steps
                if (!room.game || room.status !== 'IN_GAME') {
                  room._autoPlayPending = false;
                  return;
                }
                // Guardia: si el jugador ya actuó manualmente, cancelamos
                if (room.game.turn !== timedOutPlayerId && !isLast) {
                  room._autoPlayPending = false;
                  return;
                }

                // Notificar al cliente para reproducir el sonido del paso
                nsp.to(room.roomId).emit('autoplay_action', { actionType: action.actionType });

                const stepResult = room.game.handleAction(timedOutPlayerId, action);

                if (isLast) {
                  room._autoPlayPending = false;
                  await _broadcastResult(room, stepResult);
                } else {
                  // Paso intermedio (robo): emitir estado actualizado a cada jugador
                  room.players.forEach((p) => {
                    p.socket?.emit('game_state', room.game.getState(p.userId));
                  });
                }
              } catch (err) {
                room._autoPlayPending = false;
                console.error(`[Domino] Error en step ${i} autoplay (sala=${room.roomId}):`, err.message);
              }
            }, i * AUTOPLAY_STEP_MS);
          });
        }
        
        // 2. Verificar autoplay por desconexión (90s)
        const currentTurn = room.game.turn;
        if (currentTurn && room.autoplayEnabled.get(currentTurn) && !room.suspended) {
          // Jugador desconectado con autoplay activado
          console.log(`[Domino] Autoplay por desconexión sala=${room.roomId} jugador=${currentTurn}`);
          
          const plan = room.game._planAutoPlay();
          if (plan.length > 0) {
            room._autoPlayPending = true;

            plan.forEach((action, i) => {
              const isLast = i === plan.length - 1;

              setTimeout(async () => {
                try {
                  // Guardia: la sala/partida puede haber terminado entre steps
                  if (!room.game || room.status !== 'IN_GAME') {
                    room._autoPlayPending = false;
                    return;
                  }
                  // Guardia: si el jugador ya actuó manualmente, cancelamos
                  if (room.game.turn !== currentTurn && !isLast) {
                    room._autoPlayPending = false;
                    return;
                  }
                  // Guardia: si el jugador ya se reconectó, cancelamos
                  if (!room.autoplayEnabled.get(currentTurn)) {
                    room._autoPlayPending = false;
                    return;
                  }

                  // Notificar al cliente para reproducir el sonido del paso
                  nsp.to(room.roomId).emit('autoplay_action', { actionType: action.actionType });

                  const stepResult = room.game.handleAction(currentTurn, action);

                  if (isLast) {
                    room._autoPlayPending = false;
                    await _broadcastResult(room, stepResult);
                  } else {
                    // Paso intermedio (robo): emitir estado actualizado a cada jugador
                    room.players.forEach((p) => {
                      p.socket?.emit('game_state', room.game.getState(p.userId));
                    });
                  }
                } catch (err) {
                  room._autoPlayPending = false;
                  console.error(`[Domino] Error en step ${i} autoplay por desconexión (sala=${room.roomId}):`, err.message);
                }
              }, i * AUTOPLAY_STEP_MS);
            });
          }
        }

      } catch (err) {
        console.error(`[Domino] Error en timeout check (sala=${room.roomId}):`, err.message);
      }
    }
  }, 500);

  // ── Auth middleware ──────────────────────────────────────────────────────────
  nsp.use(authSocket);

  // ── Conexión ────────────────────────────────────────────────────────────────
  nsp.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.data.currentRoom = null;
    socket.data.inQueue = false;

    console.log(`[Domino] Conectado: userId=${userId} (socket=${socket.id})`);

    void (async () => {
      try {
        const room = roomManager.findActiveGameRoomForUser(userId);
        if (room?.game && room.players.some((p) => Number(p.userId) === Number(userId))) {
          const enrichedPlayers = await enrichPlayersWithUsernames(room);
          socket.emit('reconnect_game', {
            roomId: room.roomId,
            categoryId: room.modeId,
            config: room.config,
            players: enrichedPlayers,
            state: room.game.getState(userId),
          });
          console.log(`[Domino] reconnect_game (handshake) userId=${userId} room=${room.roomId}`);
        }
      } catch (err) {
        console.error(`[Domino] Error handshake reconnect_game (userId=${userId}):`, err.message);
      }
      socket.emit('init_lobby_config', {
        categories: configManager.getAllRanks('domino').map((c) => ({
          ...c,
          maxPR: c.maxPR === Infinity ? null : c.maxPR,
        })),
      });
    })();

    setupDominoHeartbeat(socket);

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

        const player = room.players.find((p) => Number(p.userId) === Number(userId));
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

        // NUEVO: Limpiar estado de desconexión si el jugador estaba desconectado
        room.handlePlayerReconnect(userId, socket);

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
        await _broadcastResult(room, result);

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

    // ── forfeit_game ───────────────────────────────────────────────────────────
    socket.on('forfeit_game', async () => {
      try {
        const room = socket.data.currentRoom;

        if (!room || room.status !== 'IN_GAME') {
          return socket.emit('error', { message: 'No hay partida activa en tu sala.' });
        }

        if (!room.game?.getForfeitResult) {
          return socket.emit('error', { message: 'El motor de juego no soporta abandono.' });
        }

        const { winnerId, finalScores } = room.game.getForfeitResult(userId);
        if (!winnerId) {
          return socket.emit('error', { message: 'No se pudo determinar el ganador por abandono.' });
        }

        await handleGameOver(room, winnerId, nsp, finalScores);

        for (const player of room.players) {
          player.socket.data.currentRoom = null;
        }

        roomManager.delete(room.roomId);
      } catch (err) {
        console.error(`[Domino] Error en forfeit_game (userId=${userId}):`, err.message);
        socket.emit('error', { message: 'Error al procesar el abandono de partida.' });
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
          // Lógica existente para salas en espera
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
        } else if (room.status === 'IN_GAME') {
          // NUEVA LÓGICA: Manejar desconexión durante partida
          room.handlePlayerDisconnect(userId);
        }
        
        socket.data.currentRoom = null;
      }
    });
  });

  // Health check adicional específico para salas de dominó
  setInterval(() => {
    // Verificar integridad del TimerManager
    const integrity = timerManager.checkIntegrity();
    
    if (integrity.orphanedTimers.length > 0) {
      console.warn(`[Domino Timer Health] ${integrity.orphanedTimers.length} timers huérfanos detectados`);
    }
    
    // Log detallado solo si hay actividad
    if (integrity.activeTimers > 0) {
      console.log(`[Domino Timer Health] Estado: ${integrity.activeTimers} timers, ${integrity.activeRooms} salas`);
    }
    
    // Verificar salas suspendidas
    const suspendedRooms = [];
    for (const room of roomManager._rooms.values()) {
      if (room.suspended) {
        suspendedRooms.push({
          roomId: room.roomId,
          suspendedSince: room.allDisconnectedSince
        });
      }
    }
    
    if (suspendedRooms.length > 0) {
      console.log(`[Domino Timer Health] ${suspendedRooms.length} salas en estado suspendido`);
    }
  }, 60000); // Cada minuto

  return nsp;
}

module.exports = { createDominoNamespace };
