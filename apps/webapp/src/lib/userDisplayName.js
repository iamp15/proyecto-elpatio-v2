/**
 * Jerarquía del nombre visible del usuario en toda la app:
 * 1. nickname (definido en El Patio)
 * 2. tg_firstName / first_name (nombre de Telegram)
 * 3. tg_username / username (handle de Telegram)
 *
 * Si `entity` incluye `displayName` (p. ej. jugador enriquecido por el game-server),
 * se usa primero porque ya resuelve nickname/username en servidor.
 *
 * `name` se admite para objetos tipo `myPlayer` en dominó (nombre ya resuelto para UI).
 *
 * @param {object|null|undefined} entity
 * @param {string} [fallback='Jugador']
 * @returns {string}
 */
export function resolveDisplayName(entity, fallback = 'Jugador') {
  if (!entity || typeof entity !== 'object') return fallback;
  const keys = [
    'displayName',
    'name',
    'nickname',
    'tg_firstName',
    'tg_username',
    'first_name',
    'username',
  ];
  for (let i = 0; i < keys.length; i += 1) {
    const v = entity[keys[i]];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}
