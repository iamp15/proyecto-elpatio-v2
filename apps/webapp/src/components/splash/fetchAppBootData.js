import { ACTIVE_GAME_HANDSHAKE_MS, LOBBY_CONFIG_TIMEOUT_MS } from './splashConstants.js';

/**
 * El socket se crea en un effect; hace polling hasta que exista o agota `maxMs`.
 * @param {{ current: import('socket.io-client').Socket | null }} socketRef
 */
export async function waitForDominoSocketInstance(socketRef, maxMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (socketRef.current) return socketRef.current;
    await new Promise((r) => {
      setTimeout(r, 80);
    });
  }
  return socketRef.current;
}

/**
 * Perfil (PR, rango) + saldo Piedras vía AuthContext.
 */
export async function fetchUserProfile(refreshUser, refreshBalance) {
  await Promise.all([refreshUser(), refreshBalance()]);
}

/**
 * Categorías del lobby Dominó (evento init_lobby_config por socket).
 */
export async function fetchLobbyRooms(waitForLobbyConfig) {
  await waitForLobbyConfig();
}

function waitForSocketConnected(socket) {
  if (!socket) return Promise.resolve();
  if (socket.connected) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => {
      socket.once('connect', resolve);
    }),
    new Promise((resolve) => {
      setTimeout(resolve, 12000);
    }),
  ]);
}

/**
 * Deja margen al handshake del servidor (reconnect_game si hay partida activa).
 * El resultado concreto lo guarda DominoSocketContext (pendingReconnect o navegación).
 */
export async function checkActiveGame(socket) {
  if (!socket) return;
  await waitForSocketConnected(socket);
  await new Promise((r) => setTimeout(r, ACTIVE_GAME_HANDSHAKE_MS));
}

/**
 * Promise.race amistoso: resuelve a los `ms` aunque `waitFn` no termine.
 * @param {() => Promise<void>} waitFn
 */
export async function waitForLobbyWithTimeout(waitFn, ms = LOBBY_CONFIG_TIMEOUT_MS) {
  await Promise.race([
    waitFn(),
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  ]);
}
