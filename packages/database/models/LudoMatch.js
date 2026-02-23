const mongoose = require('mongoose');

const ludoMatchSchema = new mongoose.Schema({
    positions: Map,    // userId_pieceId -> position
    dice_value: Number,
    player_colors: Map // userId -> 'RED', 'BLUE', etc.
  });

  module.exports = mongoose.model('LudoMatch', ludoMatchSchema);