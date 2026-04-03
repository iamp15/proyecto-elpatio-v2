const { Room } = require('./Room');
const configManager = require('../config/ConfigManager');
const { createGame } = require('../game-logic/GameFactory');

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this._rooms = new Map();
  }

  /**
   * Busca una sala disponible para la categoría donde al menos un jugador
   * tenga un PR dentro del rango ±range respecto al del nuevo jugador.
   * @param {string} categoryId
   * @param {number} userPR
   * @param {number} [range=50]
   * @returns {Room|null}
   */
  findAvailableRoomByPR(categoryId, userPR, range = 50) {
    for (const room of this._rooms.values()) {
      if (room.modeId !== categoryId || !room.isAvailable()) continue;
      const hasCompatiblePlayer = room.players.some(
        (p) => Math.abs((p.pr ?? 1000) - userPR) <= range,
      );
      if (hasCompatiblePlayer) return room;
    }
    return null;
  }

  /**
   * Busca sala compatible con PR ±50, luego ±150, y si no hay crea una nueva.
   * @param {string} categoryId
   * @param {number} userPR
   * @returns {Room}
   */
  getOrCreateByPR(categoryId, userPR) {
    return (
      this.findAvailableRoomByPR(categoryId, userPR, 50)  ??
      this.findAvailableRoomByPR(categoryId, userPR, 150) ??
      this.createRoom(categoryId)
    );
  }

  createRoom(categoryId) {
    const config = configManager.getRankConfig('domino', categoryId);
    if (!config) {
      throw new Error(`Categoría de rango desconocida: ${categoryId}`);
    }
    const room = new Room(categoryId, { ...config, gameType: 'domino' });
    this._rooms.set(room.roomId, room);
    console.log(`[RoomManager] Sala creada: ${room.roomId} (${categoryId})`);
    return room;
  }

  /**
   * Crea una sala con configuración explícita (para cross-league).
   * @param {string} categoryId
   * @param {object} config - Debe incluir gameType, entryFee_subunits, maxPlayers, targetPoints
   * @returns {Room}
   */
  createRoomWithConfig(categoryId, config) {
    const room = new Room(categoryId, config);
    this._rooms.set(room.roomId, room);
    console.log(`[RoomManager] Sala creada: ${room.roomId} (${categoryId})`);
    return room;
  }

  getRoom(roomId) {
    return this._rooms.get(roomId) ?? null;
  }

  delete(roomId) {
    const room = this._rooms.get(roomId);
    if (room) {
      // 1. Limpiar todos los timers asociados a la sala
      room.cleanupTimers();
      
      // 2. Remover sala del mapa
      this._rooms.delete(roomId);
      
      console.log(`[RoomManager] Sala ${roomId} eliminada y timers limpiados`);
      return true;
    }
    return false;
  }

  /**
   * Limpiar salas expiradas (ejemplo de implementación)
   */
  clearExpiredRooms() {
    const now = Date.now();
    const expired = [];
    const MAX_ROOM_AGE = 24 * 60 * 60 * 1000; // 24 horas
    
    for (const [roomId, room] of this._rooms.entries()) {
      // Salas en FINISHED por más de 30 minutos
      if (room.status === 'FINISHED' && now - room.createdAt > 30 * 60 * 1000) {
        expired.push(roomId);
      }
      // Salas WAITING por más de 24 horas
      else if (room.status === 'WAITING' && now - room.createdAt > MAX_ROOM_AGE) {
        expired.push(roomId);
      }
    }
    
    // Limpiar salas expiradas con limpieza de timers
    expired.forEach(roomId => this.delete(roomId));
    
    if (expired.length > 0) {
      console.log(`[RoomManager] ${expired.length} salas expiradas limpiadas`);
    }
    
    return expired.length;
  }

  startGame(room) {
    const playerIds = room.players.map((p) => p.userId);
    room.game = createGame(room.config, playerIds);
    room.game.start();
    console.log(
      `[RoomManager] Motor de juego "${room.config.gameType}" iniciado en sala ${room.roomId} ` +
      `con jugadores: [${playerIds.join(', ')}]`,
    );
  }

  get size() {
    return this._rooms.size;
  }
}

module.exports = { RoomManager };
