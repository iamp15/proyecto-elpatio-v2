const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Crea un cliente API que inyecta el JWT en las peticiones y maneja 401.
 * @param {() => string | null} getToken - Función que devuelve el token actual.
 * @param {() => void} onUnauthorized - Callback cuando la respuesta es 401 (logout + redirección).
 * @returns {{ request(method: string, path: string, opts?: { body?: unknown }): Promise<unknown> }}
 */
export function createApiClient(getToken, onUnauthorized) {
  return {
    async request(method, path, { body } = {}) {
      const url = `${baseUrl}/${path.replace(/^\//, '')}`;
      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      };
      const res = await fetch(url, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        onUnauthorized();
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      }

      if (!res.ok) {
        const err = new Error(res.statusText || 'Request failed');
        err.status = res.status;
        try {
          err.body = await res.json();
        } catch {
          err.body = null;
        }
        throw err;
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return res.json();
      }
      return res.text();
    },
  };
}
