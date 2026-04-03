const { randomUUID } = require('crypto');
const timerManager = require('../utils/TimerManager');
const telegramBotNotifier = require('../utils/telegramBotNotifier');

/**
 * Estados posibles de una sala:
 *   WAITING  — esperando jugadores.
 *   CHARGING — sala llena, cobrando entry fees (bloqueada para nuevos jugadores).
 *   IN_GAME  — partida en curso.
 */
const ROOM_STATUS = Object.freeze({
  WAITING:  'WAITING',
  CHARGING: 'CHARGING',
  IN_GAME:  'IN_GAME',
  FINISHED: 'FINISHED',
});

/**
 * Representa una sala de matchmaking para un modo de juego concreto.
 *
 * Cada jugador se almacena como { userId, socketId, socket, pr }.
 * La referencia al socket se guarda para poder llamar a socket.leave()
 * y emitir mensajes directos durante el cobro de entry fees.
 */
class Room {
  /**
   * @param {string} modeId
   * @param {{ maxPlayers: number, targetPoints: number, entryFee_subunits: number }} config
   */
  constructor(modeId, config) {
    this.roomId   = randomUUID();
    this.modeId   = modeId;
    this.config   = config;
    this.players  = []; // [{ userId, socketId, socket, pr }]
    this.status   = ROOM_STATUS.WAITING;
    this.createdAt = Date.now();
    
    // Nuevas propiedades para manejo de desconexiones y timers
    this.disconnectedPlayers = new Map();   // userId -> timestamp desconexión
    this.disconnectTimers = new Map();      // userId -> timerId (referencia a TimerManager)

    this.autoplayEnabled = new Map();       // userId -> boolean
    
    // Estado de "Partida Suspendida" cuando todos los jugadores están desconectados

    this.allDisconnectedTimer = null;       // Timer para cuando TODOS se desconectan

    this.allDisconnectedSince = null;       // Timestamp cuando todos se desconectaron
    this.suspended = false;                 // Estado de "Partida Suspendida"
    
    // Registrar sala en TimerManager para limpieza automática

    timerManager.registerRoom(this.roomId);
  }

  /**
   * Añade un jugador a la sala y lo une al room de Socket.io.
   * Lanza un error si el userId ya está en la sala (previene cobros duplicados).
   * @param {import('socket.io').Socket} socket
   * @throws {Error} Con code 'ALREADY_IN_ROOM' si el userId ya está presente
   */
  addPlayer(socket) {
    const incomingUserId = socket.data.userId;
    if (this.players.some((p) => p.userId === incomingUserId)) {
      throw Object.assign(
        new Error(`El userId ${incomingUserId} ya está en esta sala`),
        { code: 'ALREADY_IN_ROOM' },
      );
    }
    socket.join(this.roomId);
    this.players.push({
      userId:   incomingUserId,
      socketId: socket.id,
      socket,
      pr: socket.data.pr ?? 1000,
    });
  }

  /**
   * Elimina un jugador de la sala y lo saca del room de Socket.io.
   * @param {number} userId
   */
  removePlayer(userId) {
    const idx = this.players.findIndex(p => p.userId === userId);
    if (idx === -1) return;
    const [removed] = this.players.splice(idx, 1);
    try { removed.socket.leave(this.roomId); } catch (_) {}
  }

  /** @returns {boolean} */
  isFull() {
    return this.players.length >= this.config.maxPlayers;
  }

  /** Bloquea la sala durante el cobro de entry fees. */
  lock() {
    this.status = ROOM_STATUS.CHARGING;
  }

  /** Desbloquea la sala si el cobro falla (devuelve a WAITING). */
  unlock() {
    this.status = ROOM_STATUS.WAITING;
  }

  /** Marca la sala como partida en curso. */
  start() {
    this.status = ROOM_STATUS.IN_GAME;
  }

  /** Marca la sala como finalizada tras la premiación. */
  finish() {
    this.status = ROOM_STATUS.FINISHED;
  }

  /** @returns {boolean} */
  isAvailable() {
    return this.status === ROOM_STATUS.WAITING && !this.isFull();
  }

  /** Devuelve una proyección pública segura de los jugadores (userId, socketId, pr). */
  getPublicPlayers() {
    return this.players.map(p => ({
      userId:   p.userId,
      socketId: p.socketId,
      pr:       p.pr ?? 1000,
    }));
  }

  // ==================== MANEJO DE DESCONEXIONES ====================

  /**
   * Maneja desconexión de jugador durante partida
   */
  handlePlayerDisconnect(userId) {
    if (this.status !== ROOM_STATUS.IN_GAME) return;
    
    // Registrar desconexión
    this.disconnectedPlayers.set(userId, Date.now());
    
    // Verificar si TODOS los jugadores están desconectados
    this._checkAllPlayersDisconnected();
    
    // Si NO estamos en estado suspendido y es el turno del jugador desconectado, iniciar timer de 90s
    if (!this.suspended && this.game?.turn === userId) {
      this.startDisconnectTimer(userId);
    }
  }

  /**
   * Maneja reconexión de jugador
   */
  handlePlayerReconnect(userId, socket) {
    if (this.status !== ROOM_STATUS.IN_GAME) return;
    
    // Limpiar estado de desconexión
    this.disconnectedPlayers.delete(userId);
    this.cancelDisconnectTimer(userId);
    this.autoplayEnabled.delete(userId);
    
    // Actualizar socket del jugador
    const player = this.players.find(p => p.userId === userId);
    if (player) {
      player.socket = socket;
      player.socketId = socket.id;
    }
    
    // Verificar si debemos salir del estado suspendido
    this._checkAllPlayersDisconnected();
  }

  /**
   * Inicia timer de 90 segundos para jugador desconectado
   */
  startDisconnectTimer(userId) {
    // Cancelar timer existente
    this.cancelDisconnectTimer(userId);
    
    // Notificar al jugador (stub del bot de Telegram)
    this.notifyPlayerDisconnected(userId);
    
    // Activar autoplay temporal
    this.autoplayEnabled.set(userId, true);
    
    // Crear timer con TimerManager - ASOCIADO AL ESTADO DE LA SALA
    const timerId = timerManager.setTimeout(
      () => {
        // Verificar que la sala aún existe antes de ejecutar
        if (this.status === ROOM_STATUS.IN_GAME) {
          this.handleDisconnectTimeout(userId);
        }
      },
      90000,
      {
        roomId: this.roomId,
        userId,
        type: 'disconnect_timeout',
        roomStatus: this.status // Capturar estado actual
      }
    );
    
    this.disconnectTimers.set(userId, timerId);
    console.log(`[Room] Timer de desconexión iniciado para userId=${userId}, timerId=${timerId}, sala=${this.roomId}`);
  }

  /**
   * Cancelar timer de desconexión
   */
  cancelDisconnectTimer(userId) {
    const timerId = this.disconnectTimers.get(userId);
    if (timerId) {
      timerManager.clearTimeout(timerId);
      this.disconnectTimers.delete(userId);
      this.autoplayEnabled.delete(userId);
      console.log(`[Room] Timer de desconexión cancelado para userId=${userId}, timerId=${timerId}`);
    }
  }

  /**
   * Se ejecuta cuando se agotan los 90 segundos de desconexión individual
   */
  handleDisconnectTimeout(userId) {
    if (this.status !== ROOM_STATUS.IN_GAME) return;
    
    console.log(`[Room] Timeout de desconexión para userId=${userId} en sala ${this.roomId}`);
    
    // Limpiar timer
    this.disconnectTimers.delete(userId);
    this.autoplayEnabled.delete(userId);
    
    // Determinar ganador (el otro jugador)
    const winnerId = this.players.find(p => p.userId !== userId)?.userId;
    
    if (!winnerId) {
      console.error(`[Room] No se pudo determinar ganador para timeout de desconexión userId=${userId}`);
      return;
    }
    
    // Finalizar partida con forfeit (esta función debe existir en otro archivo)
    // this._processForfeit(userId, winnerId);
    console.log(`[Room] Forfeit por desconexión: userId=${userId}, ganador=${winnerId}`);
    
    // Notificar a los jugadores
    this.players.forEach(player => {
      player.socket?.emit('game_over', {
        roomId: this.roomId,
        forfeit: true,
        disconnectedPlayerId: userId,
        winnerId: winnerId,
        message: 'Partida terminada por desconexión del oponente.'
      });
    });
    
    // Marcar sala como finalizada
    this.status = ROOM_STATUS.FINISHED;
  }

  /**
   * Notificar al jugador desconectado via Telegram (stub)
   */
  notifyPlayerDisconnected(userId) {
    const message = `⚠️ Es tu turno en la partida de dominó. Tienes 90 segundos para reconectar o el sistema jugará por ti.`;
    telegramBotNotifier.sendMessage(userId, message);
  }

  // ==================== ESTADO "PARTIDA SUSPENDIDA" ====================

  /**
   * Verifica si todos los jugadores están desconectados
   * Si es así, entra en estado "Partida Suspendida"
   */
  _checkAllPlayersDisconnected() {
    const activePlayers = this.players.filter(p => {
      // Jugador activo = tiene socket conectado O no está marcado como desconectado
      return p.socket?.connected || !this.disconnectedPlayers.has(p.userId);
    });
    
    const allDisconnected = activePlayers.length === 0 && this.players.length > 0;
    
    if (allDisconnected && !this.suspended) {
      // TODOS los jugadores desconectados - entrar en estado suspendido
      this._enterSuspendedState();
    } else if (!allDisconnected && this.suspended) {
      // Al menos un jugador reconectó - salir del estado suspendido
      this._exitSuspendedState();
    }
  }

  /**
   * Entra en estado "Partida Suspendida"
   */
  _enterSuspendedState() {
    console.log(`[Room] TODOS los jugadores desconectados. Entrando en estado SUSPENDIDO para sala ${this.roomId}`);
    
    this.suspended = true;
    this.allDisconnectedSince = Date.now();
    
    // Detener todos los timers individuales de desconexión
    for (const [userId] of this.disconnectTimers.entries()) {
      this.cancelDisconnectTimer(userId);
    }
    
    // Detener autoplay para todos
    this.autoplayEnabled.clear();
    
    // Iniciar timer de 90 segundos para partida suspendida
    this.allDisconnectedTimer = setTimeout(() => {
      this._handleSuspendedTimeout();
    }, 90000);
    
    console.log(`[Room] Timer de suspensión iniciado (90s) para sala ${this.roomId}`);
  }

  /**
   * Sale del estado "Partida Suspendida"
   */
  _exitSuspendedState() {
    if (!this.suspended) return;
    
    console.log(`[Room] Jugador reconectado. Saliendo de estado SUSPENDIDO para sala ${this.roomId}`);
    
    // Cancelar timer de suspensión
    if (this.allDisconnectedTimer) {
      clearTimeout(this.allDisconnectedTimer);
      this.allDisconnectedTimer = null;
    }
    
    this.suspended = false;
    this.allDisconnectedSince = null;
    
    // Re-evaluar desconexiones individuales
    this._reassessIndividualDisconnections();
  }

  /**
   * Re-evaluar desconexiones individuales después de salir de estado suspendido
   */
  _reassessIndividualDisconnections() {
    for (const [userId, disconnectTime] of this.disconnectedPlayers.entries()) {
      const player = this.players.find(p => p.userId === userId);
      
      if (!player) continue;
      
      // Si el jugador sigue desconectado
      if (!player.socket?.connected) {
        // Si es su turno, iniciar timer individual
        if (this.game?.turn === userId) {
          this.startDisconnectTimer(userId);
        }
      } else {
        // Jugador reconectó - limpiar estado
        this.disconnectedPlayers.delete(userId);
        this.cancelDisconnectTimer(userId);
        this.autoplayEnabled.delete(userId);
      }
    }
  }

  /**
   * Se ejecuta cuando se agota el timer de 90s en estado suspendido
   */
  _handleSuspendedTimeout() {
    if (!this.suspended) return;
    
    console.log(`[Room] Timeout de suspensión (90s) alcanzado para sala ${this.roomId}. Anulando partida...`);
    
    // Cancelar todos los timers
    this.cleanupTimers();
    
    // Devolver recursos a los jugadores (stub - implementar según lógica de negocio)
    this._refundEntryFees();
    
    // Notificar anulación (si hay algún socket conectado)
    this.players.forEach(player => {
      player.socket?.emit('game_cancelled', {
        roomId: this.roomId,
        reason: 'all_players_disconnected',
        message: 'La partida fue anulada porque todos los jugadores se desconectaron.',
        refunded: true
      });
    });
    
    // Cerrar sala
    this.status = ROOM_STATUS.FINISHED;
    this.suspended = false;
    
    // Programar limpieza completa
    setTimeout(() => {
      // La limpieza final la hará RoomManager
      console.log(`[Room] Sala ${this.roomId} lista para limpieza final`);
    }, 30000);
  }

  /**
   * Devolver entry fees a los jugadores (stub)
   */
  _refundEntryFees() {
    console.log(`[Room] Devolviendo entry fees para sala ${this.roomId}`);
    // TODO: Implementar lógica real de devolución según sistema de transacciones
    this.players.forEach(player => {
      console.log(`[Room] Entry fee devuelto a userId=${player.userId}`);
    });
  }

  // ==================== LIMPIEZA DE TIMERS ====================

  /**
   * Limpiar todos los timers asociados a esta sala
   * Se llama automáticamente cuando la sala se destruye
   */
  cleanupTimers() {
    // 1. Limpiar timer de suspensión (si existe)
    if (this.allDisconnectedTimer) {
      clearTimeout(this.allDisconnectedTimer);
      this.allDisconnectedTimer = null;
      console.log(`[Room] Timer de suspensión cancelado para sala ${this.roomId}`);
    }
    
    // 2. Limpiar timers de desconexión individuales registrados en esta sala
    for (const [userId, timerId] of this.disconnectTimers.entries()) {
      timerManager.clearTimeout(timerId);
      console.log(`[Room] Limpiando timer de desconexión userId=${userId}, timerId=${timerId}`);
    }
    this.disconnectTimers.clear();
    this.autoplayEnabled.clear();
    this.disconnectedPlayers.clear();
    
    // 3. Resetear estado suspendido
    this.suspended = false;
    this.allDisconnectedSince = null;
    
    // 4. Notificar a TimerManager que la sala se está destruyendo
    timerManager.unregisterRoom(this.roomId);
  }

  /**
   * Destruir sala - sobreescribir método existente o añadir hook
   */
  destroy() {
    console.log(`[Room] Destruyendo sala ${this.roomId}, limpiando timers...`);
    
    // 1. Cancelar timer de suspensión si existe
    if (this.allDisconnectedTimer) {
      clearTimeout(this.allDisconnectedTimer);
      this.allDisconnectedTimer = null;
    }
    
    // 2. Limpiar todos los timers asociados
    this.cleanupTimers();
    
    // 3. Limpiar referencias de sockets
    this.players.forEach(player => {
      player.socket = null;
      player.socketId = null;
    });
    
    // 4. Limpiar juego
    this.game = null;
    
    // 5. Resetear estado suspendido
    this.suspended = false;
    this.allDisconnectedSince = null;
    
    // 6. Marcar como finalizada
    this.status = ROOM_STATUS.FINISHED;
    
    console.log(`[Room] Sala ${this.roomId} destruida correctamente`);
  }
}

module.exports = { Room, ROOM_STATUS };
