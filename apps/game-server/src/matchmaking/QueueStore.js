/**
 * Capa de abstracción para el almacenamiento de la cola de matchmaking.
 * Implementación in-memory con buckets por categoría.
 * Diseñada para poder inyectar Redis u otro backend sin reescribir la lógica de negocio.
 *
 * Estructura: Map<categoryId, Map<socketId, player>>
 * Categorías: BRONCE, PLATA, ORO, DIAMANTE
 */

const CATEGORIES = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

class InMemoryQueueStore {
  constructor() {
    /** @type {Map<string, Map<string, object>>} categoryId -> Map<socketId, player> */
    this._buckets = new Map();
    for (const cat of CATEGORIES) {
      this._buckets.set(cat, new Map());
    }
  }

  /**
   * Añade un jugador al bucket de su categoría.
   * @param {object} player - { userId, socketId, socket, pr, categoryId, allowLowerLeague, joinTime }
   * @returns {{ ok: boolean, error?: string }}
   */
  addPlayer(player) {
    const { userId, socketId, categoryId } = player;
    if (!categoryId || !this._buckets.has(categoryId)) {
      return { ok: false, error: `Categoría inválida: ${categoryId}` };
    }
    if (this.hasPlayer(userId)) {
      return { ok: false, error: 'Ya estás en la cola.' };
    }
    const bucket = this._buckets.get(categoryId);
    bucket.set(socketId, player);
    return { ok: true };
  }

  /**
   * Elimina un jugador por socketId.
   * @param {string} socketId
   * @returns {boolean} true si existía y fue eliminado
   */
  removePlayer(socketId) {
    for (const bucket of this._buckets.values()) {
      if (bucket.has(socketId)) {
        bucket.delete(socketId);
        return true;
      }
    }
    return false;
  }

  /**
   * Devuelve copia del array de jugadores en la categoría.
   * @param {string} categoryId
   * @returns {object[]}
   */
  getPlayersByCategory(categoryId) {
    const bucket = this._buckets.get(categoryId);
    if (!bucket) return [];
    return [...bucket.values()];
  }

  /**
   * Comprueba si el userId ya está en alguna cola.
   * @param {number} userId
   * @returns {boolean}
   */
  hasPlayer(userId) {
    for (const bucket of this._buckets.values()) {
      for (const player of bucket.values()) {
        if (player.userId === userId) return true;
      }
    }
    return false;
  }

  /**
   * Cuenta total de jugadores en todas las categorías 2v2 (BRONCE + PLATA).
   * @returns {number}
   */
  getTotal2v2Count() {
    const bronce = this._buckets.get('BRONCE').size;
    const plata = this._buckets.get('PLATA').size;
    return bronce + plata;
  }
}

function createDefaultQueueStore() {
  return new InMemoryQueueStore();
}

module.exports = { InMemoryQueueStore, createDefaultQueueStore, CATEGORIES };
