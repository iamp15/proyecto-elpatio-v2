const AppConfig = require('../models/AppConfig');

let memoryConfig = null;
let parsedGames = new Map();
const APP_CONFIG_KEY = 'global';

const DEFAULT_CONFIG = {
  configKey: APP_CONFIG_KEY,
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
    ],
    vipPackages: {
      vip_7: {
        days: 7,
        stars: 50,
        stones: 0,
        items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock'],
      },
      vip_30: {
        days: 30,
        stars: 250,
        stones: 1500,
        items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock', 'coupon_bronze_x3'],
      },
      vip_90: {
        days: 90,
        stars: 500,
        stones: 4500,
        items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock', 'coupon_bronze_x3', 'coupon_plata_x3'],
      },
    },
  },
  matchmaking: {
    productionRulesEnabled: false,
  },
};

const DEFAULT_LEAGUE_RAKE_PERCENT = DEFAULT_CONFIG.economy.leagueRakePercent;

class AppConfigManager {
  async _normalizeSingletonConfig() {
    const docs = await AppConfig.find({})
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .lean();

    if (docs.length === 0) return null;

    const primary =
      docs.find((doc) => doc.configKey === APP_CONFIG_KEY) ||
      docs.find((doc) => doc.economy?.vipPackages) ||
      docs[0];

    const duplicateIds = docs
      .filter((doc) => String(doc._id) !== String(primary._id))
      .map((doc) => doc._id);

    if (duplicateIds.length > 0) {
      console.warn(
        `[AppConfigManager] Se encontraron ${duplicateIds.length + 1} documentos app_config; conservando ${primary._id} y eliminando duplicados.`,
      );
      await AppConfig.deleteMany({ _id: { $in: duplicateIds } });
    }

    const needsSingletonKey = primary.configKey !== APP_CONFIG_KEY;
    if (needsSingletonKey) {
      return AppConfig.findByIdAndUpdate(
        primary._id,
        { $set: { configKey: APP_CONFIG_KEY } },
        { new: true },
      ).lean();
    }

    return primary;
  }

  async loadConfigFromDB() {
    // Asegura el índice único antes del upsert. El índice parcial no bloquea
    // documentos legacy sin configKey, que se normalizan abajo.
    await AppConfig.init();

    let config = await this._normalizeSingletonConfig();

    if (!config) {
      try {
        config = await AppConfig.findOneAndUpdate(
          { configKey: APP_CONFIG_KEY },
          { $setOnInsert: DEFAULT_CONFIG },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ).lean();
      } catch (error) {
        if (error?.code !== 11000) throw error;
        config = await AppConfig.findOne({ configKey: APP_CONFIG_KEY }).lean();
      }
    }

    if (!config) {
      console.log('🌱 Creando AppConfig por defecto en la base de datos...');
      config = DEFAULT_CONFIG;
    }

    if (!config.economy?.vipPackages) {
      console.warn('[AppConfigManager] economy.vipPackages ausente; escribiendo paquetes VIP por defecto en app_config.');
      config = await AppConfig.findOneAndUpdate(
        { configKey: APP_CONFIG_KEY },
        { $set: { 'economy.vipPackages': DEFAULT_CONFIG.economy.vipPackages } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean();
    }
    
    // Fallback defensivo para despliegues con documentos viejos sin vipPackages.
    memoryConfig = {
      ...config,
      economy: {
        ...DEFAULT_CONFIG.economy,
        ...(config?.economy || {}),
        vipPackages: config?.economy?.vipPackages || DEFAULT_CONFIG.economy.vipPackages,
      },
    };
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
      { configKey: APP_CONFIG_KEY },
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
