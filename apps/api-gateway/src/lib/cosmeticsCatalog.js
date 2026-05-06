/**
 * Catálogo de cosméticos (avatars, frames, badges) disponibles.
 * Define los items y sus condiciones de desbloqueo.
 */

// --- AVATARS ---
const AVATARS = [
  {
    id: 'avatar_default',
    name: 'Avatar Genérico',
    description: 'Avatar genérico del catálogo maestro',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'avatar_default2',
    name: 'Avatar Azul',
    description: 'Avatar genérico azul del catálogo maestro',
    unlockType: 'inventory',
    requires: null,
    unlockedByDefault: false,
  },
  {
    id: 'avatar_default3',
    name: 'Avatar Verde',
    description: 'Avatar genérico verde del catálogo maestro',
    unlockType: 'inventory',
    requires: null,
    unlockedByDefault: false,
  },
  {
    id: 'telegram',
    name: 'Foto de Telegram',
    description: 'Usa la foto de perfil de Telegram si está disponible',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'default',
    name: 'Iniciales con gradiente',
    description: 'Iniciales con gradiente del color de tu liga',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip_gold',
    name: 'Avatar VIP Dorado',
    description: 'Avatar exclusivo para miembros VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'halloween',
    name: 'Avatar de Halloween',
    description: 'Edición limitada de Halloween',
    unlockType: 'event',
    requires: { event: 'halloween_2025' },
    unlockedByDefault: false,
  },
];

// --- FRAMES ---
const FRAMES = [
  {
    id: 'frame_bronce',
    name: 'Marco Bronce',
    description: 'Marco básico de Liga Bronce',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'frame_plata',
    name: 'Marco Plata',
    description: 'Marco básico de Liga Plata',
    unlockType: 'rank',
    requires: { minRank: 'PLATA' },
    unlockedByDefault: false,
  },
  {
    id: 'frame_oro',
    name: 'Marco Oro',
    description: 'Marco básico de Liga Oro',
    unlockType: 'rank',
    requires: { minRank: 'ORO' },
    unlockedByDefault: false,
  },
  {
    id: 'frame_diamante',
    name: 'Marco Diamante',
    description: 'Marco básico de Liga Diamante',
    unlockType: 'rank',
    requires: { minRank: 'DIAMANTE' },
    unlockedByDefault: false,
  },
  {
    id: 'rank',
    name: 'Marco de Liga',
    description: 'Color según tu rango actual',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip_gold',
    name: 'Marco VIP Dorado',
    description: 'Marco dorado con brillos, exclusivo VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'vip_silver',
    name: 'Marco VIP Plateado',
    description: 'Marco plateado con brillos, exclusivo VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'diamond_sparkle',
    name: 'Marco Diamante',
    description: 'Destellos de diamante para rango DIAMANTE',
    unlockType: 'rank',
    requires: { minRank: 'DIAMANTE' },
    unlockedByDefault: false,
  },
  {
    id: 'gold_sparkle',
    name: 'Marco Oro Brillante',
    description: 'Destellos de oro para rango ORO o superior',
    unlockType: 'rank',
    requires: { minRank: 'ORO' },
    unlockedByDefault: false,
  },
  {
    id: 'halloween_frame',
    name: 'Marco de Calabaza',
    description: 'Marco temático de Halloween',
    unlockType: 'event',
    requires: { event: 'halloween_2025' },
    unlockedByDefault: false,
  },
];

// --- BADGES ---
const BADGES = [
  {
    id: 'badge_bronce',
    name: 'Insignia Novato',
    description: 'Insignia básica de Liga Bronce',
    unlockType: 'auto',
    context: 'global',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'badge_plata',
    name: 'Insignia Plata',
    description: 'Insignia básica de Liga Plata',
    unlockType: 'rank',
    context: 'global',
    requires: { minRank: 'PLATA' },
    unlockedByDefault: false,
  },
  {
    id: 'badge_oro',
    name: 'Insignia Oro',
    description: 'Insignia básica de Liga Oro',
    unlockType: 'rank',
    context: 'global',
    requires: { minRank: 'ORO' },
    unlockedByDefault: false,
  },
  {
    id: 'badge_diamante',
    name: 'Insignia Diamante',
    description: 'Insignia básica de Liga Diamante',
    unlockType: 'rank',
    context: 'global',
    requires: { minRank: 'DIAMANTE' },
    unlockedByDefault: false,
  },
  {
    id: 'default',
    name: 'Estrella',
    description: 'Badge básico con estrella',
    unlockType: 'auto',
    context: 'global',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip',
    name: 'Corona› VIP',
    description: 'Corona para miembros VIP',
    unlockType: 'vip',
    context: 'global',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'torneo',
    name: 'Rayo› de Torneo',
    description: 'Badge por participar en torneos',
    unlockType: 'achievement',
    context: 'domino',
    requires: { achievement: 'tournament_participant' },
    unlockedByDefault: false,
  },
  {
    id: 'fundador',
    name: 'Escudo› de Fundador',
    description: 'Exclusivo para fundadores de la plataforma',
    unlockType: 'special',
    context: 'global',
    requires: { special: 'founder' },
    unlockedByDefault: false,
  },
  {
    id: 'winner',
    name: 'Trofeo› de Ganador',
    description: 'Badge por ganar 10 partidas',
    unlockType: 'achievement',
    context: 'domino',
    requires: { gamesWon: 10 },
    unlockedByDefault: false,
  },
  {
    id: 'streak',
    name: 'Llama› de Racha',
    description: 'Badge por racha› de victorias',
    unlockType: 'achievement',
    context: 'domino',
    requires: { winStreak: 5 },
    unlockedByDefault: false,
  },
];

const ALL_ITEMS = {
  avatars: AVATARS,
  frames: FRAMES,
  badges: BADGES,
};

/**
 * Busca un badge por su ID.
 * @param {string} id
 * @returns {Object|null} Badge encontrado o null.
 */
function getBadgeById(id) {
  return BADGES.find((b) => b.id === id);
}

/**
 * @param {unknown} inventory - user.inventory (array nuevo o objeto legacy)
 * @returns {{ avatars: string[], frames: string[], badges: string[] }}
 */
function getOwnedIdsFromInventory(inventory) {
  const empty = { avatars: [], frames: [], badges: [] };
  if (!inventory) return empty;

  if (Array.isArray(inventory)) {
    const out = { avatars: [], frames: [], badges: [] };
    for (const row of inventory) {
      if (!row || row.category !== 'cosmetic') continue;
      const id = row.itemId;
      if (id == null) continue;
      if (row.subType === 'avatar_photo') out.avatars.push(String(id));
      else if (row.subType === 'avatar_frame') out.frames.push(String(id));
      else if (row.subType === 'profile_badge') out.badges.push(String(id));
    }
    return out;
  }

  if (
    typeof inventory === 'object' &&
    Array.isArray(inventory.avatars) &&
    Array.isArray(inventory.frames) &&
    Array.isArray(inventory.badges)
  ) {
    return {
      avatars: [...inventory.avatars],
      frames: [...inventory.frames],
      badges: [...inventory.badges],
    };
  }

  return empty;
}

module.exports = {
  AVATARS,
  FRAMES,
  BADGES,
  ALL_ITEMS,
  getOwnedIdsFromInventory,
  getBadgeById,
};