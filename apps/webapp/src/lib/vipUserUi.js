/**
 * UI compartida para miembros VIP (color de la cápsula, nombre resaltado).
 */

export const VIP_HIGHLIGHT_GREEN = '#4ade80';

export function isVipUser(entity) {
  if (entity == null || typeof entity !== 'object') return false;
  const vs = entity.vip_status;
  if (vs == null || typeof vs !== 'object' || vs.is_vip !== true) return false;
  const exp = vs.expiresAt != null ? new Date(vs.expiresAt).getTime() : NaN;
  if (!Number.isFinite(exp)) return false;
  return exp > Date.now();
}

/** Estilo inline para nombre de usuario VIP (fondos oscuros: lobby, partida, cabecera, modales). */
export function vipDisplayNameStyleOnDark() {
  return {
    color: VIP_HIGHLIGHT_GREEN,
    fontWeight: 800,
    textShadow:
      '0 0 10px rgba(34, 197, 94, 0.55), 0 1px 6px rgba(0,0,0,0.95)',
  };
}

/**
 * Mezcla estilos base con el resalte VIP si `entity` tiene membresía activa.
 * @param {object|null|undefined} entity
 * @param {Record<string, string|number>} [baseStyle] estilos inline React
 */
export function withVipDisplayNameStyle(entity, baseStyle = {}) {
  if (!isVipUser(entity)) return baseStyle;
  return { ...baseStyle, ...vipDisplayNameStyleOnDark() };
}
