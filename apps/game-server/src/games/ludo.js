// Ludo: estado y reglas (placeholder para lógica de partida)
const DEFAULT_STATE = {
  players: [],
  currentTurn: 0,
  dice: 0,
  pieces: [],
};

function createLudoGame(roomId) {
  return { roomId, ...DEFAULT_STATE };
}

function applyMove(state, move) {
  // TODO: validar jugada y actualizar estado
  return { ...state };
}

module.exports = { createLudoGame, applyMove, DEFAULT_STATE };
