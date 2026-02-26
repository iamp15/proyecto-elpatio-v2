/**
 * Obtiene el saldo del usuario autenticado desde /wallet/balance.
 * Devuelve { balance_subunits, piedras }.
 * @param {Function} request - Función request del cliente API.
 */
export async function fetchWalletBalance(request) {
  return request('GET', '/wallet/balance');
}

/**
 * Obtiene el historial paginado de transacciones desde /wallet/history.
 * Devuelve { transactions, pagination }.
 * @param {Function} request - Función request del cliente API.
 * @param {{ page?: number, limit?: number }} opts
 */
export async function fetchWalletHistory(request, { page = 1, limit = 20 } = {}) {
  return request('GET', `/wallet/history?page=${page}&limit=${limit}`);
}
