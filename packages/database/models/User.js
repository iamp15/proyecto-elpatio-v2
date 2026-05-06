const mongoose = require('mongoose');
const { CURRENT_SEASON } = require('../utils/currentSeason');

const RANKS = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

const inventoryEntrySchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    category: { type: String, required: true },
    subType: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    isEquipped: { type: Boolean, default: false },
    acquiredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const vipStatusSchema = new mongoose.Schema(
  {
    is_vip: { type: Boolean, default: false },
    start_date: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false },
);

const seasonProgressSchema = new mongoose.Schema(
  {
    season_id: { type: Number, default: CURRENT_SEASON },
    claimed_leagues: { type: [String], default: () => [] },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema({
  _id: { type: Number, required: true }, // Telegram ID
  // Guardamos en sub-unidades (ej: 100 unidades = 1 Piedra)
  balance_subunits: {
    type: Number,
    default: 0,
  },
  /** Nombre (first name) tal como viene de Telegram WebApp initData.user.first_name */
  tg_firstName: {
    type: String,
    trim: true,
  },
  /** @username de Telegram sin @; puede ser null si el usuario no tiene handle público */
  tg_username: {
    type: String,
    trim: true,
    lowercase: true,
  },
  nickname: {
    type: String,
    trim: true,
  },
  avatar_id: {
    type: String,
    default: 'avatar_default',
  },
  frame_id: {
    type: String,
    default: 'frame_bronce',
  },
  badge_id: {
    type: String,
    default: 'badge_bronce',
  },
  inventory: {
    type: [inventoryEntrySchema],
    default: () => [],
  },
  lastDailyCouponRefill: {
    type: Date,
    default: Date.now,
  },
  pr: {
    type: Number,
    default: 0,
  },
  rank: {
    type: String,
    enum: RANKS,
    default: 'BRONCE',
  },
  pendingPromotion: {
    type: String,
    enum: [...RANKS, null],
    default: null,
  },
  season_progress: {
    type: seasonProgressSchema,
    default: () => ({ season_id: CURRENT_SEASON, claimed_leagues: [] }),
  },
  current_status: {
    type: String,
    enum: ['ACTIVE', 'BANNED'],
    default: 'ACTIVE',
  },
  vip_status: {
    type: vipStatusSchema,
    default: () => ({ is_vip: false, start_date: null, expiresAt: null }),
  },
  stats: {
    type: Object,
    default: {
      games_played: 0,
      games_won: 0,
      games_lost: 0,
      games_abandoned: 0,
    },
  },
}, { timestamps: true });

// Helper para convertir a Piedras "legibles" en la interfaz
userSchema.virtual('piedras_display').get(function() {
  return Math.floor(this.balance_subunits / 100);
});

userSchema.index(
  { nickname: 1 },
  { unique: true, sparse: true, collation: { locale: 'es', strength: 2 } },
);

module.exports = mongoose.model('User', userSchema);
