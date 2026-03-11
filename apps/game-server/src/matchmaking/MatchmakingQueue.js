const configManager = require('../config/ConfigManager');
const { chargeEntryFees } = require('./chargeEntryFees');
const { enrichPlayersWithUsernames } = require('./enrichPlayers');
const { createDefaultQueueStore } = require('./QueueStore');

/** Intervalo del tick de matchmaking (ms). */
const TICK_INTERVAL_MS = 1500;

/** Rango base de PR permitido para emparejar. */
const BASE_PR_RANGE = 50;

/** Expansión de rango por segundo en cola. */
const PR_EXPANSION_PER_SECOND = 10;

/** Máximo emparejamientos por ciclo de tick. */
const MAX_MATCHES_PER_TICK = 5;

/** Umbral para diferir evaluación con setImmediate. */
const LARGE_QUEUE_THRESHOLD = 200;

/** gameId para dominó (usado al crear salas). */
const GAME_ID = 'domino';

/** Categorías 2v2 (Fase 1). */
const CATEGORIES_2V2 = ['BRONCE', 'PLATA'];

/**
 * Cola de matchmaking tick-based para dominó.
 * Consume datos EXCLUSIVAMENTE a través de QueueStore.
 * Solo procesa categorías de 2 jugadores (BRONCE, PLATA).
 */
class MatchmakingQueue {
  /**
   * @param {import('./RoomManager')} roomManager
   * @param {import('socket.io').Namespace} nsp
   * @param {import('./QueueStore').InMemoryQueueStore} [queueStore] - Inyectable; por defecto InMemoryQueueStore
   */
  constructor(roomManager, nsp, queueStore = null) {
    this.roomManager = roomManager;
    this.nsp = nsp;
    this.queueStore = queueStore ?? createDefaultQueueStore();
    this._tickInterval = null;
  }

  /** Inicia el bucle de matchmaking. */
  start() {
    if (this._tickInterval) return;
    this._tickInterval = setInterval(() => this._tick(), TICK_INTERVAL_MS);
    console.log('[MatchmakingQueue] Tick iniciado (intervalo:', TICK_INTERVAL_MS, 'ms)');
  }

  /** Detiene el bucle de matchmaking. */
  stop() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
      console.log('[MatchmakingQueue] Tick detenido');
    }
  }

  /**
   * Añade un jugador a la cola. Solo categorías con maxPlayers === 2.
   * @param {import('socket.io').Socket} socket
   * @param {string} categoryId
   * @param {boolean} allowLowerLeague
   * @param {number} pr
   * @returns {{ ok: boolean, error?: string }}
   */
  addPlayer(socket, categoryId, allowLowerLeague, pr) {
    const config = configManager.getRankConfig(GAME_ID, categoryId);
    if (!config || config.maxPlayers !== 2) {
      return {
        ok:    false,
        error: 'El matchmaking para esta categoría aún no está disponible. Próximamente.',
      };
    }

    const userId = socket.data.userId;
    if (this.queueStore.hasPlayer(userId)) {
      return { ok: false, error: 'Ya estás en la cola.' };
    }

    const player = {
      userId,
      socketId: socket.id,
      socket,
      pr,
      categoryId,
      allowLowerLeague: !!allowLowerLeague,
      joinTime: Date.now(),
    };

    const result = this.queueStore.addPlayer(player);
    if (!result.ok) {
      return result;
    }

    socket.emit('queue_joined', { categoryId });
    const total = this.queueStore.getTotal2v2Count();
    console.log(`[MatchmakingQueue] userId=${userId} (PR=${pr}) añadido a cola [${categoryId}] (total 2v2: ${total})`);

    if (total >= 2) {
      this._tick().catch((err) =>
        console.error('[MatchmakingQueue] Error en evaluación al entrar:', err.message),
      );
    }

    return { ok: true };
  }

  /**
   * Elimina un jugador de la cola por socketId.
   * @param {string} socketId
   */
  removePlayer(socketId) {
    const removed = this.queueStore.removePlayer(socketId);
    if (removed) {
      const total = this.queueStore.getTotal2v2Count();
      console.log(`[MatchmakingQueue] socketId=${socketId} eliminado de cola (restantes 2v2: ${total})`);
    }
  }

  /** @returns {boolean} */
  isInQueue(userId) {
    return this.queueStore.hasPlayer(userId);
  }

  _getRankIndex(categoryId) {
    const ranksList = configManager.getAllRanks(GAME_ID);
    return ranksList.findIndex((r) => r.categoryId === categoryId);
  }

  _getSearchRadius(p, now) {
    const secondsInQueue = (now - p.joinTime) / 1000;
    return BASE_PR_RANGE + Math.floor(PR_EXPANSION_PER_SECOND * secondsInQueue);
  }

  /** @deprecated Usar _getSearchRadius. Mantenido por compatibilidad con _canMatch. */
  _getMaxDeltaAllowed(p, now) {
    return this._getSearchRadius(p, now);
  }

  /**
   * Obtiene candidatos para un jugador aplicando Waterfall Search (Cross-Bucket Peeking).
   * Incluye su liga actual y, si allowLowerLeague y minAcceptablePR en rango inferior, la liga inferior.
   * @param {object} player
   * @param {number} now
   * @returns {object[]}
   */
  _getCandidatesForPlayer(player, now) {
    const ownLeague = this.queueStore.getPlayersByCategory(player.categoryId)
      .filter((p) => p.userId !== player.userId);
    let candidates = [...ownLeague];

    const lowerCategoryId = configManager.getLowerCategory(GAME_ID, player.categoryId);
    if (!lowerCategoryId || !player.allowLowerLeague) return candidates;

    const lowerConfig = configManager.getRankConfig(GAME_ID, lowerCategoryId);
    if (!lowerConfig) return candidates;

    const searchRadius = this._getSearchRadius(player, now);
    const minAcceptablePR = player.pr - searchRadius;
    const inLowerRange = minAcceptablePR >= lowerConfig.minPR && minAcceptablePR <= lowerConfig.maxPR;
    if (!inLowerRange) return candidates;

    const lowerPlayers = this.queueStore.getPlayersByCategory(lowerCategoryId);
    candidates = candidates.concat(lowerPlayers);
    return candidates;
  }

  _canMatch(p1, p2, now) {
    const deltaPR = Math.abs(p1.pr - p2.pr);
    const idx1 = this._getRankIndex(p1.categoryId);
    const idx2 = this._getRankIndex(p2.categoryId);

    if (idx1 < 0 || idx2 < 0) return { valid: false };

    if (p1.categoryId === p2.categoryId) {
      const maxDelta = Math.min(
        this._getMaxDeltaAllowed(p1, now),
        this._getMaxDeltaAllowed(p2, now),
      );
      if (deltaPR > maxDelta) return { valid: false };
      const config = configManager.getRankConfig(GAME_ID, p1.categoryId);
      return { valid: true, effectiveCategoryId: p1.categoryId, effectiveConfig: config };
    }

    const [higher, lower] = idx1 > idx2 ? [p1, p2] : [p2, p1];
    if (!higher.allowLowerLeague) return { valid: false };

    const maxDeltaHigher = this._getMaxDeltaAllowed(higher, now);
    if (deltaPR > maxDeltaHigher) return { valid: false };

    const config = configManager.getRankConfig(GAME_ID, lower.categoryId);
    return { valid: true, effectiveCategoryId: lower.categoryId, effectiveConfig: config };
  }

  /**
   * Encuentra la mejor pareja usando Waterfall Search.
   * Por cada jugador obtiene candidatos (liga actual + liga inferior si aplica), filtra por aceptación mutua,
   * ordena por menor Delta PR y mayor tiempo en cola.
   * @param {object[]} primaryPlayers - Jugadores de la categoría que se está procesando
   * @param {number} now
   * @returns {{ p1: object, p2: object, effectiveCategoryId: string, effectiveConfig: object } | null}
   */
  _findBestPair(primaryPlayers, now) {
    const validPairs = [];

    for (const player of primaryPlayers) {
      const candidates = this._getCandidatesForPlayer(player, now);
      for (const candidate of candidates) {
        if (player.userId >= candidate.userId) continue;
        const match = this._canMatch(player, candidate, now);
        if (!match.valid || !match.effectiveConfig) continue;

        const deltaPR = Math.abs(player.pr - candidate.pr);
        validPairs.push({
          p1: player,
          p2: candidate,
          deltaPR,
          minJoinTime: Math.min(player.joinTime, candidate.joinTime),
          effectiveCategoryId: match.effectiveCategoryId,
          effectiveConfig: match.effectiveConfig,
        });
      }
    }

    if (validPairs.length === 0) return null;

    validPairs.sort((a, b) => {
      if (a.deltaPR !== b.deltaPR) return a.deltaPR - b.deltaPR;
      return a.minJoinTime - b.minJoinTime;
    });

    const best = validPairs[0];
    return {
      p1: best.p1,
      p2: best.p2,
      effectiveCategoryId: best.effectiveCategoryId,
      effectiveConfig: best.effectiveConfig,
    };
  }

  async _processMatch(pair) {
    const { p1, p2, effectiveCategoryId, effectiveConfig } = pair;

    this.queueStore.removePlayer(p1.socketId);
    this.queueStore.removePlayer(p2.socketId);

    const room = this.roomManager.createRoomWithConfig(effectiveCategoryId, {
      ...effectiveConfig,
      gameType: 'domino',
    });

    try {
      p1.socket.data.pr = p1.pr;
      p2.socket.data.pr = p2.pr;
      room.addPlayer(p1.socket);
      room.addPlayer(p2.socket);
    } catch (err) {
      console.error('[MatchmakingQueue] Error añadiendo jugadores a sala:', err.message);
      this.roomManager.delete(room.roomId);
      return;
    }

    p1.socket.data.currentRoom = room;
    p2.socket.data.currentRoom = room;
    p1.socket.data.inQueue = false;
    p2.socket.data.inQueue = false;

    room.lock();
    console.log(`[MatchmakingQueue] Pareja encontrada: userId=${p1.userId} vs userId=${p2.userId} → sala ${room.roomId} [${effectiveCategoryId}]`);

    const result = await chargeEntryFees(room);

    if (result.success) {
      room.start();
      this.roomManager.startGame(room);

      for (const b of result.balancesAfter) {
        const player = room.players.find((p) => p.socketId === b.socketId);
        if (!player) continue;
        player.socket.emit('entry_fee_charged', {
          message:          '¡Entrada cobrada con éxito. Buena suerte!',
          balance_subunits: b.balance_subunits,
          piedras:          b.piedras,
        });
        player.socket.emit('balance_updated', {
          balance_subunits: b.balance_subunits,
          piedras:          b.piedras,
        });
      }

      const enrichedPlayers = await enrichPlayersWithUsernames(room);
      for (const player of room.players) {
        player.socket.emit('match_found', {
          roomId:     room.roomId,
          categoryId: room.modeId,
          config:     room.config,
          players:    enrichedPlayers,
        });
        player.socket.emit('game_start', {
          roomId:     room.roomId,
          categoryId: room.modeId,
          config:     room.config,
          players:    enrichedPlayers,
          state:      room.game.getState(player.userId),
        });
      }

      console.log(`[MatchmakingQueue] Partida iniciada en sala ${room.roomId} [${effectiveConfig.label}]`);
    } else {
      const { failedUserIds } = result;
      const playersSnapshot = [...room.players];

      for (const player of playersSnapshot) {
        if (failedUserIds.includes(player.userId)) {
          player.socket.emit('insufficient_balance', {
            message: 'No tienes saldo suficiente. La partida fue cancelada.',
          });
        } else {
          player.socket.emit('queue_reset', {
            message: 'Un jugador no tenía saldo. Volviendo a buscar partida...',
          });
        }
        player.socket.data.currentRoom = null;
      }

      this.roomManager.delete(room.roomId);
      console.log(`[MatchmakingQueue] Sala ${room.roomId} desmontada. Fallidos: [${failedUserIds.join(', ')}]`);
    }
  }

  /**
   * Procesa una categoría: evalúa parejas con Waterfall Search y empareja hasta maxMatches.
   * @param {string} categoryId
   * @param {number} now
   * @param {boolean} [skipDefer] - Si true, no difiere con setImmediate (usado en callback diferido)
   * @param {number} [maxMatches] - Límite de emparejamientos para esta categoría en este tick
   * @returns {Promise<number>} Número de emparejamientos realizados
   */
  async _processCategory(categoryId, now, skipDefer = false, maxMatches = MAX_MATCHES_PER_TICK) {
    const primaryPlayers = this.queueStore.getPlayersByCategory(categoryId);
    const bronceCount = this.queueStore.getPlayersByCategory('BRONCE').length;

    const canFormCrossLeague = categoryId === 'PLATA' && primaryPlayers.length >= 1 && bronceCount >= 1 && primaryPlayers.some((p) => p.allowLowerLeague);
    const effectivePool = primaryPlayers.length + (canFormCrossLeague ? bronceCount : 0);
    const returnEarly = effectivePool < 2;

    if (returnEarly) return 0;

    if (!skipDefer && effectivePool > LARGE_QUEUE_THRESHOLD) {
      setImmediate(() => this._processCategoryDeferred(categoryId, now));
      return 0;
    }

    return this._processCategorySync(categoryId, now, maxMatches);
  }

  /**
   * Diferido para colas grandes: cede el event loop.
   */
  _processCategoryDeferred(categoryId, now) {
    this._processCategory(categoryId, now, true).catch((err) =>
      console.error('[MatchmakingQueue] Error en _processCategoryDeferred:', err.message),
    );
  }

  async _processCategorySync(categoryId, now, maxMatches = MAX_MATCHES_PER_TICK) {
    let matchesDone = 0;

    while (matchesDone < maxMatches) {
      const primary = this.queueStore.getPlayersByCategory(categoryId);
      const bronceInSync = this.queueStore.getPlayersByCategory('BRONCE').length;
      const canFormPair = primary.length >= 2 || (categoryId === 'PLATA' && primary.length >= 1 && bronceInSync >= 1 && primary.some((p) => p.allowLowerLeague));

      if (!canFormPair) break;

      const pair = this._findBestPair(primary, now);
      if (!pair) break;

      await this._processMatch(pair);
      matchesDone++;
    }

    return matchesDone;
  }

  async _tick() {
    const now = Date.now();
    let totalMatches = 0;

    for (const categoryId of CATEGORIES_2V2) {
      const remaining = MAX_MATCHES_PER_TICK - totalMatches;
      if (remaining <= 0) break;
      const matches = await this._processCategory(categoryId, now, false, remaining);
      totalMatches += matches;
    }
  }
}

module.exports = {
  MatchmakingQueue,
  TICK_INTERVAL_MS,
  BASE_PR_RANGE,
  PR_EXPANSION_PER_SECOND,
  MAX_MATCHES_PER_TICK,
  LARGE_QUEUE_THRESHOLD,
};
