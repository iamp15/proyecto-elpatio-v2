const { GameConfig } = require('@el-patio/database');

/**
 * Singleton que mantiene en memoria la configuración de TODOS los juegos
 * leída desde la colección game_configs de MongoDB.
 *
 * Estructura interna:
 *   this._games  Map<gameId, GameEntry>
 *
 *   GameEntry {
 *     gameId:    string
 *     settings:  object           – parámetros libres del juego
 *     rankMap:   Map<categoryId, RankConfig>
 *     ranksList: RankConfig[]     – ordenada por minPR ascendente
 *   }
 *
 *   RankConfig {
 *     categoryId, label, minPR, maxPR (Infinity si null en DB),
 *     entryFee_subunits, maxPlayers, targetPoints
 *   }
 *
 * Uso:
 *   const cm = require('./ConfigManager');
 *   await cm.loadAllConfigs();                         // al iniciar
 *   await cm.loadGameConfig('domino');                 // recarga parcial
 *
 *   cm.getRankConfig('domino', 'ORO')  → RankConfig | null
 *   cm.getAllRanks('domino')           → RankConfig[]
 *   cm.getRankForPR('domino', 1500)    → 'PLATA'
 *   cm.getSettings('domino')          → { pipMax: 6, … }
 */
class ConfigManager {
  constructor() {
    /** @type {Map<string, object>} gameId → GameEntry */
    this._games = new Map();
  }

  // ── Carga ──────────────────────────────────────────────────────────────────

  /**
   * Carga (o recarga) todos los juegos activos desde MongoDB.
   * Llamar una vez al iniciar el servidor.
   */
  async loadAllConfigs() {
    const docs = await GameConfig.find({ isActive: true }).lean();

    if (docs.length === 0) {
      console.warn('[ConfigManager] No hay juegos activos en la BD. Revisa game_configs.');
      return;
    }

    for (const doc of docs) {
      this._parseAndStore(doc);
    }

    console.log(`[ConfigManager] Juegos cargados: [${[...this._games.keys()].join(', ')}]`);
  }

  /**
   * Carga (o recarga) la configuración de UN juego específico.
   * Útil para el endpoint de refresco parcial.
   * @param {string} gameId
   */
  async loadGameConfig(gameId) {
    const doc = await GameConfig.findOne({ gameId, isActive: true }).lean();

    if (!doc) {
      console.warn(`[ConfigManager] No se encontró config activa para gameId='${gameId}'.`);
      return;
    }

    this._parseAndStore(doc);
    console.log(`[ConfigManager] Config de '${gameId}' recargada (${doc.ranks.length} rangos).`);
  }

  // ── Consulta ───────────────────────────────────────────────────────────────

  /**
   * Devuelve la configuración de una categoría/rango.
   * @param {string} gameId
   * @param {string} categoryId
   * @returns {object|null}
   */
  getRankConfig(gameId, categoryId) {
    return this._games.get(gameId)?.rankMap.get(categoryId) ?? null;
  }

  /**
   * Devuelve todos los rangos de un juego, ordenados por minPR ascendente.
   * @param {string} gameId
   * @returns {object[]}
   */
  getAllRanks(gameId) {
    return this._games.get(gameId)?.ranksList ?? [];
  }

  /**
   * Devuelve los settings específicos de un juego.
   * @param {string} gameId
   * @returns {object}
   */
  getSettings(gameId) {
    return this._games.get(gameId)?.settings ?? {};
  }

  /**
   * Indica si un usuario puede acceder a una categoría según su rango.
   * Solo las categorías MAYORES al rango del usuario quedan bloqueadas.
   * @param {string} gameId
   * @param {string} userRank   categoryId del rango actual del usuario
   * @param {string} categoryId categoría a la que quiere unirse
   * @returns {boolean}
   */
  isCategoryAccessible(gameId, userRank, categoryId) {
    const ranksList = this._games.get(gameId)?.ranksList ?? [];
    const userIdx   = ranksList.findIndex((r) => r.categoryId === userRank);
    const catIdx    = ranksList.findIndex((r) => r.categoryId === categoryId);
    if (userIdx < 0 || catIdx < 0) return false;
    return catIdx <= userIdx;
  }

  /**
   * Devuelve la categoría inmediatamente inferior a la dada.
   * BRONCE devuelve null (no hay inferior).
   * @param {string} gameId
   * @param {string} categoryId
   * @returns {string|null} categoryId de la liga inferior, o null
   */
  getLowerCategory(gameId, categoryId) {
    const rank = this._games.get(gameId)?.rankMap.get(categoryId);
    return rank?.lowerCategory ?? null;
  }

  /**
   * Determina el categoryId del rango que corresponde a un valor de PR.
   * @param {string} gameId
   * @param {number} pr
   * @returns {string} categoryId  (ej: 'PLATA')
   */
  getRankForPR(gameId, pr) {
    const ranksList = this._games.get(gameId)?.ranksList ?? [];
    let result = ranksList[0]?.categoryId ?? 'BRONCE';
    for (const cat of ranksList) {
      if (pr >= cat.minPR) result = cat.categoryId;
    }
    return result;
  }

  /**
   * Lista de gameIds actualmente cargados.
   * @returns {string[]}
   */
  get gameIds() {
    return [...this._games.keys()];
  }

  /** true si al menos un juego está cargado */
  get isReady() {
    return this._games.size > 0;
  }

  // ── Interno ────────────────────────────────────────────────────────────────

  /**
   * Normaliza un documento de MongoDB y lo almacena en el mapa interno.
   * @param {object} doc  documento .lean() de GameConfig
   */
  _parseAndStore(doc) {
    const rankMap   = new Map();
    const ranksList = [];

    for (const rank of doc.ranks ?? []) {
      const normalized = {
        ...rank,
        maxPR: rank.maxPR === null || rank.maxPR === undefined ? Infinity : rank.maxPR,
      };
      rankMap.set(rank.categoryId, normalized);
      ranksList.push(normalized);
    }

    ranksList.sort((a, b) => a.minPR - b.minPR);

    for (let i = 0; i < ranksList.length; i++) {
      ranksList[i].lowerCategory = i > 0 ? ranksList[i - 1].categoryId : null;
    }

    this._games.set(doc.gameId, {
      gameId:    doc.gameId,
      settings:  doc.settings ?? {},
      rankMap,
      ranksList,
    });
  }
}

module.exports = new ConfigManager();
