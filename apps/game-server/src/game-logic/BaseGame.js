/**
 * Clase base abstracta para todos los juegos del servidor.
 *
 * Cada juego concreto debe extender esta clase e implementar todos
 * sus métodos. Llamar a cualquier método sin sobreescribirlo lanza
 * un Error para detectar implementaciones incompletas en desarrollo.
 *
 * Contrato de cada método:
 *   start()                        → void
 *   validateMove(userId, data)     → { valid: boolean, reason?: string }
 *   handleAction(userId, data)     → { gameOver: boolean, winnerId: number|null }
 *   getState(forUserId)            → object  (estado personalizado por jugador)
 */
class BaseGame {
  /**
   * @param {{ maxPlayers: number, targetPoints: number, entryFee_subunits: number, gameType: string }} config
   * @param {number[]} playerIds - IDs de los jugadores en orden de turno
   */
  constructor(config, playerIds) {
    if (new.target === BaseGame) {
      throw new Error('BaseGame es una clase abstracta y no puede instanciarse directamente.');
    }
    this.config    = config;
    this.playerIds = playerIds;
  }

  /**
   * Inicializa el estado del juego (fichas, manos, turno inicial, etc.).
   * Debe ser llamado una sola vez después de instanciar el juego.
   */
  start() {
    throw new Error(`${this.constructor.name} debe implementar start()`);
  }

  /**
   * Valida si la acción del jugador es legal sin modificar el estado.
   *
   * @param {number} userId
   * @param {{ actionType: string, [key: string]: any }} data
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateMove(userId, data) {
    throw new Error(`${this.constructor.name} debe implementar validateMove()`);
  }

  /**
   * Aplica la acción del jugador y actualiza el estado interno.
   * Solo debe llamarse si validateMove devolvió valid: true.
   *
   * @param {number} userId
   * @param {{ actionType: string, [key: string]: any }} data
   * @returns {{ gameOver: boolean, winnerId: number|null }}
   */
  handleAction(userId, data) {
    throw new Error(`${this.constructor.name} debe implementar handleAction()`);
  }

  /**
   * Devuelve el estado del juego personalizado para un jugador:
   * su mano completa es visible, las de los oponentes solo como conteo.
   *
   * @param {number} forUserId
   * @returns {object}
   */
  getState(forUserId) {
    throw new Error(`${this.constructor.name} debe implementar getState()`);
  }
}

module.exports = { BaseGame };
