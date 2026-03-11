const { DominoGame } = require('./DominoGame');

/**
 * Registro de clases de juego disponibles.
 * La clave debe coincidir con el campo `gameType` en gameConfigs.js.
 * Para añadir un nuevo juego (ej. Ludo): importar la clase y registrarla aquí.
 *
 * @type {Object.<string, typeof import('./BaseGame').BaseGame>}
 */
const GAME_REGISTRY = {
  domino: DominoGame,
  // ludo: LudoGame,
};

/**
 * Instancia el motor de juego correcto según config.gameType.
 *
 * @param {{ gameType: string, [key: string]: any }} config - Configuración del modo de juego.
 * @param {number[]} playerIds - IDs de los jugadores participantes.
 * @returns {import('./BaseGame').BaseGame}
 * @throws {Error} Si el gameType no está registrado.
 */
function createGame(config, playerIds) {
  const GameClass = GAME_REGISTRY[config.gameType];
  if (!GameClass) {
    throw new Error(
      `[GameFactory] Tipo de juego desconocido: "${config.gameType}". ` +
      `Registrados: [${Object.keys(GAME_REGISTRY).join(', ')}]`,
    );
  }
  return new GameClass(config, playerIds);
}

module.exports = { createGame, GAME_REGISTRY };
