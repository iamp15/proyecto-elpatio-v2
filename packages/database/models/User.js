const mongoose = require('mongoose');

const RANKS = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

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
    default: 'telegram',
  },
  frame_id: {
    type: String,
    default: 'rank',
  },
  badge_id: {
    type: String,
    default: 'default',
  },
  badge_contexts: {
    type: Object,
    default: {
      global: 'default',
      domino: null,
    },
  },
  inventory: {
    type: Object,
    default: {
      avatars: ['telegram', 'default'],
      frames: ['rank'],
      badges: ['default'],
    },
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
  current_status: {
    type: String,
    enum: ['ACTIVE', 'BANNED'],
    default: 'ACTIVE',
  },
  vip_status: {
    type: Object,
    default: {
      is_vip: false,
      days_left: 0,
      start_date: null,
    },
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