function buildInvoicePayload({ userId, kind, packId, nonce = null }) {
  const base = `${userId}:${kind}:${packId}`;
  if (typeof nonce === 'string' && nonce.trim().length > 0) {
    return `${base}:${nonce.trim()}`;
  }
  return base;
}

function parseInvoicePayload(payload) {
  if (typeof payload !== 'string') return null;

  const typedParts = payload.split(':');
  if (typedParts.length === 3 || typedParts.length === 4) {
    const [rawUserId, kind, packId, nonce = null] = typedParts;
    const userId = Number(rawUserId);
    if (!Number.isFinite(userId) || !packId) return null;
    if (kind !== 'stones' && kind !== 'vip') return null;
    return { userId, kind, packId, nonce };
  }

  const separatorIndex = payload.indexOf('_');
  if (separatorIndex <= 0 || separatorIndex === payload.length - 1) return null;
  const userId = Number(payload.slice(0, separatorIndex));
  const packId = payload.slice(separatorIndex + 1);
  if (!Number.isFinite(userId) || !packId) return null;

  // Compatibilidad legacy: "userId_packId" se trata como compra de piedras.
  return { userId, kind: 'stones', packId, nonce: null };
}

module.exports = { buildInvoicePayload, parseInvoicePayload };
