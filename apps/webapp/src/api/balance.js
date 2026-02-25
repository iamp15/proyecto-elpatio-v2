/**
 * Obtiene el balance del usuario autenticado.
 * @param {(method: string, path: string, opts?: { body?: unknown }) => Promise<{ piedras?: number }>} request - Función request del cliente API (inyecta token y maneja 401).
 */
export async function fetchBalance(request) {
  return request('GET', '/balance');
}
