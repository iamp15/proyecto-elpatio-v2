const AppConfig = require('../models/AppConfig');

let memoryConfig = null;
let parsedGames = new Map();

const DEFAULT_CONFIG = {
  system: {
    maintenanceMode: false,
    minClientVersion: '1.0.0'
  },
  gameplay: {
    disconnectGracePeriodSeconds: 60,
    botAutoplayDelayMinMs: 1000,
    botAutoplayDelayMaxMs: 3000,
    abandonPenaltyPR: 15,
    games: [
      {
        gameId: 'domino',
        isActive: true,
        settings: {
          pipMax: 6,
          maxHandSize: 7,
          passThreshold: 3
        },
        ranks: [
          { categoryId: 'BRONCE', label: 'Bronce', minPR: 0, maxPR: 499, entryFee_subunits: 2000, maxPlayers: 2, targetPoints: 50 },
          { categoryId: 'PLATA', label: 'Plata', minPR: 500, maxPR: 1199, entryFee_subunits: 10000, maxPlayers: 2, targetPoints: 75 },
          { categoryId: 'ORO', label: 'Oro', minPR: 1200, maxPR: 1999, entryFee_subunits: 35000, maxPlayers: 2, targetPoints: 100 },
          { categoryId: 'DIAMANTE', label: 'Diamante', minPR: 2000, maxPR: null, entryFee_subunits: 100000, maxPlayers: 2, targetPoints: 150 }
        ]
      }
    ]
  },
  economy: {
    leagueRakePercent: {
      BRONCE: 20,
      PLATA: 15,
      ORO: 12,
      DIAMANTE: 10,
    },
    storePackages: [
      { id: 'pack_test', name: 'Pack Dev', stars: 1, piedras: 10, bonusPercent: 0, isPopular: false },
      { id: 'pack_1', name: 'Puñado', stars: 50, piedras: 500, bonusPercent: 0, isPopular: false },
      { id: 'pack_2', name: 'Bolsa', stars: 250, piedras: 2750, bonusPercent: 10, isPopular: false },
      { id: 'pack_3', name: 'Saco', stars: 500, piedras: 6000, bonusPercent: 20, isPopular: true },
      { id: 'pack_4', name: 'Camión', stars: 1000, piedras: 13500, bonusPercent: 35, isPopular: false }
    ]
  },
  matchmaking: {
    productionRulesEnabled: false,
  },
};

const DEFAULT_LEAGUE_RAKE_PERCENT = DEFAULT_CONFIG.economy.leagueRakePercent;

class AppConfigManager {
  async loadConfigFromDB() {
    // Usamos findOneAndUpdate con upsert para evitar crear duplicados si varios procesos arrancan a la vez
    let config = await AppConfig.findOneAndUpdate(
      {},
      { $setOnInsert: DEFAULT_CONFIG },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    if (!config) {
      console.log('🌱 Creando AppConfig por defecto en la base de datos...');
      config = DEFAULT_CONFIG;
    }
    
    memoryConfig = config;
    const gamesFromDb = config.gameplay?.games;
    const gamesToParse =
      Array.isArray(gamesFromDb) && gamesFromDb.length > 0
        ? gamesFromDb
        : DEFAULT_CONFIG.gameplay.games;
    if (!Array.isArray(gamesFromDb) || gamesFromDb.length === 0) {
      console.warn(
        '[AppConfigManager] gameplay.games vacío o ausente en BD; usando ligas por defecto (domino) hasta actualizar app_config.',
      );
    }
    this._parseGames(gamesToParse);
    console.log('✅ AppConfig global cargada en memoria.');
  }

  getConfig() {
    if (!memoryConfig) {
      console.warn('⚠️ AppConfigManager.getConfig() llamado antes de loadConfigFromDB(). Devolviendo default.');
      return DEFAULT_CONFIG;
    }
    return memoryConfig;
  }

  async refreshConfig() {
    console.log('🔄 Recargando AppConfig global desde la base de datos...');
    await this.loadConfigFromDB();
  }

  async setMatchmakingProductionRulesEnabled(enabled) {
    const normalized = Boolean(enabled);
    await AppConfig.findOneAndUpdate(
      {},
      { $set: { 'matchmaking.productionRulesEnabled': normalized } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    await this.loadConfigFromDB();
    return normalized;
  }

  // ── Helpers de Juegos (migrados de ConfigManager) ──────────────────────────

  _parseGames(gamesArray) {
    parsedGames.clear();
    for (const game of gamesArray) {
      if (!game.isActive) continue;

      const rankMap = new Map();
      const ranksList = [];

      for (const rank of game.ranks || []) {
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

      parsedGames.set(game.gameId, {
        gameId: game.gameId,
        settings: game.settings || {},
        rankMap,
        ranksList,
      });
    }
  }

  getRankConfig(gameId, categoryId) {
    return parsedGames.get(gameId)?.rankMap.get(categoryId) ?? null;
  }

  getAllRanks(gameId) {
    return parsedGames.get(gameId)?.ranksList ?? [];
  }

  getSettings(gameId) {
    return parsedGames.get(gameId)?.settings ?? {};
  }

  isCategoryAccessible(gameId, userRank, categoryId) {
    const ranksList = parsedGames.get(gameId)?.ranksList ?? [];
    const userIdx = ranksList.findIndex((r) => r.categoryId === userRank);
    const catIdx = ranksList.findIndex((r) => r.categoryId === categoryId);
    if (userIdx < 0 || catIdx < 0) return false;
    return catIdx <= userIdx;
  }

  getLowerCategory(gameId, categoryId) {
    const rank = parsedGames.get(gameId)?.rankMap.get(categoryId);
    return rank?.lowerCategory ?? null;
  }

  getRankForPR(gameId, pr) {
    const ranksList = parsedGames.get(gameId)?.ranksList ?? [];
    let result = ranksList[0]?.categoryId ?? 'BRONCE';
    for (const cat of ranksList) {
      if (pr >= cat.minPR) result = cat.categoryId;
    }
    return result;
  }

  get gameIds() {
    return [...parsedGames.keys()];
  }

  get isReady() {
    return parsedGames.size > 0;
  }

  /**
   * Porcentaje de rake (0–100) aplicado al pozo total en partidas normales, según la liga de la sala.
   * @param {string} categoryId - BRONCE | PLATA | ORO | DIAMANTE
   * @returns {number}
   */
  getLeagueRakePercent(categoryId) {
    const key = typeof categoryId === 'string' ? categoryId.toUpperCase() : '';
    const fromDb = this.getConfig().economy?.leagueRakePercent;
    const merged = { ...DEFAULT_LEAGUE_RAKE_PERCENT, ...(fromDb && typeof fromDb === 'object' ? fromDb : {}) };
    const raw = merged[key];
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return DEFAULT_LEAGUE_RAKE_PERCENT.BRONCE;
  }

  isMatchmakingProductionRulesEnabled() {
    const value = this.getConfig().matchmaking?.productionRulesEnabled;
    return value === true;
  }
}

module.exports = new AppConfigManager();
