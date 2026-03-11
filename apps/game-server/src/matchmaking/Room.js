const { randomUUID } = require('crypto');

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
}

module.exports = { Room, ROOM_STATUS };
