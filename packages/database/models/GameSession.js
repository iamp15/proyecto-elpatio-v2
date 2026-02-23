const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  game_type: { 
    type: String, 
    required: true, 
    enum: ['DOMINO', 'LUDO'] 
  },
  status: { 
    type: String, 
    default: 'WAITING', 
    enum: ['WAITING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'] 
  },
  
  // Lo que guardamos en la DB (Sub-unidades)
  entry_fee_subunits: { type: Number, required: true },
  pot_subunits: { type: Number, default: 0 },

  players: [{ type: Number, ref: 'User' }],
  winner_id: { type: Number, ref: 'User', default: null },

  // Referencia dinámica a la colección mecánica (DominoMatch o LudoMatch)
  details_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'game_type_collection' 
  },
  game_type_collection: { 
    type: String, 
    enum: ['DominoMatch', 'LudoMatch'] 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, // Importante: Esto permite que los helpers viajen en el JSON
  toObject: { virtuals: true } 
});

// --- HELPERS (VIRTUALS) PARA LA INTERFAZ ---

// Retorna el costo de entrada en Piedras enteras
gameSessionSchema.virtual('entry_fee_display').get(function() {
  return Math.floor(this.entry_fee_subunits / 100);
});

// Retorna el premio total en Piedras enteras
gameSessionSchema.virtual('pot_display').get(function() {
  return Math.floor(this.pot_subunits / 100);
});

module.exports = mongoose.model('GameSession', gameSessionSchema);