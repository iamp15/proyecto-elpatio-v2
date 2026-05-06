const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

class RecentOpponentsStore {
  constructor(cooldownMs = THREE_HOURS_MS) {
    this.cooldownMs = cooldownMs;
    this._matches = new Map();
  }

  _getPairKey(userA, userB) {
    const a = Number(userA);
    const b = Number(userB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  _purgeExpired(now = Date.now()) {
    for (const [key, ts] of this._matches.entries()) {
      if (now - ts >= this.cooldownMs) {
        this._matches.delete(key);
      }
    }
  }

  recordMatch(userA, userB, now = Date.now()) {
    const key = this._getPairKey(userA, userB);
    if (!key) return;
    this._purgeExpired(now);
    this._matches.set(key, now);
  }

  playedRecently(userA, userB, now = Date.now()) {
    const key = this._getPairKey(userA, userB);
    if (!key) return false;
    this._purgeExpired(now);
    const lastPlayedAt = this._matches.get(key);
    return Number.isFinite(lastPlayedAt) && now - lastPlayedAt < this.cooldownMs;
  }

  /**
   * UserIds con los que este usuario tiene partida reciente dentro del cooldown (solo depuración / logs).
   * @param {number|string} userId
   * @param {number} [now]
   * @returns {number[]}
   */
  getActiveOpponentIdsFor(userId, now = Date.now()) {
    const uid = Number(userId);
    if (!Number.isFinite(uid)) return [];
    this._purgeExpired(now);
    const out = [];
    for (const key of this._matches.keys()) {
      const parts = key.split(':').map(Number);
      if (parts.length !== 2 || !parts.every(Number.isFinite)) continue;
      if (parts[0] === uid) out.push(parts[1]);
      else if (parts[1] === uid) out.push(parts[0]);
    }
    return out;
  }
}

module.exports = {
  RecentOpponentsStore,
  THREE_HOURS_MS,
};
