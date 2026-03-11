const mongoose = require('mongoose');

/**
 * Sub-esquema para cada categoría/rango dentro de un juego.
 * maxPR se almacena como null para representar Infinity
 * (BSON/JSON no serializa Infinity).
 */
const rankSchema = new mongoose.Schema(
  {
    categoryId:        { type: String, required: true },
    label:             { type: String, required: true },
    minPR:             { type: Number, required: true },
    maxPR:             { type: Number, default: null }, // null = sin límite superior
    entryFee_subunits: { type: Number, required: true },
    maxPlayers:        { type: Number, required: true },
    targetPoints:      { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Documento raíz: un documento por juego (domino, ludo, …).
 *
 * gameId   – identificador único del juego ('domino', 'ludo', …)
 * isActive – permite deshabilitar un juego completo sin borrarlo
 * settings – objeto libre para parámetros específicos del juego
 *            (tamaño de mano, valor máximo de ficha, etc.)
 * ranks    – lista de categorías de matchmaking para este juego
 */
const gameConfigSchema = new mongoose.Schema(
  {
    gameId:   { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    ranks:    { type: [rankSchema], required: true },
  },
  { timestamps: true, collection: 'game_configs' },
);

module.exports = mongoose.model('GameConfig', gameConfigSchema);
