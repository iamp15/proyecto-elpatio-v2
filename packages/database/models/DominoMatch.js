const mongoose = require('mongoose');

const dominoMatchSchema = new mongoose.Schema({
    board: [[Number]], // Fichas en la mesa
    hands: Map,        // userId -> Array de fichas
    turn_index: Number,
    last_move_at: Date
  });

  module.exports = mongoose.model('DominoMatch', dominoMatchSchema);