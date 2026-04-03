/**
 * Gestor centralizado de timers para prevenir memory leaks
 * Con asociación fuerte al ciclo de vida de las salas
 */
class TimerManager {
  constructor() {
    this.timers = new Map();           // timerId -> { timeoutId, callback, metadata }
    this.rooms = new Map();            // roomId -> Set<timerId> (timers asociados a sala)
    this.nextId = 1;
  }

  /**
   * Registrar una sala en el TimerManager
   * Permite rastrear todos los timers asociados a una sala
   */
  registerRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
      console.log(`[TimerManager] Sala registrada: ${roomId}`);
    }
  }

  /**
   * Desregistrar una sala y limpiar todos sus timers
   */
  unregisterRoom(roomId) {
    const roomTimers = this.rooms.get(roomId);
    if (roomTimers) {
      // Limpiar todos los timers de esta sala
      for (const timerId of roomTimers) {
        this._clearTimeoutInternal(timerId);
      }
      this.rooms.delete(roomId);
      console.log(`[TimerManager] Sala desregistrada: ${roomId}, timers limpiados: ${roomTimers.size}`);
    }
  }

  /**
   * Crear timer con asociación automática a sala y limpieza garantizada
   */
  setTimeout(callback, delay, metadata = {}) {
    const timerId = this.nextId++;
    const { roomId } = metadata;
    
    const timeoutId = setTimeout(() => {
      try {
        // Verificar que el timer aún existe (no fue cancelado)
        if (this.timers.has(timerId)) {
          callback();
        }
      } catch (err) {
        console.error(`[TimerManager] Error en timer ${timerId} (sala=${roomId}):`, err.message);
      } finally {
        // Siempre limpiar el timer después de ejecutar
        this.clearTimeout(timerId);
      }
    }, delay);
    
    // Almacenar timer
    this.timers.set(timerId, { timeoutId, callback, metadata });
    
    // Asociar timer a sala si tiene roomId
    if (roomId) {
      this._associateTimerToRoom(timerId, roomId);
    }
    
    return timerId;
  }

  /**
   * Cancelar timer específico
   */
  clearTimeout(timerId) {
    this._clearTimeoutInternal(timerId);
  }

  /**
   * Limpiar todos los timers de una sala específica
   */
  clearRoomTimers(roomId) {
    const roomTimers = this.rooms.get(roomId);
    if (roomTimers) {
      console.log(`[TimerManager] Limpiando ${roomTimers.size} timers de sala ${roomId}`);
      for (const timerId of roomTimers) {
        this._clearTimeoutInternal(timerId);
      }
      this.rooms.delete(roomId);
    }
  }

  /**
   * Limpiar timers de un jugador específico
   */
  clearPlayerTimers(userId) {
    const timersToClear = [];
    
    for (const [timerId, timer] of this.timers.entries()) {
      if (timer.metadata.userId === userId) {
        timersToClear.push(timerId);
      }
    }
    
    console.log(`[TimerManager] Limpiando ${timersToClear.length} timers del jugador ${userId}`);
    timersToClear.forEach(timerId => this._clearTimeoutInternal(timerId));
  }

  /**
   * Verificar integridad - encontrar timers huérfanos
   */
  checkIntegrity() {
    const orphanedTimers = [];
    
    for (const [timerId, timer] of this.timers.entries()) {
      const { roomId } = timer.metadata;
      if (roomId && !this.rooms.has(roomId)) {
        orphanedTimers.push({ timerId, roomId });
      }
    }
    
    return {
      activeTimers: this.timers.size,
      activeRooms: this.rooms.size,
      orphanedTimers,
      timersByRoom: this._groupByRoom(),
      timersByPlayer: this._groupByPlayer()
    };
  }

  /**
   * Métodos internos
   */
  _clearTimeoutInternal(timerId) {
    const timer = this.timers.get(timerId);
    if (timer) {
      clearTimeout(timer.timeoutId);
      this.timers.delete(timerId);
      
      // Remover asociación con sala
      const { roomId } = timer.metadata;
      if (roomId) {
        const roomTimers = this.rooms.get(roomId);
        if (roomTimers) {
          roomTimers.delete(timerId);
          if (roomTimers.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }
    }
  }

  _associateTimerToRoom(timerId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(timerId);
  }

  _groupByRoom() {
    const groups = {};
    for (const [roomId, timers] of this.rooms.entries()) {
      groups[roomId] = timers.size;
    }
    return groups;
  }

  _groupByPlayer() {
    const groups = {};
    for (const timer of this.timers.values()) {
      const userId = timer.metadata.userId;
      if (userId) {
        groups[userId] = (groups[userId] || 0) + 1;
      }
    }
    return groups;
  }
}

// Exportar singleton
const timerManager = new TimerManager();

// Health check automático para prevenir memory leaks
setInterval(() => {
  const stats = timerManager.checkIntegrity();
  
  if (stats.orphanedTimers.length > 0) {
    console.warn(`[TimerManager Health] ${stats.orphanedTimers.length} timers huérfanos encontrados`);
    
    // Limpiar timers huérfanos automáticamente
    stats.orphanedTimers.forEach(({ timerId, roomId }) => {
      console.warn(`[TimerManager Health] Limpiando timer huérfano ${timerId} (sala ${roomId})`);
      timerManager.clearTimeout(timerId);
    });
  }
  
  // Log periódico (solo en debug)
  if (stats.activeTimers > 0) {
    console.log(`[TimerManager Health] Timers activos: ${stats.activeTimers}, Salas registradas: ${stats.activeRooms}`);
  }
}, 30000); // Cada 30 segundos

module.exports = timerManager;