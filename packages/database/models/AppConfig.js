const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  categoryId: { type: String, required: true },
  label: { type: String, required: true },
  minPR: { type: Number, required: true },
  maxPR: { type: Number, default: null }, // null = sin límite superior
  entryFee_subunits: { type: Number, required: true },
  maxPlayers: { type: Number, required: true },
  targetPoints: { type: Number, required: true }
}, { _id: false });

const gameConfigSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  ranks: { type: [rankSchema], required: true }
}, { _id: false });

const storePackageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  stars: { type: Number, required: true },
  piedras: { type: Number, required: true },
  bonusPercent: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false }
}, { _id: false });

const vipPackageSchema = new mongoose.Schema({
  days: { type: Number, required: true },
  stars: { type: Number, required: true },
  stones: { type: Number, default: 0 },
  items: { type: [String], default: [] },
}, { _id: false });

const vipPackagesSchema = new mongoose.Schema({
  vip_7: { type: vipPackageSchema, required: true },
  vip_30: { type: vipPackageSchema, required: true },
  vip_90: { type: vipPackageSchema, required: true },
}, { _id: false });

/** Porcentaje de rake sobre el pozo total por liga (editables en BD). */
const leagueRakePercentSchema = new mongoose.Schema({
  BRONCE: { type: Number, default: 20 },
  PLATA: { type: Number, default: 15 },
  ORO: { type: Number, default: 12 },
  DIAMANTE: { type: Number, default: 10 },
}, { _id: false });

const appConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    default: 'global',
  },
  system: {
    maintenanceMode: { type: Boolean, default: false },
    minClientVersion: { type: String, default: '1.0.0' }
  },
  gameplay: {
    disconnectGracePeriodSeconds: { type: Number, default: 60 },
    botAutoplayDelayMinMs: { type: Number, default: 1000 },
    botAutoplayDelayMaxMs: { type: Number, default: 3000 },
    abandonPenaltyPR: { type: Number, default: 15 },
    games: { type: [gameConfigSchema], default: [] }
  },
  economy: {
    storePackages: { type: [storePackageSchema], default: [] },
    vipPackages: {
      type: vipPackagesSchema,
      default: () => ({
        vip_7: { days: 7, stars: 50, stones: 0, items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock'] },
        vip_30: { days: 30, stars: 250, stones: 1500, items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock', 'coupon_bronze_x3'] },
        vip_90: { days: 90, stars: 500, stones: 4500, items: ['badge_vip', 'phrase_vip_mock', 'emote_vip_mock', 'coupon_bronze_x3', 'coupon_plata_x3'] },
      }),
    },
    leagueRakePercent: {
      type: leagueRakePercentSchema,
      default: () => ({
        BRONCE: 20,
        PLATA: 15,
        ORO: 12,
        DIAMANTE: 10,
      }),
    },
  },
  matchmaking: {
    productionRulesEnabled: { type: Boolean, default: false },
  },
}, { timestamps: true, collection: 'app_config' });

appConfigSchema.index(
  { configKey: 1 },
  {
    unique: true,
    partialFilterExpression: { configKey: { $exists: true } },
  },
);

module.exports = mongoose.model('AppConfig', appConfigSchema);
