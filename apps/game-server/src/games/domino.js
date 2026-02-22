// Dominó: estado y reglas (placeholder para lógica de partida)
const DEFAULT_STATE = {
  players: [],
  currentTurn: 0,
  board: [],
  hands: {},
};

function createDominoGame(roomId) {
  return { roomId, ...DEFAULT_STATE };
}

function applyMove(state, move) {
  // TODO: validar jugada y actualizar estado
  return { ...state };
}

module.exports = { createDominoGame, applyMove, DEFAULT_STATE };
